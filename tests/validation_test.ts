import { validate } from "../supabase/functions/translate/validation.ts";
function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
Deno.test("all twelve language directions accept Unicode text", () => {
  for (const sourceLanguage of ["en", "es", "hy", "de"])
    for (const targetLanguage of ["en", "es", "hy", "de"])
      if (sourceLanguage !== targetLanguage) {
        const input = validate({
          text: "Hello español Հայերեն 👋",
          sourceLanguage,
          targetLanguage,
        });
        assert(input.text?.includes("Հայերեն"));
      }
});
Deno.test("rejects empty, oversized, same and unsupported languages", () => {
  for (const body of [
    null,
    {},
    { text: "  ", sourceLanguage: "en", targetLanguage: "hy" },
    { text: "a".repeat(5001), sourceLanguage: "en", targetLanguage: "hy" },
    { text: "Hi", sourceLanguage: "en", targetLanguage: "en" },
    { text: "Hi", sourceLanguage: "fr", targetLanguage: "hy" },
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
      targetLanguage: "hy",
    }).text?.length === 10000,
  );
});

Deno.test(
  "valid audio accepts only supported recording formats and bounded base64",
  () => {
    validate({
      audioBase64: "QUFBQQ==",
      mimeType: "audio/mp4",
      sourceLanguage: "hy",
      targetLanguage: "de",
    });
    for (const input of [
      { audioBase64: "not valid", mimeType: "audio/mp4" },
      { audioBase64: "QUFBQQ==", mimeType: "text/plain" },
      { audioBase64: "A".repeat(2800004), mimeType: "audio/mp4" },
      { audioBase64: "QUFBQQ==", mimeType: "audio/mp4", text: "Hello" },
    ]) {
      let rejected = false;
      try {
        validate({ ...input, sourceLanguage: "en", targetLanguage: "hy" });
      } catch {
        rejected = true;
      }
      assert(rejected);
    }
    let removed = false;
    try {
      validate({ text: "Hello", sourceLanguage: "en", targetLanguage: "ml" });
    } catch {
      removed = true;
    }
    assert(removed);
  },
);
