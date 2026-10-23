import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { z } from "zod";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const apiKey = process.env.MODEL_API_KEY;
const model = process.env.MODEL_NAME;
if (!apiKey || !model) console.warn("MODEL_API_KEY and MODEL_NAME must be configured before model requests.");

const client = new OpenAI({
  apiKey: apiKey ?? "missing-key",
  baseURL: process.env.MODEL_BASE_URL || "https://api.openai.com/v1"
});

const ChatBody = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(4000)
  })).min(1).max(40)
});

app.get("/health", (_req, res) => res.json({ status: "ok", service: "friday-api" }));

app.post("/v1/chat", async (req, res) => {
  const parsed = ChatBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid chat request" });
  if (!apiKey || !model) return res.status(503).json({ error: "Model provider is not configured" });

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are Friday, a helpful personal AI assistant. Be clear, safe, and concise. Do not claim to have executed tools unless a backend tool result confirms it." },
        ...parsed.data.messages
      ],
      temperature: 0.6
    });
    return res.json({ reply: completion.choices[0]?.message?.content ?? "I didn't receive a response." });
  } catch (error) {
    console.error("Model request failed", error instanceof Error ? error.name : "unknown");
    return res.status(502).json({ error: "The model provider request failed." });
  }
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`Friday API listening on ${port}`));
