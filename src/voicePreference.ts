// Prefer installed enhanced / neural voices, avoiding novelty voices for conversation.
export function voicePreference(
  voice: {
    identifier: string;
    name: string;
    quality?: string;
    language: string;
  },
  locale: string,
) {
  const name = `${voice.name} ${voice.identifier}`.toLowerCase();
  return (
    (voice.quality === "Enhanced" ? 100 : 0) +
    (/neural|natural|premium|enhanced|wavenet/.test(name) ? 60 : 0) +
    (voice.language.toLowerCase().replace("_", "-") === locale.toLowerCase()
      ? 10
      : 0) -
    (/grandma|grandpa|whisper|robot|bad news|good news|bells|boing|bubbles|trinoids|zarvox/.test(
      name,
    )
      ? 200
      : 0)
  );
}
