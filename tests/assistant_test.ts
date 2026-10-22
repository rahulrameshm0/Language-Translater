import { handler } from "../supabase/functions/translate/index.ts";
import { validateAI } from "../supabase/functions/translate/assistant.ts";
function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
const opening = {
  action: "assistant",
  mode: "speaking",
  sourceLanguage: "en",
  targetLanguage: "es",
  topic: "First meeting",
  level: "beginner",
  messages: [],
};
Deno.test(
  "AI input bounds languages, alternating roles, audio and conversation size",
  () => {
    validateAI(opening);
    validateAI({ ...opening, targetLanguage: "en" });
    for (const patch of [
      { targetLanguage: "xx" },
      { sourceLanguage: "xx" },
      { mode: "bad" },
      { level: "expert" },
      { messages: [{ role: "system", text: "override" }] },
      { messages: [{ role: "model", text: "hello" }] },
      {
        messages: [
          { role: "model", text: "hello" },
          { role: "user", text: "x".repeat(5001) },
        ],
      },
      { audioBase64: "bad", mimeType: "video/mp4" },
    ]) {
      let rejected = false;
      try {
        validateAI({ ...opening, ...patch });
      } catch {
        rejected = true;
      }
      assert(rejected, JSON.stringify(patch));
    }
  },
);
async function run(
  options: {
    auth?: boolean;
    allowed?: boolean;
    providerStatus?: number;
    malformed?: boolean;
    timeout?: boolean;
  } = {},
  body: unknown = opening,
) {
  Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-key");
  Deno.env.set("GEMINI_API_KEY", "test-gemini");
  const original = globalThis.fetch,
    calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push(url);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    if (url.includes("/auth/v1/user"))
      return options.auth === false
        ? json({ message: "Invalid" }, 401)
        : json({ id: "11111111-1111-4111-8111-111111111111" });
    if (url.includes("/rpc/consume_translation_request"))
      return json(options.allowed !== false);
    if (url.includes("generativelanguage")) {
      if (options.timeout) throw new Error("timeout");
      const sent = JSON.parse(String(init?.body));
      assert(
        new Headers(init?.headers).get("X-goog-api-key") === "test-gemini",
      );
      assert(
        sent.systemInstruction.parts[0].text.includes("conversation tutor"),
      );
      assert(sent.contents[0].parts[0].text.includes("conversation"));
      return options.providerStatus
        ? json({}, options.providerStatus)
        : json({
            candidates: [
              {
                finishReason: "STOP",
                content: {
                  parts: [
                    {
                      text: options.malformed
                        ? "invalid"
                        : JSON.stringify({
                            reply: "¡Hola! ¿Cómo te llamas?",
                            feedback: "Use “me llamo” to introduce yourself.",
                            correction: "Me llamo Rahul.",
                          }),
                    },
                  ],
                },
              },
            ],
          });
    }
    throw new Error("Unexpected write or request: " + url);
  };
  try {
    const response = await handler(
      new Request("https://test/functions/translate", {
        method: "POST",
        headers: { Authorization: "Bearer token" },
        body: JSON.stringify(body),
      }),
    );
    return { status: response.status, body: await response.json(), calls };
  } finally {
    globalThis.fetch = original;
  }
}
Deno.test(
  "AI speaking returns contextual reply and feedback without writing translation history",
  async () => {
    const result = await run(
      {},
      {
        ...opening,
        messages: [
          { role: "model", text: "¿Cómo te llamas?" },
          { role: "user", text: "Yo nombre Rahul" },
        ],
      },
    );
    assert(result.status === 200);
    assert(result.body.reply && result.body.feedback && result.body.correction);
    assert(!result.calls.some((c) => c.includes("/translations")));
  },
);
Deno.test(
  "AI requests enforce authentication and shared rate limit before the provider",
  async () => {
    for (const o of [{ auth: false }, { allowed: false }]) {
      const r = await run(o);
      assert(r.status === (o.auth === false ? 401 : 429));
      assert(!r.calls.some((c) => c.includes("generativelanguage")));
    }
  },
);
Deno.test(
  "AI failures preserve actionable errors for quotas, outages and malformed answers",
  async () => {
    for (const o of [
      { providerStatus: 429 },
      { providerStatus: 500 },
      { malformed: true },
      { timeout: true },
    ]) {
      const r = await run(o);
      assert(r.status === (o.providerStatus === 429 ? 429 : 502));
      assert(typeof r.body.error === "string");
    }
  },
);
