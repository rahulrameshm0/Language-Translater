import {
  comparePhrase,
  practicePhrases,
  validCardText,
  localDay,
} from "../src/practice.ts";
function equal(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`);
}
Deno.test(
  "practice word matching handles case, punctuation and omitted words",
  () => {
    equal(comparePhrase("Hello, how are you?", "hello how are you!", "en"), {
      matched: 4,
      total: 4,
    });
    equal(comparePhrase("Could you help me?", "could help me", "en"), {
      matched: 3,
      total: 4,
    });
    equal(comparePhrase("Yes yes please", "yes please", "en"), {
      matched: 2,
      total: 3,
    });
  },
);
Deno.test(
  "practice supports Unicode scripts and character matching where needed",
  () => {
    equal(comparePhrase("Բարև աշխարհ", "ԲԱՐԵՎ աշխարհ", "hy").total, 2);
    equal(comparePhrase("你好世界", "你好", "zh"), { matched: 2, total: 4 });
    equal(comparePhrase("こんにちは", "こんにちは", "ja"), {
      matched: 5,
      total: 5,
    });
    equal(comparePhrase("İYİ", "iyi", "tr"), { matched: 1, total: 1 });
  },
);
Deno.test("practice contains real finite scenario and level sets", () => {
  equal(Object.keys(practicePhrases).length, 4);
  for (const scenario of Object.values(practicePhrases))
    for (const phrases of Object.values(scenario)) {
      equal(phrases.length, 3);
      for (const phrase of phrases)
        if (!phrase.trim() || phrase.length > 500)
          throw new Error("Invalid phrase");
    }
});
Deno.test("learning cards use bounded Unicode text and local date keys", () => {
  equal(validCardText("👋".repeat(300), "Hello"), true);
  equal(validCardText("a".repeat(301), "Hi"), false);
  equal(validCardText("  ", "Hola"), false);
  equal(localDay(new Date(2026, 9, 22, 23, 59)), "2026-10-22");
});
