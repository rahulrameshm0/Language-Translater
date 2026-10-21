export function validate(body: unknown): {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
} {
  if (!body || typeof body !== "object")
    throw new Error("Provide text and two languages.");
  const { text, sourceLanguage, targetLanguage } = body as Record<
    string,
    unknown
  >;
  if (
    typeof text !== "string" ||
    !text.trim() ||
    Array.from(text).length > 5000
  )
    throw new Error("Enter between 1 and 5,000 characters.");
  if (
    !["en", "es", "ml"].includes(String(sourceLanguage)) ||
    !["en", "es", "ml"].includes(String(targetLanguage)) ||
    sourceLanguage === targetLanguage
  )
    throw new Error("Choose two different supported languages.");
  return {
    text,
    sourceLanguage: String(sourceLanguage),
    targetLanguage: String(targetLanguage),
  };
}
