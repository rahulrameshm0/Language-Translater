import {
  validateMedia,
  MAX_FILE_BYTES,
} from "../supabase/functions/translate/media.ts";
import { validate } from "../supabase/functions/translate/validation.ts";
import { docxText, mediaMime, validateDraft } from "../src/mediaFiles.ts";
import { zipSync, strToU8 } from "fflate";
function assert(value: unknown) {
  if (!value) throw new Error("Assertion failed");
}
function rejects(run: () => unknown) {
  let failed = false;
  try {
    run();
  } catch {
    failed = true;
  }
  assert(failed);
}
const pdf = {
  kind: "document",
  mimeType: "application/pdf",
  sourceLanguage: "en",
  fileBase64: btoa("%PDF-1.7\n"),
};
Deno.test("media validates content signatures, formats and limits", () => {
  assert(validateMedia(pdf).kind === "document");
  for (const input of [
    { ...pdf, fileBase64: btoa("not a PDF") },
    { ...pdf, fileBase64: "???=" },
    { ...pdf, mimeType: "application/x-executable" },
    { ...pdf, kind: "unknown" },
    { ...pdf, sourceLanguage: "zz" },
    { ...pdf, fileBase64: btoa("a".repeat(MAX_FILE_BYTES + 1)) },
  ])
    rejects(() => validateMedia(input));
  validateMedia({
    ...pdf,
    kind: "call",
    mimeType: "audio/mpeg",
    fileBase64: btoa("ID3 audio"),
  });
  validateMedia({
    ...pdf,
    kind: "recording",
    mimeType: "audio/mp4",
    fileBase64: btoa("\0\0\0\x18ftypM4A "),
  });
});
Deno.test(
  "file selection maps supported extensions and rejects AMR or legacy DOC",
  () => {
    assert(mediaMime("NOTES.DOCX", "document").includes("wordprocessingml"));
    assert(mediaMime("call.M4A", "call") === "audio/mp4");
    rejects(() => mediaMime("call.amr", "call"));
    rejects(() => mediaMime("old.doc", "document"));
  },
);
Deno.test(
  "DOCX extracts paragraphs, tabs, Unicode and XML entities without images",
  () => {
    const xml =
      "<w:document><w:body><w:p><w:r><w:t>Hello &amp; բարև</w:t><w:tab/><w:t>world</w:t></w:r></w:p><w:p><w:r><w:t>Next &#x41;</w:t></w:r></w:p></w:body></w:document>";
    assert(
      docxText(
        zipSync({
          "word/document.xml": strToU8(xml),
          "word/media/image.png": new Uint8Array([1, 2, 3]),
        }),
      ) === "Hello & բարև\tworld\nNext A",
    );
    rejects(() => docxText(zipSync({ "other.xml": strToU8(xml) })));
  },
);
Deno.test(
  "oversized document text is rejected rather than silently truncated",
  () => {
    rejects(() => validateDraft("a".repeat(5001)));
    rejects(() => validateDraft(""));
    rejects(() => validateDraft("bad\0text"));
    rejects(() =>
      docxText(
        zipSync({
          "word/document.xml": strToU8(
            "<w:t>" + "A".repeat(3 * 1024 * 1024) + "</w:t>",
          ),
        }),
      ),
    );
    assert(validateDraft("👋".repeat(5000)).length === 10000);
  },
);
Deno.test(
  "confirmed source metadata validates independently of user ownership",
  () => {
    const record = validate({
      text: "Hello",
      sourceLanguage: "en",
      targetLanguage: "es",
      inputKind: "call",
      sourceName: "Call.m4a",
    });
    assert(record.inputKind === "call" && record.sourceName === "Call.m4a");
    rejects(() =>
      validate({
        text: "Hello",
        sourceLanguage: "en",
        targetLanguage: "es",
        inputKind: "fake",
      }),
    );
    rejects(() =>
      validate({
        text: "Hello",
        sourceLanguage: "en",
        targetLanguage: "es",
        sourceName: "bad\nname",
      }),
    );
  },
);
