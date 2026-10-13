import assert from "node:assert/strict";
import { test } from "node:test";
import { appLoader } from "./helpers/app-loader.mjs";

const request = {
  prompt: "private client prompt",
  systemInstruction: "private system instruction",
  images: [{ mimeType: "image/png", data: "private image bytes" }],
};
const usageMetadata = { promptTokenCount: 100, candidatesTokenCount: 20, totalTokenCount: 155, thoughtsTokenCount: 35 };

function envelope(overrides = {}) {
  return {
    candidates: [{ content: { parts: [{ text: '{"answer":"private generated response"}' }] }, finishReason: "STOP" }],
    usageMetadata,
    ...overrides,
  };
}

// Execute the actual Gemini transport, parser and telemetry writer. Only the
// external HTTP and service-role database boundaries are replaced.
function scenario(t, options = {}) {
  const state = { events: [], signals: [], calls: [], clients: 0 };
  const replies = [...(options.replies ?? [{ body: envelope() }])];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    state.calls.push({ url, init });
    const reply = replies.shift();
    assert.ok(reply, "Every provider request needs a supplied reply");
    if (reply.error) throw reply.error;
    if (reply.response) return typeof reply.response === "function" ? reply.response(init) : reply.response;
    return new Response(typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
  const load = appLoader({
    ...(options.reporterError ? { "./usage": { recordAiUsage: async () => { throw options.reporterError; } } } : {}),
    "@/lib/env": { geminiApiKey: () => "private-api-key", geminiModel: () => "gemini-test" },
    "@/lib/supabase/admin": {
      createAdminClient() {
        state.clients++;
        if (options.setupError) throw options.setupError;
        return {
          from(table) {
            assert.equal(table, "ai_usage_events");
            return {
              insert(event) {
                state.events.push(structuredClone(event));
                if (options.incompleteBuilder) return {};
                return {
                  abortSignal(signal) { state.signals.push(signal); return this; },
                  then(resolve, reject) {
                    if (options.writeError) return Promise.reject(options.writeError).then(resolve, reject);
                    if (options.hungWrite) return new Promise(() => {}).then(resolve, reject);
                    return Promise.resolve({ data: null, error: options.databaseError ?? null }).then(resolve, reject);
                  },
                };
              },
            };
          },
        };
      },
    },
  });
  return {
    state,
    provider: load("src/lib/ai/gemini.ts").createGeminiProvider(),
    errors: load("src/lib/ai/provider.ts"),
  };
}

function assertEvent(event, expected) {
  assert.equal(event.provider, "gemini");
  assert.equal(event.model, "gemini-test");
  assert.ok(Number.isInteger(event.duration_ms) && event.duration_ms >= 0);
  assert.ok(Number.isFinite(Date.parse(event.started_at)));
  for (const [key, value] of Object.entries(expected)) assert.equal(event[key], value, key);
}

test("successful completion preserves provider metadata and records no content or identity", async (t) => {
  const { provider, state } = scenario(t);
  const result = await provider.complete(request);
  assert.deepEqual(result, {
    raw: '{"answer":"private generated response"}',
    json: { answer: "private generated response" },
    model: "gemini-test",
    provider: "gemini",
  });
  assert.equal(state.events.length, 1);
  assertEvent(state.events[0], {
    status: "success", error_kind: null, status_code: 200,
    input_tokens: 100, output_tokens: 20, total_tokens: 155,
  });
  assert.deepEqual(Object.keys(state.events[0]).sort(), [
    "duration_ms", "error_kind", "input_tokens", "model", "output_tokens", "provider",
    "started_at", "status", "status_code", "total_tokens",
  ]);
  assert.doesNotMatch(JSON.stringify(state.events), /private/);
  assert.equal(state.calls[0].init.headers["x-goog-api-key"], "private-api-key");
  assert.doesNotMatch(state.calls[0].url, /private-api-key/);
  assert.equal(state.signals[0].aborted, false);
});

for (const [label, metadata, expected] of [
  ["omitted", undefined, { input_tokens: null, output_tokens: null, total_tokens: null }],
  ["partial", { promptTokenCount: 10 }, { input_tokens: 10, output_tokens: null, total_tokens: null }],
  ["zero", { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 }, { input_tokens: 0, output_tokens: 0, total_tokens: 0 }],
  ["invalid", { promptTokenCount: -1, candidatesTokenCount: "2", totalTokenCount: 1.5 }, { input_tokens: null, output_tokens: null, total_tokens: null }],
]) {
  test(`${label} metadata never manufactures token totals`, async (t) => {
    const { provider, state } = scenario(t, { replies: [{ body: envelope({ usageMetadata: metadata }) }] });
    await provider.complete(request);
    assertEvent(state.events[0], expected);
  });
}

for (const [label, overrides, kind] of [
  ["prompt safety block", { promptFeedback: { blockReason: "SAFETY" } }, "blocked"],
  ["candidate safety block", { candidates: [{ finishReason: "SAFETY" }] }, "blocked"],
  ["prohibited content", { candidates: [{ finishReason: "PROHIBITED_CONTENT" }] }, "blocked"],
  ["output limit", { candidates: [{ finishReason: "MAX_TOKENS" }] }, "bad_response"],
  ["invalid output JSON", { candidates: [{ content: { parts: [{ text: "not JSON" }] } }] }, "bad_response"],
  ["empty output", { candidates: [] }, "bad_response"],
]) {
  test(`${label} records failed attempt and retains charged tokens`, async (t) => {
    const { provider, state } = scenario(t, { replies: [{ body: envelope(overrides) }] });
    await assert.rejects(provider.complete(request), (error) => error.kind === kind);
    assert.equal(state.events.length, 1);
    assertEvent(state.events[0], {
      status: "error", error_kind: kind, status_code: 200,
      input_tokens: 100, output_tokens: 20, total_tokens: 155,
    });
  });
}

for (const body of ["<html>upstream unavailable</html>", "null", "[]"]) {
  test(`malformed provider envelope ${body} records a classified failure`, async (t) => {
    const { provider, state } = scenario(t, { replies: [{ body }] });
    await assert.rejects(provider.complete(request), (error) => error.kind === "bad_response");
    assertEvent(state.events[0], { status: "error", error_kind: "bad_response", total_tokens: null });
  });
}

test("retries each record an attempt, including rate-limit responses with no token metadata", async (t) => {
  const { provider, state, errors } = scenario(t, {
    replies: [{ status: 429, body: "quota exceeded" }, { body: envelope() }],
  });
  const result = await errors.withRetry(() => provider.complete(request), { attempts: 3, baseDelayMs: 0 });
  assert.equal(result.json.answer, "private generated response");
  assert.equal(state.calls.length, 2);
  assert.equal(state.events.length, 2);
  assertEvent(state.events[0], { status: "error", error_kind: "rate_limit", status_code: 429, total_tokens: null });
  assertEvent(state.events[1], { status: "success", error_kind: null, total_tokens: 155 });
});

for (const [status, kind] of [[403, "auth"], [429, "rate_limit"], [504, "timeout"], [503, "network"], [400, "bad_response"]]) {
  test(`HTTP ${status} preserves its classification and any usage metadata`, async (t) => {
    const { provider, state } = scenario(t, { replies: [{ status, body: { usageMetadata } }] });
    await assert.rejects(provider.complete(request), (error) => error.kind === kind && error.status === status);
    assertEvent(state.events[0], { status: "error", error_kind: kind, status_code: status, total_tokens: 155 });
  });
}

for (const [error, kind] of [[new Error("transport failed"), "network"], [new DOMException("aborted", "AbortError"), "timeout"]]) {
  test(`${kind} transport errors are recorded without an invented HTTP status or token count`, async (t) => {
    const { provider, state } = scenario(t, { replies: [{ error }] });
    await assert.rejects(provider.complete(request), (failure) => failure.kind === kind);
    assertEvent(state.events[0], { status: "error", error_kind: kind, status_code: null, total_tokens: null });
  });
}

for (const [label, options] of [
  ["missing service configuration", { setupError: new Error("key unavailable") }],
  ["unavailable telemetry table", { databaseError: { code: "42P01", message: "relation unavailable" } }],
  ["rejected telemetry write", { writeError: new Error("database offline") }],
  ["incomplete client mock", { incompleteBuilder: true }],
]) {
  test(`${label} never turns a successful AI completion into an error`, async (t) => {
    const { provider } = scenario(t, options);
    assert.equal((await provider.complete(request)).json.answer, "private generated response");
  });
}

test("telemetry write failure preserves the original provider failure", async (t) => {
  const { provider } = scenario(t, { writeError: new Error("database offline"), replies: [{ status: 429, body: "limited" }] });
  await assert.rejects(provider.complete(request), (error) => error.kind === "rate_limit" && error.status === 429);
});

test("a response-read failure is a network error even when telemetry fails", async (t) => {
  const { provider, state } = scenario(t, {
    writeError: new Error("database offline"),
    replies: [{ response: { status: 200, text: async () => { throw new Error("response stream failed"); } } }],
  });
  await assert.rejects(provider.complete(request), (error) => error.kind === "network");
  assertEvent(state.events[0], { status: "error", error_kind: "network", status_code: 200, total_tokens: null });
});

test("the provider deadline covers a response body that stalls after headers", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let startedBody;
  const readingBody = new Promise((resolve) => { startedBody = resolve; });
  const { provider, state } = scenario(t, {
    replies: [{ response: (init) => ({
      status: 200,
      ok: true,
      text: () => new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
        startedBody();
      }),
    }) }],
  });
  const completion = provider.complete(request);
  const rejected = assert.rejects(completion, (error) => error.kind === "timeout");
  await readingBody;
  t.mock.timers.tick(120_000);
  await rejected;
  assertEvent(state.events[0], { status: "error", error_kind: "timeout", status_code: 200, total_tokens: null });
});

for (const failed of [false, true]) {
  test(`a throwing reporter cannot mask provider ${failed ? "failure" : "success"}`, async (t) => {
    const { provider } = scenario(t, {
      reporterError: new Error("unexpected recorder bug"),
      ...(failed ? { replies: [{ status: 429, body: "limited" }] } : {}),
    });
    if (failed) await assert.rejects(provider.complete(request), (error) => error.kind === "rate_limit");
    else assert.equal((await provider.complete(request)).json.answer, "private generated response");
  });
}

test("a telemetry transport that ignores cancellation cannot keep the AI request open", { timeout: 5_000 }, async (t) => {
  const { provider, state } = scenario(t, { hungWrite: true });
  const started = performance.now();
  const result = await provider.complete(request);
  assert.equal(result.json.answer, "private generated response");
  assert.equal(state.signals[0].aborted, true);
  assert.ok(performance.now() - started < 4_000, "Writer must return after its bounded deadline");
});
