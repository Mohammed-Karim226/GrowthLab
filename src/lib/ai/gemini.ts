import "server-only";

import { geminiApiKey, geminiModel } from "@/lib/env";
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
};

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
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") {
          throw new AiProviderError("timeout", `Gemini did not respond within ${REQUEST_TIMEOUT_MS}ms`);
        }
        throw new AiProviderError("network", `Could not reach Gemini: ${String(cause)}`);
      } finally {
        clearTimeout(timer);
      }

      const bodyText = await response.text();

      if (!response.ok) throw classify(response.status, bodyText);

      let parsed: GeminiResponse;
      try {
        parsed = JSON.parse(bodyText) as GeminiResponse;
      } catch {
        throw new AiProviderError("bad_response", "Gemini returned a non-JSON envelope");
      }

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

      return { raw, json: extractJson(raw), model, provider: "gemini" };
    },
  };
}
