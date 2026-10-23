import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from "react-native";

type Message = { id: string; role: "user" | "assistant"; content: string };
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
const starterPrompts = [
  { icon: "✦", title: "Help me learn", prompt: "Explain a difficult topic in simple steps." },
  { icon: "⌘", title: "Write something", prompt: "Help me write a clear, well-structured message." },
  { icon: "⌁", title: "Explore an idea", prompt: "Help me brainstorm a few creative ideas." },
  { icon: "⟡", title: "Help me code", prompt: "Help me plan and debug a coding project." },
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    if (messages.length) listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length, busy]);

  async function send(textOverride?: string) {
    const content = (textOverride ?? draft).trim();
    if (!content || busy) return;
    const userMessage: Message = { id: `${Date.now()}`, role: "user", content };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setHistoryOpen(false);
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.map(({ role, content: text }) => ({ role, content: text })) }),
      });
      if (!response.ok) throw new Error(`API error (${response.status})`);
      const data: { reply: string } = await response.json();
      setMessages((prev) => [...prev, { id: `${Date.now()}-reply`, role: "assistant", content: data.reply }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          content: `I couldn't connect to Friday's API. Please check that the server is running and EXPO_PUBLIC_API_URL is set correctly.\n\nDetails: ${String(error)}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function newChat() {
    setMessages([]);
    setDraft("");
    setHistoryOpen(false);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#212121" />
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open chat menu"
          onPress={() => setHistoryOpen((open) => !open)}
          style={styles.headerIcon}
        >
          <Text style={styles.menuGlyph}>☰</Text>
        </Pressable>
        <Pressable style={styles.titleButton} onPress={() => setHistoryOpen(false)}>
          <Text style={styles.brand}>Friday</Text>
          <Text style={styles.chevron}>⌄</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Start a new chat" onPress={newChat} style={styles.headerIcon}>
          <Text style={styles.newChatGlyph}>＋</Text>
        </Pressable>
      </View>

      {historyOpen ? (
        <View style={styles.historyPanel}>
          <Pressable onPress={newChat} style={styles.historyNewChat}>
            <Text style={styles.historyNewChatText}>＋   New chat</Text>
          </Pressable>
          <Text style={styles.historyLabel}>RECENT</Text>
          {messages.length > 0 ? (
            <Pressable style={styles.historyItem} onPress={() => setHistoryOpen(false)}>
              <Text style={styles.historyItemText} numberOfLines={1}>
                {messages.find((item) => item.role === "user")?.content ?? "Current conversation"}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.historyEmpty}>Your conversations will appear here.</Text>
          )}
          <View style={styles.historyFooter}>
            <View style={styles.avatar}><Text style={styles.avatarText}>F</Text></View>
            <View><Text style={styles.footerName}>Friday AI</Text><Text style={styles.footerCaption}>Your personal assistant</Text></View>
          </View>
        </View>
      ) : null}

      {messages.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.welcomeContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.sparkle}><Text style={styles.sparkleText}>✳</Text></View>
          <Text style={styles.greeting}>What can I help with?</Text>
          <Text style={styles.welcomeSub}>Ask anything. Let's figure it out together.</Text>
          <View style={styles.promptGrid}>
            {starterPrompts.map((item) => (
              <Pressable key={item.title} onPress={() => send(item.prompt)} style={({ pressed }) => [styles.promptCard, pressed && styles.pressed]}>
                <Text style={styles.promptIcon}>{item.icon}</Text>
                <Text style={styles.promptTitle}>{item.title}</Text>
                <Text style={styles.promptDescription} numberOfLines={2}>{item.prompt}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          ref={listRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={messages}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={styles.messageBlock}>
              {item.role === "user" ? (
                <View style={styles.userBubble}><Text style={styles.userMessage}>{item.content}</Text></View>
              ) : (
                <View style={styles.assistantRow}>
                  <View style={styles.assistantAvatar}><Text style={styles.assistantAvatarText}>✳</Text></View>
                  <View style={styles.assistantBody}>
                    <Text style={styles.assistantName}>Friday</Text>
                    <Text style={styles.assistantMessage}>{item.content}</Text>
                  </View>
                </View>
              )}
            </View>
          )}
          ListFooterComponent={busy ? (
            <View style={styles.typingRow}><View style={styles.assistantAvatar}><Text style={styles.assistantAvatarText}>✳</Text></View><ActivityIndicator color="#b4b4b4" size="small" /><Text style={styles.typingText}>Friday is thinking…</Text></View>
          ) : null}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.composerWrap}>
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Message Friday"
              placeholderTextColor="#9b9b9b"
              multiline
              maxLength={4000}
              editable={!busy}
              returnKeyType="default"
              accessibilityLabel="Message Friday"
            />
            <View style={styles.composerActions}>
              <Text style={styles.modelHint}>Friday can make mistakes. Check important info.</Text>
              <Pressable
                onPress={() => send()}
                disabled={!draft.trim() || busy}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                style={({ pressed }) => [styles.sendButton, (!draft.trim() || busy) && styles.sendDisabled, pressed && styles.pressed]}
              >
                <Text style={styles.sendGlyph}>↑</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#212121" },
  topBar: { height: 58, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#2f2f2f" },
  headerIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  menuGlyph: { color: "#e5e5e5", fontSize: 21 },
  newChatGlyph: { color: "#e5e5e5", fontSize: 29, fontWeight: "300", marginTop: -2 },
  titleButton: { flexDirection: "row", alignItems: "center", gap: 7 },
  brand: { color: "#f5f5f5", fontSize: 19, fontWeight: "700", letterSpacing: -0.4 },
  chevron: { color: "#9b9b9b", fontSize: 18, marginTop: -4 },
  welcomeContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 22, paddingTop: 22, paddingBottom: 24 },
  sparkle: { alignSelf: "center", width: 54, height: 54, borderRadius: 27, borderWidth: 1, borderColor: "#414141", alignItems: "center", justifyContent: "center", marginBottom: 22 },
  sparkleText: { color: "#f0f0f0", fontSize: 29 },
  greeting: { color: "#f5f5f5", fontSize: 29, fontWeight: "600", letterSpacing: -0.9, textAlign: "center" },
  welcomeSub: { color: "#a5a5a5", fontSize: 14, textAlign: "center", marginTop: 10, marginBottom: 32 },
  promptGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  promptCard: { width: "48%", flexGrow: 1, minHeight: 126, backgroundColor: "#2b2b2b", borderColor: "#414141", borderWidth: 1, borderRadius: 17, padding: 14 },
  promptIcon: { color: "#c4c4c4", fontSize: 20, marginBottom: 10 },
  promptTitle: { color: "#eeeeee", fontWeight: "600", fontSize: 14, marginBottom: 5 },
  promptDescription: { color: "#9f9f9f", fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.72 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 17, paddingTop: 22, paddingBottom: 24, gap: 24 },
  messageBlock: { width: "100%" },
  userBubble: { alignSelf: "flex-end", maxWidth: "88%", backgroundColor: "#303030", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 22 },
  userMessage: { color: "#f4f4f4", fontSize: 16, lineHeight: 24 },
  assistantRow: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  assistantAvatar: { width: 29, height: 29, borderRadius: 15, backgroundColor: "#303030", borderWidth: 1, borderColor: "#484848", alignItems: "center", justifyContent: "center" },
  assistantAvatarText: { color: "#f0f0f0", fontSize: 17 },
  assistantBody: { flex: 1, paddingTop: 2 },
  assistantName: { color: "#f5f5f5", fontSize: 14, fontWeight: "700", marginBottom: 8 },
  assistantMessage: { color: "#e6e6e6", fontSize: 16, lineHeight: 25 },
  typingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 8 },
  typingText: { color: "#a0a0a0", fontSize: 13 },
  composerWrap: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: Platform.OS === "android" ? 10 : 7, backgroundColor: "#212121" },
  composer: { backgroundColor: "#2f2f2f", borderRadius: 26, borderWidth: 1, borderColor: "#414141", paddingTop: 13, paddingBottom: 8, paddingHorizontal: 13, minHeight: 112 },
  input: { color: "#f5f5f5", fontSize: 16, lineHeight: 22, maxHeight: 120, minHeight: 31, paddingTop: 0, paddingBottom: 4, paddingHorizontal: 2 },
  composerActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 5 },
  modelHint: { color: "#8d8d8d", fontSize: 10, flex: 1, paddingRight: 8 },
  sendButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f2f2f2", alignItems: "center", justifyContent: "center" },
  sendDisabled: { backgroundColor: "#676767" },
  sendGlyph: { color: "#1f1f1f", fontSize: 25, fontWeight: "600", marginTop: -3 },
  historyPanel: { ...StyleSheet.absoluteFillObject, top: 58, zIndex: 5, backgroundColor: "#171717", paddingHorizontal: 17, paddingTop: 18 },
  historyNewChat: { borderWidth: 1, borderColor: "#454545", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14 },
  historyNewChatText: { color: "#f1f1f1", fontSize: 15, fontWeight: "600" },
  historyLabel: { color: "#8d8d8d", fontSize: 11, letterSpacing: 1.2, marginTop: 28, marginBottom: 12, marginLeft: 4 },
  historyItem: { padding: 12, borderRadius: 10, backgroundColor: "#292929" },
  historyItemText: { color: "#e3e3e3", fontSize: 14 },
  historyEmpty: { color: "#8f8f8f", fontSize: 13, paddingHorizontal: 4, lineHeight: 19 },
  historyFooter: { position: "absolute", left: 17, right: 17, bottom: 22, borderTopWidth: 1, borderTopColor: "#333333", paddingTop: 16, flexDirection: "row", alignItems: "center", gap: 11 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#4a4a4a", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  footerName: { color: "#f0f0f0", fontSize: 14, fontWeight: "600" },
  footerCaption: { color: "#939393", fontSize: 12, marginTop: 2 },
});
