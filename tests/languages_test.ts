import {
  languages,
  languageCodes,
  filterLanguages,
  isRtlLanguage,
} from "../src/languages.ts";
import { supportedLanguages } from "../supabase/functions/translate/validation.ts";
function assert(value: unknown, message: string) {
  if (!value) throw new Error(message);
}
Deno.test(
  "exactly 30 client languages match the backend allowlist and voice locales",
  () => {
    assert(languageCodes.length === 30, "Expected 30 languages");
    assert(
      JSON.stringify([...languageCodes].sort()) ===
        JSON.stringify([...supportedLanguages].sort()),
      "Client/server mismatch",
    );
    for (const code of languageCodes)
      assert(
        /^[a-z]{2}-[A-Z]{2}$/.test(languages[code].locale),
        `Bad voice locale: ${code}`,
      );
    assert(
      !languageCodes.includes("ml" as never),
      "Malayalam must remain removed",
    );
  },
);
Deno.test("language search matches English, native names and accents", () => {
  assert(filterLanguages("  French ").includes("fr"), "English name");
  assert(filterLanguages("日本語").includes("ja"), "Japanese native name");
  assert(filterLanguages("العربية").includes("ar"), "Arabic native name");
  assert(filterLanguages("portugues").includes("pt"), "Accent insensitive");
  assert(filterLanguages("zzzz").length === 0, "Empty search result");
  assert(filterLanguages("").length === 30, "All languages");
});
Deno.test(
  "Arabic, Hebrew and Persian use RTL without changing the English interface",
  () => {
    for (const code of ["ar", "he", "fa"]) assert(isRtlLanguage(code), code);
    for (const code of ["en", "hi", "zh", "hy"])
      assert(!isRtlLanguage(code), code);
  },
);
