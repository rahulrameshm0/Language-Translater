export type SpeechDraft = { committed: string; partial: string };
export const emptySpeechDraft = (): SpeechDraft => ({
  committed: "",
  partial: "",
});
const join = (left: string, right: string) =>
  [left.trim(), right.trim()].filter(Boolean).join(" ");
export function speechText(draft: SpeechDraft) {
  return join(draft.committed, draft.partial);
}
export function receiveSpeech(
  draft: SpeechDraft,
  transcript: string,
  final: boolean,
): SpeechDraft {
  if (!final)
    return transcript.trim() ? { ...draft, partial: transcript } : draft;
  // Some Android engines return an empty final after a useful partial.
  return {
    committed: join(draft.committed, transcript.trim() || draft.partial),
    partial: "",
  };
}
export function finishSpeech(draft: SpeechDraft): SpeechDraft {
  return { committed: speechText(draft), partial: "" };
}
