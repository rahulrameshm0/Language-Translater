export const languages = {
  en: { name: "English", native: "English", locale: "en-US", short: "EN" },
  es: { name: "Spanish", native: "Español", locale: "es-ES", short: "ES" },
  hy: { name: "Armenian", native: "Հայերեն", locale: "hy-AM", short: "HY" },
  de: { name: "German", native: "Deutsch", locale: "de-DE", short: "DE" },
} as const;
export type Language = keyof typeof languages;
export const languageName = (code: string) =>
  code === "ml"
    ? "Malayalam (previous version)"
    : (languages[code as Language]?.name ?? code);
export const isLanguage = (code: string): code is Language =>
  Object.prototype.hasOwnProperty.call(languages, code);
export type Translation = {
  id: string;
  source_language: string;
  target_language: string;
  original_text: string;
  translated_text: string;
  created_at: string;
};
