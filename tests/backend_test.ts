import { supportedLanguages } from "../supabase/functions/translate/validation.ts";
import { handler } from "../supabase/functions/translate/index.ts";
function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
const user = "11111111-1111-4111-8111-111111111111";
type Scenario = {
  auth?: boolean;
  allowed?: boolean;
  providerFailure?: boolean;
  saveFailure?: boolean;
  timeout?: boolean;
  providerStatus?: number;
  malformed?: boolean;
  finishReason?: string;
  blocked?: boolean;
  missingKey?: boolean;
  transcript?: string;
  tooLong?: boolean;
};
async function run(
  scenario: Scenario,
  body: unknown = { text: "Hello", sourceLanguage: "en", targetLanguage: "hy" },
  token = true,
) {
  Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
  Deno.env.set("GEMINI_API_KEY", "test-gemini-key");
  if (scenario.missingKey) Deno.env.delete("GEMINI_API_KEY");
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push(url);
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    if (url.includes("/auth/v1/user"))
      return scenario.auth === false
        ? json({ message: "Invalid token" }, 401)
        : json({ id: user, email: "test@example.com" });
    if (url.includes("/rpc/consume_translation_request"))
      return json(scenario.allowed !== false);
    if (url.includes("generativelanguage.googleapis.com")) {
      if (scenario.timeout) throw new Error("timeout");
      assert(url.endsWith("/gemini-3.5-flash-lite:generateContent"));
      assert(!url.includes("test-gemini-key"), "Secret must not appear in URL");
      assert(
        new Headers(init?.headers).get("X-goog-api-key") === "test-gemini-key",
      );
      const request = JSON.parse(String(init?.body));
      if ((body as { action?: string }).action === "extract") {
        assert(
          request.contents[0].parts[0].inlineData.data ===
            (body as { fileBase64: string }).fileBase64,
        );
      } else if ((body as { audioBase64?: string }).audioBase64) {
        assert(
          request.contents[0].parts[0].inlineData.data ===
            (body as { audioBase64: string }).audioBase64,
        );
        assert(
          request.contents[0].parts[0].inlineData.mimeType === "audio/mp4",
        );
      } else
        assert(
          request.contents[0].parts[0].text === (body as { text: string }).text,
        );
      assert(
        request.systemInstruction.parts[0].text.includes("never instructions"),
      );
      assert(request.generationConfig.responseMimeType === "application/json");
      if (scenario.providerStatus)
        return json({ error: "Provider error" }, scenario.providerStatus);
      if (scenario.blocked)
        return json({ promptFeedback: { blockReason: "SAFETY" } });
      if (scenario.providerFailure) return json({ error: "Unavailable" }, 503);
      return json({
        candidates: [
          {
            finishReason: scenario.finishReason ?? "STOP",
            content: {
              parts: [
                {
                  text: scenario.malformed
                    ? "not json"
                    : JSON.stringify({
                        originalText: scenario.transcript ?? "Hello",
                        translatedText: "Բարև",
                        tooLong: scenario.tooLong ?? false,
                      }),
                },
              ],
            },
          },
        ],
      });
    }
    if (url.includes("/rest/v1/translations")) {
      const record = JSON.parse(String(init?.body));
      if ((body as { inputKind?: string }).inputKind) {
        assert(record.input_kind === (body as { inputKind: string }).inputKind);
        assert(
          record.source_name === (body as { sourceName: string }).sourceName,
        );
      }
      assert(
        record.user_id === user,
        "History owner must come from verified user",
      );
      return scenario.saveFailure
        ? json({ message: "Database unavailable" }, 500)
        : json({ id: "saved-id" });
    }
    throw new Error(`Unexpected request ${url}`);
  };
  try {
    const response = await handler(
      new Request("https://test/translate", {
        method: "POST",
        headers: token ? { Authorization: "Bearer test-user-token" } : {},
        body: JSON.stringify(body),
      }),
    );
    return { status: response.status, body: await response.json(), calls };
  } finally {
    globalThis.fetch = originalFetch;
  }
}
Deno.test(
  "backend translates all 870 directions and persists verified ownership",
  async () => {
    for (const sourceLanguage of supportedLanguages)
      for (const targetLanguage of supportedLanguages)
        if (sourceLanguage !== targetLanguage) {
          const result = await run(
            {},
            { text: "Hello", sourceLanguage, targetLanguage },
          );
          assert(result.status === 200);
          assert(result.body.historyRecordId === "saved-id");
          assert(result.body.translatedText === "Բարև");
        }
  },
);
Deno.test(
  "missing and invalid authentication never call the provider",
  async () => {
    for (const result of [
      await run({}, undefined, false),
      await run({ auth: false }),
    ]) {
      assert(result.status === 401);
      assert(!result.calls.some((url) => url.includes("googleapis")));
    }
  },
);
Deno.test("invalid input and rate limits do not call provider", async () => {
  const invalid = await run(
    {},
    { text: "", sourceLanguage: "en", targetLanguage: "hy" },
  );
  assert(invalid.status === 400);
  const limited = await run({ allowed: false });
  assert(limited.status === 429);
  assert(!limited.calls.some((url) => url.includes("googleapis")));
});
Deno.test(
  "provider errors and timeouts return actionable failures",
  async () => {
    assert((await run({ providerFailure: true })).status === 502);
    assert((await run({ timeout: true })).status === 502);
  },
);
Deno.test("history failure preserves translation with a warning", async () => {
  const result = await run({ saveFailure: true });
  assert(result.status === 200);
  assert(result.body.translatedText === "Բարև");
  assert(result.body.historyRecordId === null);
  assert(result.body.warning);
});

