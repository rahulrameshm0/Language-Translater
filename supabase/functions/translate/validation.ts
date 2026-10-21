export const supportedLanguages = [
  "en",
  "es",
  "hy",
  "de",
  "fr",
  "it",
  "pt",
  "ru",
  "uk",
  "pl",
  "nl",
  "sv",
  "no",
  "da",
  "fi",
  "el",
  "tr",
  "ar",
  "he",
  "fa",
  "hi",
  "bn",
  "ta",
  "te",
  "kn",
  "ja",
  "ko",
  "zh",
  "id",
  "vi",
] as const;
export type TranslationInput = {
  sourceLanguage: string;
  targetLanguage: string;
} & (
  | { text: string; audioBase64?: never; mimeType?: never }
  | { text?: never; audioBase64: string; mimeType: string }
);
export function validate(body: unknown): TranslationInput {
  if (!body || typeof body !== "object")
    throw new Error("Provide text or a recording and two languages.");
  const { text, audioBase64, mimeType, sourceLanguage, targetLanguage } =
    body as Record<string, unknown>;
  if (
    !(supportedLanguages as readonly string[]).includes(
      String(sourceLanguage),
    ) ||
    !(supportedLanguages as readonly string[]).includes(
      String(targetLanguage),
    ) ||
    sourceLanguage === targetLanguage
  )
    throw new Error("Choose two different supported languages.");
  const pair = {
    sourceLanguage: String(sourceLanguage),
    targetLanguage: String(targetLanguage),
  };
  if (audioBase64 !== undefined) {
    if (text !== undefined) throw new Error("Send text or audio, not both.");
    if (
      typeof audioBase64 !== "string" ||
      audioBase64.length < 4 ||
      audioBase64.length > 2800000 ||
      audioBase64.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(audioBase64)
    )
      throw new Error(
        "Recording is invalid or too large. Record up to 30 seconds.",
      );
    if (mimeType !== "audio/mp4" && mimeType !== "audio/m4a")
      throw new Error("Use an M4A voice recording.");
    return { ...pair, audioBase64, mimeType };
  }
  if (
    typeof text !== "string" ||
    !text.trim() ||
    Array.from(text).length > 5000
  )
    throw new Error("Enter between 1 and 5,000 characters.");
  return { ...pair, text };
}
