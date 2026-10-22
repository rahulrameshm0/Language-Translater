import { voicePreference } from "../src/voicePreference.ts";
Deno.test(
  "conversation prioritizes installed enhanced voices over default and novelty voices",
  () => {
    const base = {
      name: "English",
      identifier: "english",
      language: "en-US",
      quality: "Default",
    };
    const score = voicePreference(base, "en-US");
    if (voicePreference({ ...base, quality: "Enhanced" }, "en-US") <= score)
      throw new Error("Enhanced voice should be preferred");
    if (voicePreference({ ...base, name: "English neural" }, "en-US") <= score)
      throw new Error("Neural voice should be preferred");
    if (
      voicePreference(
        { ...base, name: "Robot", quality: "Enhanced" },
        "en-US",
      ) >= score
    )
      throw new Error(
        "Novelty voices should not be the conversational default",
      );
    if (voicePreference({ ...base, language: "en-GB" }, "en-US") >= score)
      throw new Error("Prefer exact locale within the same quality");
  },
);
