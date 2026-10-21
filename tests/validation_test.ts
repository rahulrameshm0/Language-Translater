import { validate } from "../supabase/functions/translate/validation.ts";
function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
Deno.test("all six language directions accept Unicode text", () => {
  for (const sourceLanguage of ["en", "es", "ml"])
    for (const targetLanguage of ["en", "es", "ml"])
      if (sourceLanguage !== targetLanguage) {
        const input = validate({
          text: "Hello español മലയാളം 👋",
          sourceLanguage,
          targetLanguage,
        });
        assert(input.text.includes("മലയാളം"));
      }
});
Deno.test("rejects empty, oversized, same and unsupported languages", () => {
  for (const body of [
    null,
    {},
    { text: "  ", sourceLanguage: "en", targetLanguage: "ml" },
    { text: "a".repeat(5001), sourceLanguage: "en", targetLanguage: "ml" },
    { text: "Hi", sourceLanguage: "en", targetLanguage: "en" },
    { text: "Hi", sourceLanguage: "fr", targetLanguage: "ml" },
  ]) {
    let rejected = false;
    try {
      validate(body);
    } catch {
      rejected = true;
    }
    assert(rejected);
  }
});
Deno.test("character limit counts Unicode code points", () => {
  assert(
    validate({
      text: "👋".repeat(5000),
      sourceLanguage: "en",
      targetLanguage: "ml",
    }).text.length === 10000,
  );
});
