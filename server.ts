import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// In-memory store replicating supabase/migrations/0001_friday_core.sql
interface MessageRecord {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  created_at: string;
}

interface ConversationRecord {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MemoryRecord {
  id: string;
  memory: string;
  source: string;
  created_at: string;
}

const defaultConvId = "conv-default";
const nowIso = () => new Date().toISOString();

const conversations = new Map<string, ConversationRecord>([
  [
    defaultConvId,
    {
      id: defaultConvId,
      title: "Welcome Session",
      created_at: nowIso(),
      updated_at: nowIso(),
    },
  ],
]);

const messagesByConv = new Map<string, MessageRecord[]>([
  [
    defaultConvId,
    [
      {
        id: "welcome",
        conversation_id: defaultConvId,
        role: "assistant",
        content: "Hello. I'm Friday. What can I help you with?",
        created_at: nowIso(),
      },
    ],
  ],
]);

const memories: MemoryRecord[] = [
  {
    id: "mem-1",
    memory: "Prefers concise, direct answers with clear action items.",
    source: "system",
    created_at: nowIso(),
  },
];

const ChatBody = z.object({
  conversationId: z.string().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(40),
});

const MemoryBody = z.object({
  memory: z.string().min(1).max(1000),
  source: z.string().optional(),
});

const TtsBody = z.object({
  text: z.string().min(1).max(2000),
  voiceName: z.enum(["Kore", "Puck", "Charon", "Fenrir", "Zephyr"]).optional(),
});

function getSystemPrompt(): string {
  const base =
    "You are Friday, a helpful personal AI assistant. Be clear, safe, and concise. Do not claim to have executed tools unless a backend tool result confirms it.";
  if (memories.length === 0) return base;
  const memoryLines = memories.map((m) => `- ${m.memory}`).join("\n");
  return `${base}\n\nPersistent User Memories:\n${memoryLines}`;
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "friday-api" });
});

// Conversations API (matches 0001_friday_core.sql)
app.get("/v1/conversations", (_req, res) => {
  const list = Array.from(conversations.values()).sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at)
  );
  res.json({ conversations: list });
});

app.post("/v1/conversations", (req, res) => {
  const id = crypto.randomUUID();
  const title =
    typeof req.body?.title === "string" && req.body.title.trim()
      ? req.body.title.trim()
      : "New conversation";
  const conv: ConversationRecord = {
    id,
    title,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  conversations.set(id, conv);
  messagesByConv.set(id, [
    {
      id: `${Date.now()}-welcome`,
      conversation_id: id,
      role: "assistant",
      content: "Hello. I'm Friday. What can I help you with?",
      created_at: nowIso(),
    },
  ]);
  res.status(201).json({ conversation: conv, messages: messagesByConv.get(id) });
});

app.get("/v1/conversations/:id/messages", (req, res) => {
  const { id } = req.params;
  if (!conversations.has(id)) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  res.json({ messages: messagesByConv.get(id) ?? [] });
});

app.delete("/v1/conversations/:id", (req, res) => {
  const { id } = req.params;
  conversations.delete(id);
  messagesByConv.delete(id);
  if (conversations.size === 0) {
    const fallbackId = crypto.randomUUID();
    conversations.set(fallbackId, {
      id: fallbackId,
      title: "New conversation",
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    messagesByConv.set(fallbackId, [
      {
        id: `${Date.now()}-welcome`,
        conversation_id: fallbackId,
        role: "assistant",
        content: "Hello. I'm Friday. What can I help you with?",
        created_at: nowIso(),
      },
    ]);
  }
  res.json({ ok: true });
});

// Memories API (matches 0001_friday_core.sql)
app.get("/v1/memories", (_req, res) => {
  res.json({ memories });
});

app.post("/v1/memories", (req, res) => {
  const parsed = MemoryBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid memory payload" });
  }
  const item: MemoryRecord = {
    id: crypto.randomUUID(),
    memory: parsed.data.memory.trim(),
    source: parsed.data.source || "user",
    created_at: nowIso(),
  };
  memories.unshift(item);
  res.status(201).json({ memory: item });
});

app.delete("/v1/memories/:id", (req, res) => {
  const idx = memories.findIndex((m) => m.id === req.params.id);
  if (idx !== -1) memories.splice(idx, 1);
  res.json({ ok: true });
});

// Chat API (compatible with apps/mobile/app/index.tsx and services/api/src/index.ts)
app.post("/v1/chat", async (req, res) => {
  const parsed = ChatBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid chat request" });
  }

  const systemPrompt = getSystemPrompt();
  const incomingMessages = parsed.data.messages;
  const lastUserMessage = incomingMessages[incomingMessages.length - 1];

  const openAiKey = process.env.MODEL_API_KEY;
  const openAiModel = process.env.MODEL_NAME;
  const geminiKey = process.env.GEMINI_API_KEY;

  let replyText = "";

  try {
    if (openAiKey && openAiModel) {
      const client = new OpenAI({
        apiKey: openAiKey,
        baseURL: process.env.MODEL_BASE_URL || "https://api.openai.com/v1",
      });
      const completion = await client.chat.completions.create({
        model: openAiModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...incomingMessages,
        ],
        temperature: 0.6,
      });
      replyText =
        completion.choices[0]?.message?.content ?? "I didn't receive a response.";
    } else if (geminiKey) {
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const contents = incomingMessages.map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.6,
        },
      });

      replyText = response.text ?? "I didn't receive a response.";
    } else {
      return res
        .status(503)
        .json({ error: "Model provider is not configured" });
    }

    // Persist to in-memory conversation store if conversationId provided
    const convId = parsed.data.conversationId || defaultConvId;
    if (conversations.has(convId) && lastUserMessage) {
      const conv = conversations.get(convId)!;
      const list = messagesByConv.get(convId) ?? [];
      list.push({
        id: `${Date.now()}-user`,
        conversation_id: convId,
        role: "user",
        content: lastUserMessage.content,
        created_at: nowIso(),
      });
      list.push({
        id: `${Date.now()}-assistant`,
        conversation_id: convId,
        role: "assistant",
        content: replyText,
        created_at: nowIso(),
      });
      messagesByConv.set(convId, list);
      if (conv.title === "New conversation" || conv.title === "Welcome Session") {
        conv.title =
          lastUserMessage.content.slice(0, 42) +
          (lastUserMessage.content.length > 42 ? "…" : "");
      }
      conv.updated_at = nowIso();
    }

    return res.json({ reply: replyText });
  } catch (error) {
    console.error(
      "Model request failed",
      error instanceof Error ? error.message : "unknown"
    );
    return res
      .status(502)
      .json({ error: "The model provider request failed." });
  }
});

// Voice synthesis endpoint using Gemini TTS
app.post("/v1/tts", async (req, res) => {
  const parsed = TtsBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid TTS request" });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return res.status(503).json({ error: "Voice synthesis provider not configured" });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: geminiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash-lite-tts",
      contents: [
        {
          role: "user",
          parts: [{ text: parsed.data.text }],
        },
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: parsed.data.voiceName || "Kore",
            },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(502).json({ error: "No audio returned from model" });
    }

    return res.json({ audioBase64: base64Audio, mimeType: "audio/wav" });
  } catch (error) {
    console.error(
      "TTS request failed",
      error instanceof Error ? error.message : "unknown"
    );
    return res.status(502).json({ error: "Voice synthesis failed" });
  }
});

async function startServer() {
  const port = Number(process.env.PORT || 3000);

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`Friday server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
