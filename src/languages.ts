export const languages = {
  en: {
    name: "English",
    native: "English",
    locale: "en-US",
    short: "EN",
  },
  es: {
    name: "Spanish",
    native: "Español",
    locale: "es-ES",
    short: "ES",
  },
  hy: {
    name: "Armenian",
    native: "Հայերեն",
    locale: "hy-AM",
    short: "HY",
  },
  de: {
    name: "German",
    native: "Deutsch",
    locale: "de-DE",
    short: "DE",
  },
  fr: {
    name: "French",
    native: "Français",
    locale: "fr-FR",
    short: "FR",
  },
  it: {
    name: "Italian",
    native: "Italiano",
    locale: "it-IT",
    short: "IT",
  },
  pt: {
    name: "Portuguese",
    native: "Português",
    locale: "pt-BR",
    short: "PT",
  },
  ru: {
    name: "Russian",
    native: "Русский",
    locale: "ru-RU",
    short: "RU",
  },
  uk: {
    name: "Ukrainian",
    native: "Українська",
    locale: "uk-UA",
    short: "UK",
  },
  pl: {
    name: "Polish",
    native: "Polski",
    locale: "pl-PL",
    short: "PL",
  },
  nl: {
    name: "Dutch",
    native: "Nederlands",
    locale: "nl-NL",
    short: "NL",
  },
  sv: {
    name: "Swedish",
    native: "Svenska",
    locale: "sv-SE",
    short: "SV",
  },
  no: {
    name: "Norwegian",
    native: "Norsk",
    locale: "nb-NO",
    short: "NO",
  },
  da: {
    name: "Danish",
    native: "Dansk",
    locale: "da-DK",
    short: "DA",
  },
  fi: {
    name: "Finnish",
    native: "Suomi",
    locale: "fi-FI",
    short: "FI",
  },
  el: {
    name: "Greek",
    native: "Ελληνικά",
    locale: "el-GR",
    short: "EL",
  },
  tr: {
    name: "Turkish",
    native: "Türkçe",
    locale: "tr-TR",
    short: "TR",
  },
  ar: {
    name: "Arabic",
    native: "العربية",
    locale: "ar-SA",
    short: "AR",
  },
  he: {
    name: "Hebrew",
    native: "עברית",
    locale: "he-IL",
    short: "HE",
  },
  fa: {
    name: "Persian",
    native: "فارسی",
    locale: "fa-IR",
    short: "FA",
  },
  hi: {
    name: "Hindi",
    native: "हिन्दी",
    locale: "hi-IN",
    short: "HI",
  },
  bn: {
    name: "Bengali",
    native: "বাংলা",
    locale: "bn-BD",
    short: "BN",
  },
  ta: {
    name: "Tamil",
    native: "தமிழ்",
    locale: "ta-IN",
    short: "TA",
  },
  te: {
    name: "Telugu",
    native: "తెలుగు",
    locale: "te-IN",
    short: "TE",
  },
  kn: {
    name: "Kannada",
    native: "ಕನ್ನಡ",
    locale: "kn-IN",
    short: "KN",
  },
  ja: {
    name: "Japanese",
    native: "日本語",
    locale: "ja-JP",
    short: "JA",
  },
  ko: {
    name: "Korean",
    native: "한국어",
    locale: "ko-KR",
    short: "KO",
  },
  zh: {
    name: "Chinese",
    native: "中文",
    locale: "zh-CN",
    short: "ZH",
  },
  id: {
    name: "Indonesian",
    native: "Bahasa Indonesia",
    locale: "id-ID",
    short: "ID",
  },
  vi: {
    name: "Vietnamese",
    native: "Tiếng Việt",
    locale: "vi-VN",
    short: "VI",
  },
} as const;
export type Language = keyof typeof languages;
export const languageName = (code: string) =>
  code === "ml"
    ? "Malayalam (previous version)"
    : (languages[code as Language]?.name ?? code);
export const isLanguage = (code: string): code is Language =>
  Object.prototype.hasOwnProperty.call(languages, code);
export type Translation = {
  input_kind?: "text" | "voice" | "document" | "recording" | "call";
  source_name?: string | null;
  id: string;
  source_language: string;
  target_language: string;
  original_text: string;
  translated_text: string;
  created_at: string;
};

export const languageCodes = Object.keys(languages) as Language[];
export const isRtlLanguage = (code: string) =>
  ["ar", "he", "fa"].includes(code);
const searchable = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
export function filterLanguages(query: string): Language[] {
  const needle = searchable(query.trim());
  return languageCodes.filter((code) =>
    searchable(
      `${languages[code].name} ${languages[code].native} ${code}`,
    ).includes(needle),
  );
}