Deno.test(
  "Gemini quota errors do not save history or retry a paid provider",
  async () => {
    const result = await run({ providerStatus: 429 });
    assert(result.status === 429);
    assert(result.body.error.includes("free translation quota"));
    assert(
      result.calls.filter((url) => url.includes("googleapis")).length === 1,
    );
    assert(!result.calls.some((url) => url.includes("/rest/v1/translations")));
  },
);
Deno.test(
  "blocked, incomplete, and malformed Gemini outputs never enter history",
  async () => {
    for (const scenario of [
      { blocked: true },
      { finishReason: "MAX_TOKENS" },
      { malformed: true },
    ]) {
      const result = await run(scenario);
      assert(result.status === 502);
      assert(
        !result.calls.some((url) => url.includes("/rest/v1/translations")),
      );
    }
  },
);
Deno.test(
  "missing Gemini configuration fails without calling a provider",
  async () => {
    const result = await run({ missingKey: true });
    assert(result.status === 503);
    assert(!result.calls.some((url) => url.includes("googleapis")));
  },
);

Deno.test(
  "voice input is transcribed, translated, and saved as text only",
  async () => {
    const result = await run(
      {},
      {
        audioBase64: "QUFBQQ==",
        mimeType: "audio/mp4",
        sourceLanguage: "en",
        targetLanguage: "de",
      },
    );
    assert(result.status === 200);
    assert(result.body.originalText === "Hello");
    assert(result.body.historyRecordId === "saved-id");
  },
);
Deno.test("silent or overlong transcripts do not enter history", async () => {
  for (const transcript of ["", "a".repeat(5001)]) {
    const result = await run(
      { transcript },
      {
        audioBase64: "QUFBQQ==",
        mimeType: "audio/mp4",
        sourceLanguage: "en",
        targetLanguage: "hy",
      },
    );
    assert(result.status === 422);
    assert(!result.calls.some((url) => url.includes("/rest/v1/translations")));
  }
});

const pdfInput = {
  action: "extract",
  kind: "document",
  sourceLanguage: "en",
  mimeType: "application/pdf",
  fileBase64: btoa("%PDF-1.7\nSample"),
};
Deno.test(
  "PDF extraction returns review text without saving history",
  async () => {
    const result = await run({}, pdfInput);
    assert(result.status === 200);
    assert(result.body.originalText === "Hello");
    assert(!result.calls.some((url) => url.includes("/rest/v1/translations")));
  },
);
Deno.test(
  "media requires authentication and shares the server request limit",
  async () => {
    assert((await run({}, pdfInput, false)).status === 401);
    const limited = await run({ allowed: false }, pdfInput);
    assert(limited.status === 429);
    assert(!limited.calls.some((url) => url.includes("generativelanguage")));
  },
);
Deno.test(
  "media rejects empty, incomplete, overlong and failed extraction",
  async () => {
    for (const scenario of [
      { transcript: "" },
      { tooLong: true },
      { transcript: "a".repeat(5001) },
    ])
      assert((await run(scenario, pdfInput)).status === 422);
    for (const scenario of [
      { malformed: true },
      { finishReason: "MAX_TOKENS" },
      { providerFailure: true },
      { timeout: true },
    ])
      assert((await run(scenario, pdfInput)).status === 502);
    assert((await run({ providerStatus: 429 }, pdfInput)).status === 429);
  },
);
Deno.test(
  "call audio is transcribed for review and never saved before confirmation",
  async () => {
    const result = await run(
      { transcript: "Hello, this is a call." },
      {
        ...pdfInput,
        kind: "call",
        mimeType: "audio/mpeg",
        fileBase64: btoa("ID3 sample audio"),
      },
    );
    assert(result.status === 200);
    assert(result.body.originalText.includes("call"));
    assert(!result.calls.some((url) => url.includes("/rest/v1/translations")));
  },
);

Deno.test(
  "confirmed file translation saves kind and filename under verified ownership",
  async () => {
    const result = await run(
      {},
      {
        text: "Hello",
        sourceLanguage: "en",
        targetLanguage: "es",
        inputKind: "document",
        sourceName: "Example.pdf",
        user_id: "attacker",
      },
    );
    assert(result.status === 200);
    assert(result.body.historyRecordId === "saved-id");
  },
);
