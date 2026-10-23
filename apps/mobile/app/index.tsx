import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";

type Message = { id: string; role: "user" | "assistant"; content: string };
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
const ideas = [
  { symbol: "✳", title: "Explain something", detail: "Make a tricky topic easy to understand", prompt: "Explain a difficult topic in simple steps." },
  { symbol: "↗", title: "Write anything", detail: "Draft, rewrite, or polish your words", prompt: "Help me write a clear and engaging message." },
  { symbol: "⌘", title: "Build with code", detail: "Think through a project or fix a bug", prompt: "Help me plan and build a coding project." },
  { symbol: "◇", title: "Think it through", detail: "Explore options and find a solution", prompt: "Help me brainstorm ideas and compare options." },
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => { if (messages.length) listRef.current?.scrollToEnd({ animated: true }); }, [messages.length, busy]);

  async function send(text?: string) {
    const content = (text ?? draft).trim();
    if (!content || busy) return;
    const userMessage: Message = { id: String(Date.now()), role: "user", content };
    const next = [...messages, userMessage];
    setMessages(next); setDraft(""); setMenuOpen(false); setBusy(true);
    try {
      const response = await fetch(`${API_URL}/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content: value }) => ({ role, content: value })) }),
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data: { reply: string } = await response.json();
      setMessages(prev => [...prev, { id: `${Date.now()}-assistant`, role: "assistant", content: data.reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { id: `${Date.now()}-error`, role: "assistant", content: `I couldn't connect to Friday's API. Check your server and EXPO_PUBLIC_API_URL.\n\n${String(error)}` }]);
    } finally { setBusy(false); }
  }

  function newChat() { setMessages([]); setDraft(""); setMenuOpen(false); }

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#212121" />
      <View style={s.header}>
        <Pressable onPress={() => setMenuOpen(v => !v)} style={s.headerButton} accessibilityRole="button" accessibilityLabel="Toggle menu">
          <View style={s.hamburger}><View style={s.hamburgerLine}/><View style={s.hamburgerLine}/><View style={[s.hamburgerLine, { width: 13 }]}/></View>
        </Pressable>
        <Pressable onPress={() => setMenuOpen(false)} style={s.headerTitle}>
          <Text style={s.brand}>Friday</Text><Text style={s.brandChevron}>⌄</Text>
        </Pressable>
        <Pressable onPress={newChat} style={s.headerButton} accessibilityRole="button" accessibilityLabel="New chat">
          <Text style={s.newIcon}>＋</Text>
        </Pressable>
      </View>

      {menuOpen ? <View style={s.menu}>
        <Pressable onPress={newChat} style={s.menuNew}><Text style={s.menuPlus}>＋</Text><Text style={s.menuText}>New chat</Text></Pressable>
        <Text style={s.menuSection}>YOUR ASSISTANT</Text>
        <View style={s.menuInfo}><View style={s.miniMark}><Text style={s.miniMarkText}>✳</Text></View><View><Text style={s.menuInfoTitle}>Friday AI</Text><Text style={s.menuInfoSub}>Your personal assistant</Text></View></View>
        <Text style={s.menuFoot}>Chat history will be available here in a future update.</Text>
      </View> : null}

      {messages.length === 0 ? (
        <ScrollView contentContainerStyle={s.welcome} keyboardShouldPersistTaps="handled">
          <View style={s.heroMark}><Text style={s.heroMarkText}>✳</Text></View>
          <Text style={s.greeting}>Good to see you.</Text>
          <Text style={s.question}>What can I help with?</Text>
          <Text style={s.subGreeting}>Ask a question, explore an idea, or make something great.</Text>
          <View style={s.cards}>
            {ideas.map(item => <Pressable key={item.title} onPress={() => send(item.prompt)} style={({ pressed }) => [s.ideaCard, pressed && s.pressed]}>
              <View style={s.ideaTop}><Text style={s.ideaSymbol}>{item.symbol}</Text><Text style={s.ideaArrow}>↗</Text></View>
              <Text style={s.ideaTitle}>{item.title}</Text><Text style={s.ideaDetail}>{item.detail}</Text>
            </Pressable>)}
          </View>
        </ScrollView>
      ) : (
        <FlatList ref={listRef} style={s.list} contentContainerStyle={s.messages} data={messages} keyExtractor={item => item.id} keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => item.role === "user" ? (
            <View style={s.userRow}><View style={s.userBubble}><Text style={s.userText}>{item.content}</Text></View></View>
          ) : (
            <View style={s.aiRow}><View style={s.aiMark}><Text style={s.aiMarkText}>✳</Text></View><View style={s.aiContent}><Text style={s.aiName}>Friday</Text><Text style={s.aiText}>{item.content}</Text></View></View>
          )}
          ListFooterComponent={busy ? <View style={s.thinking}><View style={s.aiMark}><Text style={s.aiMarkText}>✳</Text></View><ActivityIndicator size="small" color="#b8b8b8"/><Text style={s.thinkingText}>Thinking</Text></View> : null}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.composerArea}>
          <View style={s.composer}>
            <TextInput value={draft} onChangeText={setDraft} placeholder="Message Friday" placeholderTextColor="#9b9b9b" style={s.input} multiline maxLength={4000} editable={!busy} accessibilityLabel="Message Friday" />
            <View style={s.composerBottom}>
              <Text style={s.disclaimer}>Friday may make mistakes. Verify important information.</Text>
              <Pressable onPress={() => send()} disabled={!draft.trim() || busy} style={({ pressed }) => [s.sendButton, (!draft.trim() || busy) && s.sendDisabled, pressed && s.pressed]} accessibilityRole="button" accessibilityLabel="Send message">
                <Text style={s.sendArrow}>↑</Text>
              </Pressable>
            </View>
          </View>
          <Text style={s.footer}>Made for your everyday ideas</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#212121" },
  header: { height: 56, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#303030" },
  headerButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  hamburger: { width: 20, gap: 4 },
  hamburgerLine: { height: 2, width: 18, borderRadius: 1, backgroundColor: "#e5e5e5" },
  headerTitle: { flexDirection: "row", alignItems: "center", gap: 6 },
  brand: { color: "#f5f5f5", fontSize: 19, fontWeight: "700", letterSpacing: -0.5 },
  brandChevron: { color: "#9b9b9b", fontSize: 17, marginTop: -4 },
  newIcon: { color: "#e7e7e7", fontSize: 28, fontWeight: "300", marginTop: -3 },
  welcome: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24 },
  heroMark: { alignSelf: "center", height: 58, width: 58, borderRadius: 29, borderWidth: 1, borderColor: "#454545", backgroundColor: "#292929", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  heroMarkText: { color: "#f2f2f2", fontSize: 31 },
  greeting: { color: "#9c9c9c", fontSize: 20, fontWeight: "500", textAlign: "center", letterSpacing: -0.3 },
  question: { color: "#f5f5f5", fontSize: 29, lineHeight: 37, fontWeight: "600", textAlign: "center", letterSpacing: -0.9, marginTop: 5 },
  subGreeting: { color: "#a3a3a3", fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 12, marginBottom: 30, paddingHorizontal: 8 },
  cards: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  ideaCard: { width: "48%", flexGrow: 1, minHeight: 137, borderWidth: 1, borderColor: "#424242", borderRadius: 17, backgroundColor: "#2b2b2b", padding: 14 },
  ideaTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  ideaSymbol: { color: "#ededed", fontSize: 20 },
  ideaArrow: { color: "#858585", fontSize: 16 },
  ideaTitle: { color: "#f1f1f1", fontSize: 14, fontWeight: "600", marginBottom: 6 },
  ideaDetail: { color: "#a1a1a1", fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.7 },
  list: { flex: 1 },
  messages: { paddingHorizontal: 17, paddingTop: 22, paddingBottom: 26, gap: 25 },
  userRow: { alignItems: "flex-end" },
  userBubble: { maxWidth: "88%", backgroundColor: "#303030", borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12 },
  userText: { color: "#f4f4f4", fontSize: 16, lineHeight: 24 },
  aiRow: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  aiMark: { width: 29, height: 29, borderRadius: 15, backgroundColor: "#303030", borderColor: "#4b4b4b", borderWidth: 1, alignItems: "center", justifyContent: "center" },
  aiMarkText: { color: "#f0f0f0", fontSize: 17 },
  aiContent: { flex: 1, paddingTop: 3 },
  aiName: { color: "#f5f5f5", fontSize: 14, fontWeight: "700", marginBottom: 8 },
  aiText: { color: "#e7e7e7", fontSize: 16, lineHeight: 25 },
  thinking: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 8 },
  thinkingText: { color: "#9d9d9d", fontSize: 13 },
  composerArea: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: Platform.OS === "android" ? 8 : 5, backgroundColor: "#212121" },
  composer: { backgroundColor: "#2f2f2f", borderWidth: 1, borderColor: "#454545", borderRadius: 25, paddingHorizontal: 13, paddingTop: 13, paddingBottom: 8, minHeight: 106 },
  input: { color: "#f5f5f5", fontSize: 16, lineHeight: 22, minHeight: 31, maxHeight: 115, paddingHorizontal: 2, paddingTop: 0, paddingBottom: 4 },
  composerBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  disclaimer: { color: "#8f8f8f", fontSize: 9, flex: 1, paddingRight: 8 },
  sendButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f1f1f1", alignItems: "center", justifyContent: "center" },
  sendDisabled: { backgroundColor: "#666666" },
  sendArrow: { color: "#202020", fontSize: 25, fontWeight: "700", marginTop: -3 },
  footer: { textAlign: "center", color: "#777777", fontSize: 10, marginTop: 7 },
  menu: { position: "absolute", zIndex: 10, top: 56, bottom: 0, left: 0, width: "82%", maxWidth: 330, backgroundColor: "#171717", borderRightWidth: 1, borderRightColor: "#3b3b3b", paddingHorizontal: 15, paddingTop: 17 },
  menuNew: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#454545", borderRadius: 12, paddingVertical: 13, paddingHorizontal: 13 },
  menuPlus: { color: "#f1f1f1", fontSize: 22 },
  menuText: { color: "#f1f1f1", fontSize: 14, fontWeight: "600" },
  menuSection: { color: "#8c8c8c", fontSize: 10, letterSpacing: 1.2, marginTop: 28, marginBottom: 13, marginLeft: 3 },
  menuInfo: { flexDirection: "row", alignItems: "center", gap: 10, padding: 9 },
  miniMark: { width: 35, height: 35, borderRadius: 18, backgroundColor: "#383838", alignItems: "center", justifyContent: "center" },
  miniMarkText: { color: "#f5f5f5", fontSize: 19 },
  menuInfoTitle: { color: "#f0f0f0", fontSize: 13, fontWeight: "600" },
  menuInfoSub: { color: "#999999", fontSize: 11, marginTop: 3 },
  menuFoot: { color: "#858585", fontSize: 12, lineHeight: 18, marginTop: 16, paddingHorizontal: 8 },
});
