import { supabase } from "./supabase";
import { Language } from "./languages";
import { ChatMessage } from "./conversationTopics";
export async function askAssistant(
  mode: "assistant" | "speaking",
  sourceLanguage: Language,
  targetLanguage: Language,
  topic: string,
  level: string,
  messages: ChatMessage[],
  audioBase64?: string,
) {
  const { data, error } = await supabase.functions.invoke("translate", {
    body: {
      action: "assistant",
      mode,
      sourceLanguage,
      targetLanguage,
      topic,
      level,
      messages: messages.map(({ role, text }) => ({ role, text })),
      ...(audioBase64 ? { audioBase64, mimeType: "audio/mp4" } : {}),
    },
  });
  if (error) {
    let message =
      "Could not reach the assistant. Check your connection; your reply is kept.";
    if (error.context instanceof Response) {
      const body = await error.context.json().catch(() => null);
      message = body?.error ?? message;
    }
    throw new Error(message);
  }
  if (typeof data?.reply !== "string" || !data.reply.trim())
    throw new Error("No answer received. Try again.");
  return data as { reply: string; feedback: string; correction: string };
}
