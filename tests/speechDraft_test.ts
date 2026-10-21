import {
  emptySpeechDraft,
  finishSpeech,
  receiveSpeech,
  speechText,
} from "../src/speechDraft.ts";
function equal(actual: string, expected: string) {
  if (actual !== expected)
    throw new Error(`${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
}
Deno.test(
  "live partials replace the current hypothesis instead of duplicating words",
  () => {
    let draft = emptySpeechDraft();
    draft = receiveSpeech(draft, "Hello", false);
    equal(speechText(draft), "Hello");
    draft = receiveSpeech(draft, "Hello world", false);
    equal(speechText(draft), "Hello world");
    draft = receiveSpeech(draft, "Hello, world.", true);
    equal(speechText(draft), "Hello, world.");
  },
);
Deno.test(
  "continuous final segments accumulate and the next partial remains visible",
  () => {
    let draft = receiveSpeech(emptySpeechDraft(), "Good morning.", true);
    draft = receiveSpeech(draft, "How are", false);
    equal(speechText(draft), "Good morning. How are");
    draft = receiveSpeech(draft, "How are you?", true);
    equal(speechText(draft), "Good morning. How are you?");
  },
);
Deno.test(
  "stop or an empty final keeps the latest visible words for review",
  () => {
    const draft = receiveSpeech(emptySpeechDraft(), "Բարև աշխարհ", false);
    equal(speechText(finishSpeech(draft)), "Բարև աշխարհ");
    equal(speechText(receiveSpeech(draft, "", true)), "Բարև աշխարհ");
  },
);
Deno.test(
  "review edits survive finalization and a fresh session starts empty",
  () => {
    const edited = { committed: "Guten Morgen! ¿Cómo estás?", partial: "" };
    equal(speechText(finishSpeech(edited)), edited.committed);
    equal(speechText(emptySpeechDraft()), "");
  },
);
Deno.test("intentional repeated utterances are retained", () => {
  let draft = receiveSpeech(emptySpeechDraft(), "Yes.", true);
  draft = receiveSpeech(draft, "Yes.", true);
  equal(speechText(draft), "Yes. Yes.");
});

Deno.test(
  "an empty interim event does not erase words waiting for review",
  () => {
    const draft = receiveSpeech(
      emptySpeechDraft(),
      "Please keep these words",
      false,
    );
    equal(
      speechText(receiveSpeech(draft, "", false)),
      "Please keep these words",
    );
  },
);
