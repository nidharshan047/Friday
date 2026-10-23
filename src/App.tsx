import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  Brain,
  Send,
  Loader2,
  Menu,
  X,
} from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type Memory = {
  id: string;
  memory: string;
  source: string;
  created_at: string;
};

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>("conv-default");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello. I'm Friday. What can I help you with?",
    },
  ]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newMemory, setNewMemory] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chats" | "memories">("chats");

  const listEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchConversations();
    fetchMemories();
  }, []);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function fetchConversations() {
    try {
      const res = await fetch("/v1/conversations");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.conversations) && data.conversations.length > 0) {
        setConversations(data.conversations);
      }
    } catch {
      // ignore initial fetch error
    }
  }

  async function fetchMemories() {
    try {
      const res = await fetch("/v1/memories");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.memories)) {
        setMemories(data.memories);
      }
    } catch {
      // ignore
    }
  }

  async function selectConversation(id: string) {
    setActiveConvId(id);
    setSidebarOpen(false);
    try {
      const res = await fetch(`/v1/conversations/${id}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch {
      // ignore
    }
  }

  async function createNewConversation() {
    try {
      const res = await fetch("/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New conversation" }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.conversation) {
        setConversations((prev) => [data.conversation, ...prev]);
        setActiveConvId(data.conversation.id);
        setMessages(
          data.messages ?? [
            {
              id: "welcome",
              role: "assistant",
              content: "Hello. I'm Friday. What can I help you with?",
            },
          ]
        );
        setSidebarOpen(false);
      }
    } catch {
      // ignore
    }
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch(`/v1/conversations/${id}`, { method: "DELETE" });
      const res = await fetch("/v1/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
        if (activeConvId === id && data.conversations?.[0]) {
          selectConversation(data.conversations[0].id);
        }
      }
    } catch {
      // ignore
    }
  }

  async function addMemory(e: React.FormEvent) {
    e.preventDefault();
    const text = newMemory.trim();
    if (!text) return;
    try {
      const res = await fetch("/v1/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memory: text, source: "user" }),
      });
      if (res.ok) {
        const data = await res.json();
        setMemories((prev) => [data.memory, ...prev]);
        setNewMemory("");
      }
    } catch {
      // ignore
    }
  }

  async function removeMemory(id: string) {
    try {
      await fetch(`/v1/memories/${id}`, { method: "DELETE" });
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch {
      // ignore
    }
  }

  async function speakMessage(msg: Message) {
    if (speakingId === msg.id) {
      audioRef.current?.pause();
      setSpeakingId(null);
      return;
    }

    setSpeakingId(msg.id);
    try {
      const res = await fetch("/v1/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg.content }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const data = await res.json();
      if (data.audioBase64) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
        audioRef.current = audio;
        audio.onended = () => setSpeakingId(null);
        audio.onerror = () => setSpeakingId(null);
        await audio.play();
      } else {
        setSpeakingId(null);
      }
    } catch {
      setSpeakingId(null);
    }
  }

  async function send() {
    const content = draft.trim();
    if (!content || busy) return;
    const userMessage: Message = {
      id: `${Date.now()}`,
      role: "user",
      content,
    };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setDraft("");
    setBusy(true);

    try {
      const response = await fetch("/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConvId,
          messages: updatedMessages.map(({ role, content }) => ({
            role,
            content,
          })),
        }),
      });
      if (!response.ok) throw new Error(`API error (${response.status})`);
      const data: { reply: string } = await response.json();
      const assistantMessage: Message = {
        id: `${Date.now()}-reply`,
        role: "assistant",
        content: data.reply,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      fetchConversations();
      if (autoSpeak) {
        speakMessage(assistantMessage);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          content: `I couldn't reach Friday's API. Check the API URL and server. ${String(e)}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex h-screen w-full bg-[#0b1020] text-[#f3f5ff] overflow-hidden">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar: Conversations & Memories (from supabase/migrations/0001_friday_core.sql) */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-[#232b40] bg-[#0e1528] transition-transform duration-200 md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#232b40] px-5 py-4">
          <div>
            <h1 className="text-xl font-extrabold tracking-[4px] text-[#e8edff]">
              FRIDAY
            </h1>
            <p className="mt-0.5 text-xs text-[#9aa6c4]">
              Personal AI assistant
            </p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-[#9aa6c4] hover:bg-[#171f33] md:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 gap-1 border-b border-[#232b40] p-2">
          <button
            onClick={() => setActiveTab("chats")}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold tracking-wider transition-colors ${
              activeTab === "chats"
                ? "bg-[#253d70] text-[#f3f5ff]"
                : "text-[#9aa6c4] hover:bg-[#171f33]"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            CHATS
          </button>
          <button
            onClick={() => setActiveTab("memories")}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold tracking-wider transition-colors ${
              activeTab === "memories"
                ? "bg-[#253d70] text-[#f3f5ff]"
                : "text-[#9aa6c4] hover:bg-[#171f33]"
            }`}
          >
            <Brain className="h-3.5 w-3.5" />
            MEMORIES ({memories.length})
          </button>
        </div>

        {activeTab === "chats" ? (
          <div className="flex flex-1 flex-col overflow-hidden p-3">
            <button
              onClick={createNewConversation}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#7da2ff] px-4 py-2.5 text-sm font-extrabold text-[#0b1020] transition hover:bg-[#93b2ff]"
            >
              <Plus className="h-4 w-4" />
              New Conversation
            </button>

            <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`group flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${
                    activeConvId === conv.id
                      ? "border border-[#303b56] bg-[#171f33] text-[#f3f5ff]"
                      : "text-[#9aa6c4] hover:bg-[#151d30] hover:text-[#e8edff]"
                  }`}
                >
                  <span className="truncate pr-2">{conv.title}</span>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                    title="Delete conversation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden p-3">
            <form onSubmit={addMemory} className="mb-3 space-y-2">
              <textarea
                value={newMemory}
                onChange={(e) => setNewMemory(e.target.value)}
                placeholder="Add a persistent memory for Friday (e.g., 'I work as a product designer')…"
                rows={2}
                className="w-full resize-none rounded-xl border border-[#303b56] bg-[#151d30] px-3 py-2 text-xs text-[#f3f5ff] placeholder-[#8d94a3] focus:border-[#7da2ff] focus:outline-none"
              />
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#7da2ff] px-3 py-2 text-xs font-extrabold text-[#0b1020] transition hover:bg-[#93b2ff]"
              >
                <Plus className="h-3.5 w-3.5" />
                Save Memory
              </button>
            </form>

            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {memories.map((m) => (
                <div
                  key={m.id}
                  className="group flex items-start justify-between gap-2 rounded-xl border border-[#2a3550] bg-[#171f33] p-3 text-xs text-[#e8edff]"
                >
                  <p className="leading-relaxed">{m.memory}</p>
                  <button
                    onClick={() => removeMemory(m.id)}
                    className="shrink-0 text-[#8d94a3] transition hover:text-red-400"
                    title="Remove memory"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Main Chat Screen (matches apps/mobile/app/index.tsx styling) */}
      <main className="flex flex-1 flex-col bg-[#0b1020]">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[#232b40] px-5 pt-3 pb-3.5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-1.5 text-[#9aa6c4] hover:bg-[#171f33] md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <div className="text-[23px] font-extrabold tracking-[4px] text-[#e8edff]">
                FRIDAY
              </div>
              <div className="mt-0.5 text-sm text-[#9aa6c4]">
                Personal AI assistant
              </div>
            </div>
          </div>

          <button
            onClick={() => setAutoSpeak((v) => !v)}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
              autoSpeak
                ? "border-[#7da2ff] bg-[#253d70] text-[#f3f5ff]"
                : "border-[#303b56] bg-[#151d30] text-[#9aa6c4] hover:text-[#f3f5ff]"
            }`}
            title="Toggle automatic voice reply"
          >
            {autoSpeak ? (
              <Volume2 className="h-4 w-4 text-[#7da2ff]" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
            <span>{autoSpeak ? "Voice On" : "Voice Off"}</span>
          </button>
        </header>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            {messages.map((item) => {
              const isUser = item.role === "user";
              return (
                <div
                  key={item.id}
                  className={`max-w-[88%] rounded-2xl p-[13px] ${
                    isUser
                      ? "self-end bg-[#253d70]"
                      : "self-start border border-[#2a3550] bg-[#171f33]"
                  }`}
                >
                  <div className="mb-[5px] flex items-center justify-between gap-3">
                    <span className="text-[10px] font-extrabold tracking-[1.5px] text-[#9caed7]">
                      {isUser ? "YOU" : "FRIDAY"}
                    </span>
                    {!isUser && (
                      <button
                        onClick={() => speakMessage(item)}
                        className="rounded p-1 text-[#9caed7] transition hover:bg-[#253d70]/50 hover:text-[#f3f5ff]"
                        title="Read message aloud"
                      >
                        <Volume2
                          className={`h-3.5 w-3.5 ${
                            speakingId === item.id
                              ? "animate-pulse text-[#7da2ff]"
                              : ""
                          }`}
                        />
                      </button>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap text-[15px] leading-[21px] text-[#f3f5ff]">
                    {item.content}
                  </div>
                </div>
              );
            })}
            {busy && (
              <div className="self-start rounded-2xl border border-[#2a3550] bg-[#171f33] px-4 py-3">
                <Loader2 className="h-5 w-5 animate-spin text-[#7da2ff]" />
              </div>
            )}
            <div ref={listEndRef} />
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-[#232b40] p-3">
          <div className="mx-auto flex max-w-3xl items-end gap-[9px]">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Friday anything…"
              maxLength={4000}
              disabled={busy}
              rows={1}
              className="max-h-[130px] min-h-[46px] flex-1 resize-y rounded-[14px] border border-[#303b56] bg-[#151d30] px-[14px] py-[12px] text-[15px] text-[#f3f5ff] placeholder-[#8d94a3] focus:border-[#7da2ff] focus:outline-none disabled:opacity-60"
            />
            <button
              onClick={send}
              disabled={busy || !draft.trim()}
              className="rounded-[13px] bg-[#7da2ff] px-[17px] py-[13px] text-sm font-extrabold text-[#0b1020] transition hover:bg-[#93b2ff] active:opacity-70 disabled:opacity-50"
            >
              <span className="flex items-center gap-1.5">
                <span>Send</span>
                <Send className="h-3.5 w-3.5" />
              </span>
            </button>
          </div>
        </div>

        <p className="pb-2 text-center text-[11px] text-[#7e8aa7]">
          Voice synthesis is available on every response; text fallback stays
          available.
        </p>
      </main>
    </div>
  );
}
