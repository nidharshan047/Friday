import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Plus, Trash2, Volume2, VolumeX, Brain, Send, Loader2, Menu, X, Sparkles, Search, Command, Mic, MicOff, AudioLines, ArrowUpRight, Zap, Settings2 } from "lucide-react";

type Message = { id: string; role: "user" | "assistant"; content: string };
type Conversation = { id: string; title: string; created_at: string; updated_at: string };
type Memory = { id: string; memory: string; source: string; created_at: string };
const welcome: Message = { id: "welcome", role: "assistant", content: "Hello. I'm Friday. What can I help you with?" };
const starters = [{ icon: Zap, title: "Make a plan", prompt: "Help me turn an idea into a clear action plan." }, { icon: Brain, title: "Think it through", prompt: "Help me think through a difficult decision." }, { icon: Sparkles, title: "Create something", prompt: "Let's brainstorm a creative project." }];

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState("conv-default");
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newMemory, setNewMemory] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chats" | "memories">("chats");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [listening, setListening] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechRef = useRef<any>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { fetchConversations(); fetchMemories(); }, []);
  useEffect(() => { listEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(v => !v); }
      if (e.key === "Escape") { setPaletteOpen(false); setSidebarOpen(false); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function fetchConversations() { try { const r = await fetch("/v1/conversations"); if (!r.ok) return; const d = await r.json(); if (Array.isArray(d.conversations)) setConversations(d.conversations); } catch {} }
  async function fetchMemories() { try { const r = await fetch("/v1/memories"); if (!r.ok) return; const d = await r.json(); if (Array.isArray(d.memories)) setMemories(d.memories); } catch {} }
  async function selectConversation(id: string) { setActiveConvId(id); setSidebarOpen(false); try { const r = await fetch("/v1/conversations/" + id + "/messages"); if (!r.ok) return; const d = await r.json(); if (Array.isArray(d.messages)) setMessages(d.messages); } catch {} }
  async function createNewConversation() {
    try {
      const r = await fetch("/v1/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "New conversation" }) });
      if (!r.ok) return; const d = await r.json();
      if (d.conversation) { setConversations(p => [d.conversation, ...p]); setActiveConvId(d.conversation.id); setMessages(d.messages ?? [welcome]); setSidebarOpen(false); }
    } catch {}
  }
  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try { await fetch("/v1/conversations/" + id, { method: "DELETE" }); const r = await fetch("/v1/conversations"); if (r.ok) { const d = await r.json(); setConversations(d.conversations || []); if (activeConvId === id) { if (d.conversations?.[0]) selectConversation(d.conversations[0].id); else { setActiveConvId("conv-default"); setMessages([welcome]); } } } } catch {}
  }
  async function addMemory(e: React.FormEvent) {
    e.preventDefault(); const text = newMemory.trim(); if (!text) return;
    try { const r = await fetch("/v1/memories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memory: text, source: "user" }) }); if (r.ok) { const d = await r.json(); setMemories(p => [d.memory, ...p]); setNewMemory(""); } } catch {}
  }
  async function removeMemory(id: string) { try { await fetch("/v1/memories/" + id, { method: "DELETE" }); setMemories(p => p.filter(m => m.id !== id)); } catch {} }
  async function speakMessage(msg: Message) {
    if (speakingId === msg.id) { audioRef.current?.pause(); setSpeakingId(null); return; }
    setSpeakingId(msg.id);
    try {
      const r = await fetch("/v1/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: msg.content }) });
      if (!r.ok) throw new Error("TTS failed"); const d = await r.json();
      if (d.audioBase64) { audioRef.current?.pause(); const audio = new Audio("data:audio/wav;base64," + d.audioBase64); audioRef.current = audio; audio.onended = () => setSpeakingId(null); audio.onerror = () => setSpeakingId(null); await audio.play(); } else setSpeakingId(null);
    } catch { setSpeakingId(null); }
  }
  async function send(text = draft) {
    const content = text.trim(); if (!content || busy) return;
    const userMessage: Message = { id: String(Date.now()), role: "user", content };
    const updated = [...messages, userMessage]; setMessages(updated); setDraft(""); setBusy(true);
    try {
      const r = await fetch("/v1/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: activeConvId, messages: updated.map(({ role, content }) => ({ role, content })) }) });
      if (!r.ok) throw new Error("API error (" + r.status + ")");
      const d: { reply: string } = await r.json(); const reply: Message = { id: String(Date.now()) + "-reply", role: "assistant", content: d.reply };
      setMessages(p => [...p, reply]); fetchConversations(); if (autoSpeak) speakMessage(reply);
    } catch (e) { setMessages(p => [...p, { id: String(Date.now()) + "-error", role: "assistant", content: "I couldn't reach Friday's API. Check the API URL and server. " + String(e) }]); }
    finally { setBusy(false); }
  }
  function toggleMic() {
    const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Speech) { inputRef.current?.focus(); return; }
    if (listening) { speechRef.current?.stop(); setListening(false); return; }
    const rec = new Speech(); speechRef.current = rec; rec.lang = "en-US"; rec.interimResults = true;
    rec.onresult = (event: any) => setDraft(Array.from(event.results).map((x: any) => x[0].transcript).join(""));
    rec.onend = () => setListening(false); rec.onerror = () => setListening(false); rec.start(); setListening(true);
  }
  const commands = [
    { label: "Start a new conversation", hint: "Create", action: () => { createNewConversation(); setPaletteOpen(false); } },
    { label: "Open memories", hint: "Navigate", action: () => { setActiveTab("memories"); setPaletteOpen(false); } },
    { label: "Open chats", hint: "Navigate", action: () => { setActiveTab("chats"); setPaletteOpen(false); } },
    { label: autoSpeak ? "Turn voice replies off" : "Turn voice replies on", hint: "Settings", action: () => { setAutoSpeak(v => !v); setPaletteOpen(false); } }
  ].filter(x => x.label.toLowerCase().includes(paletteQuery.toLowerCase()));

  return <div className="friday-shell">
    {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />}
    <aside className={"friday-sidebar " + (sidebarOpen ? "sidebar-open" : "")}>
      <div className="brand-row"><div className="brand-mark"><img src="/friday-reactor.svg" alt="" aria-hidden="true" /></div><div className="brand-copy"><strong>FRIDAY</strong><span>PERSONAL INTELLIGENCE</span></div><button className="icon-button mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={17}/></button></div>
      <button className="new-chat-button" onClick={createNewConversation}><Plus size={17}/> New conversation <span>⌘ N</span></button>
      <div className="side-tabs"><button className={activeTab === "chats" ? "selected" : ""} onClick={() => setActiveTab("chats")}><MessageSquare size={15}/> Chats</button><button className={activeTab === "memories" ? "selected" : ""} onClick={() => setActiveTab("memories")}><Brain size={15}/> Memory <span>{memories.length}</span></button></div>
      {activeTab === "chats" ? <section className="side-section"><div className="section-label">RECENT</div><div className="conversation-list">{conversations.map(c => <div key={c.id} onClick={() => selectConversation(c.id)} className={"conversation-item " + (activeConvId === c.id ? "active" : "")}><MessageSquare size={14}/><span>{c.title}</span><button onClick={e => deleteConversation(c.id, e)} aria-label="Delete conversation"><Trash2 size={14}/></button></div>)}{!conversations.length && <p className="quiet-empty">Your conversations will appear here.</p>}</div></section> : <section className="side-section memory-section"><div className="section-label">MEMORY BANK</div><form className="memory-form" onSubmit={addMemory}><textarea value={newMemory} onChange={e => setNewMemory(e.target.value)} placeholder="Something Friday should remember…" rows={3}/><button type="submit"><Plus size={14}/> Save memory</button></form><div className="memory-list">{memories.map(m => <div className="memory-card" key={m.id}><p>{m.memory}</p><button onClick={() => removeMemory(m.id)} aria-label="Remove memory"><Trash2 size={13}/></button></div>)}</div></section>}
      <div className="sidebar-bottom"><div className="status-dot"/><div><strong>Friday is ready</strong><span>All systems available</span></div><button className="icon-button" onClick={() => setPaletteOpen(true)} aria-label="Settings and commands"><Settings2 size={16}/></button></div>
    </aside>
    <main className="friday-main">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar"><Menu size={19}/></button><div className="breadcrumb">Workspace <span>/</span> <b>{activeTab === "chats" ? "Assistant" : "Memory"}</b></div></div><div className="topbar-actions"><button className="command-trigger" onClick={() => setPaletteOpen(true)}><Search size={14}/> <span>Quick actions</span><kbd>⌘ K</kbd></button><div className="top-status"><span className="status-dot"/><span>Online</span></div><button className={"voice-toggle " + (autoSpeak ? "voice-on" : "")} onClick={() => setAutoSpeak(v => !v)} title="Toggle automatic voice replies">{autoSpeak ? <Volume2 size={16}/> : <VolumeX size={16}/>}</button></div></header>
      <div className="chat-scroll"><div className="chat-content">
        {messages.length <= 1 && messages[0]?.id === "welcome" ? <div className="welcome-screen">
          <div className="orb-wrap"><div className="orb-glow"/><div className="voice-orb"><div className="orb-core"/><span className="orb-wave wave-one"/><span className="orb-wave wave-two"/><span className="orb-wave wave-three"/></div><div className="orb-caption"><span className="status-dot"/> READY TO ASSIST</div></div>
          <div className="welcome-copy"><div className="eyebrow"><Sparkles size={13}/> YOUR PERSONAL INTELLIGENCE</div><h1>What’s on your <em>mind?</em></h1><p>Think out loud. Get clarity. Make your next move.</p></div>
          <div className="starter-grid">{starters.map(s => <button key={s.title} className="starter-card" onClick={() => { setDraft(s.prompt); inputRef.current?.focus(); }}><div className="starter-icon"><s.icon size={17}/></div><div><strong>{s.title}</strong><span>{s.prompt}</span></div><ArrowUpRight size={15} className="starter-arrow"/></button>)}</div>
        </div> : <div className="message-stack">{messages.map(m => <article key={m.id} className={"message-row " + (m.role === "user" ? "user-row" : "")}>{m.role === "assistant" && <div className="assistant-avatar"><AudioLines size={15}/></div>}<div className={"message-bubble " + (m.role === "user" ? "user-bubble" : "assistant-bubble")}><div className="message-meta">{m.role === "user" ? "YOU" : "FRIDAY"}{m.role === "assistant" && <button onClick={() => speakMessage(m)} title="Read aloud" className={speakingId === m.id ? "speaking" : ""}><Volume2 size={14}/></button>}</div><div className="message-text">{m.content}</div></div></article>)}{busy && <div className="message-row"><div className="assistant-avatar"><AudioLines size={15}/></div><div className="typing-bubble"><span/><span/><span/></div></div>}<div ref={listEndRef}/></div>}
      </div></div>
      <div className="composer-area"><div className="composer-shell"><textarea ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Message Friday…" maxLength={4000} rows={1} disabled={busy}/><div className="composer-tools"><div className="composer-hint"><span>↵</span> to send <span className="hint-divider">·</span> shift + ↵ for new line</div><div className="composer-actions"><button className={"mic-button " + (listening ? "listening" : "")} onClick={toggleMic} aria-label={listening ? "Stop voice input" : "Start voice input"} title="Voice input">{listening ? <MicOff size={16}/> : <Mic size={16}/>}</button><button className="send-button" onClick={() => send()} disabled={busy || !draft.trim()} aria-label="Send message">{busy ? <Loader2 size={17} className="spin"/> : <Send size={16}/>}</button></div></div></div><div className="composer-footnote"><span><Sparkles size={11}/> Friday can make mistakes. Check important details.</span><span>PRIVATE WORKSPACE</span></div></div>
    </main>
    {paletteOpen && <div className="palette-overlay" onClick={() => setPaletteOpen(false)}><div className="command-palette" onClick={e => e.stopPropagation()}><div className="palette-search"><Search size={17}/><input autoFocus placeholder="What would you like to do?" value={paletteQuery} onChange={e => setPaletteQuery(e.target.value)}/><kbd>ESC</kbd></div><div className="palette-label">QUICK ACTIONS</div>{commands.map(c => <button key={c.label} className="palette-item" onClick={c.action}><Command size={15}/><span>{c.label}</span><small>{c.hint}</small></button>)}<div className="palette-footer"><span>Navigate with your keyboard</span><span><kbd>↵</kbd> Select</span></div></div></div>}
  </div>;
}
