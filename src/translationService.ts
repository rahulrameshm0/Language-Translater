import { supabase } from "./supabase";
import { Language } from "./languages";
export async function translatePhrase(
  text: string,
  sourceLanguage: Language,
  targetLanguage: Language,
  sourceName = "Speaking practice",
) {
  if (sourceLanguage === targetLanguage)
    return { translatedText: text, warning: null };
  const { data, error } = await supabase.functions.invoke("translate", {
    body: {
      text,
      sourceLanguage,
      targetLanguage,
      inputKind: "voice",
      sourceName,
    },
  });
  if (error) {
    let message = "Translation failed. Check your connection and try again.";
    if (error.context instanceof Response) {
      const body = await error.context.json().catch(() => null);
      message = body?.error ?? message;
    }
    throw new Error(message);
  }
  if (typeof data?.translatedText !== "string" || !data.translatedText.trim())
    throw new Error("No translation received. Try again.");
  return {
    translatedText: data.translatedText as string,
    warning: data.warning as string | null,
  };
}
