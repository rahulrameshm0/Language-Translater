import { unzipSync, strFromU8 } from "fflate";
export type InputKind = "text" | "voice" | "document" | "recording" | "call";
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
export function mediaMime(name: string, kind: InputKind): string {
  const ext = name.toLowerCase().split(".").pop();
  const types: Record<string, string> =
    kind === "document"
      ? {
          pdf: "application/pdf",
          txt: "text/plain",
          docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }
      : {
          m4a: "audio/mp4",
          mp3: "audio/mpeg",
          wav: "audio/wav",
          aac: "audio/aac",
          ogg: "audio/ogg",
          flac: "audio/flac",
        };
  if (!ext || !types[ext])
    throw new Error(
      kind === "document"
        ? "Choose a PDF, DOCX or UTF-8 TXT document."
        : "Choose M4A, MP3, WAV, AAC, OGG or FLAC audio. Convert AMR recordings before importing.",
    );
  return types[ext];
}
export function validateDraft(text: string): string {
  if (!text.trim()) throw new Error("No readable text was found in this file.");
  if (text.includes("\0")) throw new Error("Use a UTF-8 text document.");
  if (Array.from(text).length > 5000)
    throw new Error(
      "This document contains more than 5,000 characters. Split it into smaller documents. No text was shortened.",
    );
  return text;
}
const xmlText = (text: string) =>
  text.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (_, entity: string) => {
      if (entity[0] === "#")
        return String.fromCodePoint(
          entity[1].toLowerCase() === "x"
            ? parseInt(entity.slice(2), 16)
            : parseInt(entity.slice(1), 10),
        );
      return (
        (
          { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<
            string,
            string
          >
        )[entity] ?? ""
      );
    },
  );
export function docxText(bytes: Uint8Array): string {
  if (bytes.length > MAX_IMPORT_BYTES)
    throw new Error("Choose a file smaller than 8 MB.");
  const entries = unzipSync(bytes, {
    filter: (file) => {
      if (file.name !== "word/document.xml") return false;
      if (
        file.originalSize > 2 * 1024 * 1024 ||
        file.originalSize / Math.max(1, file.size) > 200
      )
        throw new Error(
          "Document is too large to expand safely. Export a smaller TXT or PDF.",
        );
      return true;
    },
  });
  if (!entries["word/document.xml"])
    throw new Error(
      "This is not a supported DOCX document. Export it as PDF or TXT.",
    );
  const xml = strFromU8(entries["word/document.xml"]);
  const tokens = xml.matchAll(
    /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>|<\/w:p>/g,
  );
  let text = "";
  for (const token of tokens)
    text +=
      token[1] !== undefined
        ? xmlText(token[1])
        : token[0].startsWith("<w:tab")
          ? "\t"
          : "\n";
  return validateDraft(text.trim());
}
