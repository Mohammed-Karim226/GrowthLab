import "server-only";

import { geminiApiKey, geminiModel } from "@/lib/env";
import { recordAiUsage, type AiUsageEvent } from "./usage";
import {
  AiProviderError,
  extractJson,
  type AiProvider,
  type CompletionRequest,
  type CompletionResult,
} from "./provider";

/**
 * Gemini via the REST API.
 *
 * Deliberately not the @google/generative-ai SDK: one fetch against a stable
 * documented endpoint is less to keep current than a client library, and the
 * plan asks for no unnecessary dependencies (§84).
 *
 * The key travels in the x-goog-api-key header rather than the query string so
 * it cannot end up in an access log or a proxy trace.
 */

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta";
const REQUEST_TIMEOUT_MS = 120_000;

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: unknown;
    candidatesTokenCount?: unknown;
    totalTokenCount?: unknown;
  };
};

function tokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function classify(status: number, body: string): AiProviderError {
  if (status === 401 || status === 403) {
    return new AiProviderError("auth", `Gemini rejected the credentials (${status})`, { status });
  }
  if (status === 429) {
    return new AiProviderError("rate_limit", "Gemini rate limit reached", { status });
  }
  if (status === 408 || status === 504) {
    return new AiProviderError("timeout", `Gemini timed out (${status})`, { status });
  }
  if (status >= 500) {
    return new AiProviderError("network", `Gemini is unavailable (${status})`, { status });
  }
  // 4xx other than the above is our request's fault; a retry sends the same bytes.
  return new AiProviderError("bad_response", `Gemini rejected the request (${status}): ${body.slice(0, 500)}`, {
    status,
  });
}

export function createGeminiProvider(): AiProvider {
  const model = geminiModel();

  return {
    name: "gemini",
    model,

    async complete(request: CompletionRequest): Promise<CompletionResult> {
      const startedAt = new Date().toISOString();
      const startedMs = performance.now();
      let status: AiUsageEvent["status"] = "error";
      let errorKind: AiUsageEvent["error_kind"] = "unknown";
      let statusCode: number | null = null;
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;
      let totalTokens: number | null = null;

      try {
        const parts: GeminiPart[] = [{ text: request.prompt }];

        for (const image of request.images ?? []) {
          parts.push({ inline_data: { mime_type: image.mimeType, data: image.data } });
        }

        const payload = {
          contents: [{ role: "user", parts }],
          systemInstruction: { parts: [{ text: request.systemInstruction }] },
          generationConfig: {
            // Transcription wants determinism; the caller raises this for prose.
            temperature: request.temperature ?? 0,
            maxOutputTokens: request.maxOutputTokens ?? 8192,
            responseMimeType: "application/json",
          },
        };

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        let response: Response;
        let bodyText: string;
        try {
          response = await fetch(`${API_ROOT}/models/${encodeURIComponent(model)}:generateContent`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": geminiApiKey(),
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
            cache: "no-store",
          });
          statusCode = response.status;
          // The deadline includes reading the body: response headers alone do
          // not mean a generation finished, and a stalled stream needs a bound.
          bodyText = await response.text();
        } catch (cause) {
          if (cause instanceof Error && cause.name === "AbortError") {
            throw new AiProviderError("timeout", `Gemini did not respond within ${REQUEST_TIMEOUT_MS}ms`);
          }
          throw new AiProviderError("network", `Could not reach Gemini: ${String(cause)}`);
        } finally {
          clearTimeout(timer);
        }

        let parsed: GeminiResponse | null = null;
        try {
          const envelope: unknown = JSON.parse(bodyText);
          if (envelope && typeof envelope === "object" && !Array.isArray(envelope)) {
            parsed = envelope as GeminiResponse;
            // Preserve usage even for blocked, truncated or invalid output.
            // Input TPM excludes generated/thinking tokens. Missing metadata
            // remains null; summing known fields would hide unknown usage.
            inputTokens = tokenCount(parsed.usageMetadata?.promptTokenCount);
            outputTokens = tokenCount(parsed.usageMetadata?.candidatesTokenCount);
            totalTokens = tokenCount(parsed.usageMetadata?.totalTokenCount);
          }
        } catch {
          // Classify non-2xx responses by HTTP status, even for HTML envelopes.
        }

        if (!response.ok) throw classify(response.status, bodyText);
        if (!parsed) throw new AiProviderError("bad_response", "Gemini returned a non-JSON envelope");

        if (parsed.promptFeedback?.blockReason) {
          throw new AiProviderError(
            "blocked",
            `Gemini blocked the prompt: ${parsed.promptFeedback.blockReason}`
          );
        }

        const candidate = parsed.candidates?.[0];

        if (candidate?.finishReason === "SAFETY" || candidate?.finishReason === "PROHIBITED_CONTENT") {
          throw new AiProviderError("blocked", `Gemini stopped: ${candidate.finishReason}`);
        }

        // MAX_TOKENS leaves truncated JSON behind — treat it as a bad response
        // rather than letting extractJson salvage half an object.
        if (candidate?.finishReason === "MAX_TOKENS") {
          throw new AiProviderError("bad_response", "Gemini response hit the output token limit");
        }

        const raw = (candidate?.content?.parts ?? [])
          .map((part) => part.text ?? "")
          .join("")
          .trim();

        if (!raw) throw new AiProviderError("bad_response", "Gemini returned an empty response");

        const json = extractJson(raw);
        status = "success";
        errorKind = null;
        return { raw, json, model, provider: "gemini" };
      } catch (cause) {
        if (cause instanceof AiProviderError) errorKind = cause.kind;
        throw cause;
      } finally {
        try {
          await recordAiUsage({
            provider: "gemini", model, status, error_kind: errorKind, status_code: statusCode,
            input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: totalTokens,
            duration_ms: Math.max(0, Math.round(performance.now() - startedMs)), started_at: startedAt,
          });
        } catch {
          // Defense at the provider boundary, even if a future reporter or a
          // test double breaks the writer's own best-effort guarantee.
        }
      }
    },
  };
}
