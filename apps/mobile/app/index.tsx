import React, { useState } from "react";
import { SafeAreaView, View, Text, TextInput, Pressable, FlatList, ActivityIndicator, StyleSheet } from "react-native";

type Message = { id: string; role: "user" | "assistant"; content: string };
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", content: "Hello. I'm Friday. What can I help you with?" }
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const content = draft.trim();
    if (!content || busy) return;
    const userMessage: Message = { id: `${Date.now()}`, role: "user", content };
    setMessages(prev => [...prev, userMessage]);
    setDraft("");
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage].map(({ role, content }) => ({ role, content })) })
      });
      if (!response.ok) throw new Error(`API error (${response.status})`);
      const data: { reply: string } = await response.json();
      setMessages(prev => [...prev, { id: `${Date.now()}-reply`, role: "assistant", content: data.reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { id: `${Date.now()}-error`, role: "assistant", content: `I couldn't reach Friday's API. Check the API URL and server. ${String(e)}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>FRIDAY</Text>
        <Text style={styles.subtitle}>Personal AI assistant</Text>
      </View>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.assistantBubble]}>
            <Text style={styles.role}>{item.role === "user" ? "YOU" : "FRIDAY"}</Text>
            <Text style={styles.message}>{item.content}</Text>
          </View>
        )}
      />
      {busy ? <ActivityIndicator style={{ marginBottom: 8 }} /> : null}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask Friday anything…"
          placeholderTextColor="#8d94a3"
          multiline
          maxLength={4000}
          editable={!busy}
        />
        <Pressable onPress={send} style={({ pressed }) => [styles.send, pressed && { opacity: 0.7 }]} accessibilityRole="button">
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
      <Text style={styles.voiceHint}>Voice integration is the next build step; text fallback stays available.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0b1020" },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#232b40" },
  brand: { color: "#e8edff", fontSize: 23, fontWeight: "800", letterSpacing: 4 },
  subtitle: { color: "#9aa6c4", marginTop: 3 },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 12 },
  bubble: { padding: 13, borderRadius: 16, maxWidth: "88%" },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#253d70" },
  assistantBubble: { alignSelf: "flex-start", backgroundColor: "#171f33", borderWidth: 1, borderColor: "#2a3550" },
  role: { color: "#9caed7", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 5 },
  message: { color: "#f3f5ff", fontSize: 15, lineHeight: 21 },
  composer: { flexDirection: "row", alignItems: "flex-end", padding: 12, gap: 9, borderTopWidth: 1, borderTopColor: "#232b40" },
  input: { flex: 1, color: "#f3f5ff", backgroundColor: "#151d30", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, maxHeight: 130, borderWidth: 1, borderColor: "#303b56" },
  send: { backgroundColor: "#7da2ff", paddingHorizontal: 17, paddingVertical: 13, borderRadius: 13 },
  sendText: { color: "#0b1020", fontWeight: "800" },
  voiceHint: { color: "#7e8aa7", fontSize: 11, textAlign: "center", paddingBottom: 8 }
});
