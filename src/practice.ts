export type SpeakingLevel = "beginner" | "growing" | "confident";
export type Scenario = "social" | "work" | "study" | "travel";
export const practicePhrases: Record<
  Scenario,
  Record<SpeakingLevel, string[]>
> = {
  social: {
    beginner: ["Hello, how are you?", "My name is Alex.", "Nice to meet you."],
    growing: [
      "What do you like to do on weekends?",
      "Would you like to have a coffee?",
      "I enjoy meeting people from different places.",
    ],
    confident: [
      "What is a tradition from your hometown that you enjoy?",
      "I would love to hear more about your experience.",
      "Could you explain what you meant by that?",
    ],
  },
  work: {
    beginner: ["Good morning.", "Can you help me?", "Thank you for your time."],
    growing: [
      "Could we arrange a meeting for tomorrow?",
      "I have a question about the project.",
      "Please send me the details by email.",
    ],
    confident: [
      "I would like to suggest a different approach to this project.",
      "Could we review the timeline before making a decision?",
      "Let me clarify the main points from our discussion.",
    ],
  },
  study: {
    beginner: [
      "Where is the classroom?",
      "I have a question.",
      "Please say that again.",
    ],
    growing: [
      "Could you explain this part of the lesson?",
      "I would like to join the study group.",
      "When do we need to submit the assignment?",
    ],
    confident: [
      "I am interested in exploring this topic in more depth.",
      "Could you recommend a useful resource for this subject?",
      "The evidence supports a different interpretation.",
    ],
  },
  travel: {
    beginner: [
      "Where is the station?",
      "How much does it cost?",
      "I need a ticket.",
    ],
    growing: [
      "I have a reservation under my name.",
      "Could you tell me how to get to the airport?",
      "Does this train stop in the city center?",
    ],
    confident: [
      "My flight was delayed and I missed my connection.",
      "Could you recommend a quiet place to visit nearby?",
      "I would like to change the date of my reservation.",
    ],
  },
};
export function phraseTokens(text: string, language: string): string[] {
  const normalized = text
    .normalize("NFKC")
    .toLocaleLowerCase(language)
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .trim();
  return ["zh", "ja"].includes(language)
    ? Array.from(normalized.replace(/\s/g, ""))
    : normalized.split(/\s+/).filter(Boolean);
}
export function comparePhrase(
  expected: string,
  heard: string,
  language: string,
) {
  const a = phraseTokens(expected, language),
    b = phraseTokens(heard, language);
  if (!a.length || a.length > 500 || b.length > 1000)
    throw new Error("Try a shorter phrase.");
  let previous = new Uint16Array(b.length + 1);
  for (const token of a) {
    const next = new Uint16Array(b.length + 1);
    for (let j = 1; j <= b.length; j++)
      next[j] =
        token === b[j - 1]
          ? previous[j - 1] + 1
          : Math.max(previous[j], next[j - 1]);
    previous = next;
  }
  return { matched: previous[b.length], total: a.length };
}
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function validCardText(source: string, target: string) {
  return (
    !!source.trim() &&
    !!target.trim() &&
    Array.from(source).length <= 300 &&
    Array.from(target).length <= 300
  );
}
