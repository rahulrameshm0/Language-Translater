export const languages = {
  en: "English",
  es: "Español",
  ml: "മലയാളം",
} as const;
export type Language = keyof typeof languages;
export type Translation = {
  id: string;
  source_language: Language;
  target_language: Language;
  original_text: string;
  translated_text: string;
  created_at: string;
};
