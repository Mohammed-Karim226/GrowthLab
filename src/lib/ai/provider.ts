import "server-only";

/**
 * Vision provider contract.
 *
 * The rest of the application talks to this interface, not to Gemini. Swapping
 * providers means adding one file, not touching the analysis routes.
 *
 * server-only: the concrete implementations read GEMINI_API_KEY, and this
 * import guarantees the whole chain fails the build rather than the runtime if
 * a client component ever reaches for it (plan §54).
 */

export type VisionImage = {
  mimeType: string;
  /** Base64 without a data: prefix. */
  data: string;
};

export type CompletionRequest = {
  systemInstruction: string;
  prompt: string;
  images?: VisionImage[];
  /** Lower for transcription, higher for prose. */
  temperature?: number;
  maxOutputTokens?: number;
};

export type CompletionResult = {
  /** Raw text exactly as returned, stored for auditing (plan §17). */
  raw: string;
  /** JSON.parse of `raw` after fence stripping. Not yet schema-validated. */
  json: unknown;
  model: string;
  provider: string;
};

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

/**
 * Provider failures, classified so the caller knows whether a retry is useful.
 *
 * `message` is for the server log and the ai_analyses row. It is never returned
 * to the browser — routes translate this into an errorKey (plan §52).
 */
export type AiFailureKind =
  | "auth"
  | "rate_limit"
  | "timeout"
  | "network"
  | "bad_response"
  | "blocked"
  | "unknown";

export class AiProviderError extends Error {
  readonly kind: AiFailureKind;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(kind: AiFailureKind, message: string, options?: { status?: number }) {
    super(message);
    this.name = "AiProviderError";
    this.kind = kind;
    this.status = options?.status;
    this.retryable = kind === "rate_limit" || kind === "timeout" || kind === "network";
  }
}

/** Map a provider failure to a translation key the browser may see. */
export function errorKeyFor(kind: AiFailureKind): string {
  switch (kind) {
    case "rate_limit":
      return "aiRateLimited";
    case "timeout":
    case "network":
      return "aiUnavailable";
    case "blocked":
      return "aiBlocked";
    case "bad_response":
      return "aiBadResponse";
    // "auth" deliberately collapses into the generic key: a client must not
    // learn whether our API credentials are the problem.
    default:
      return "aiFailed";
  }
}

/**
 * Strip markdown fences and pull out the JSON body.
 *
 * Models wrap JSON in ```json fences often enough that failing on it would be a
 * self-inflicted error rate. Anything still unparseable raises bad_response.
 */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1] : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    // Last resort: the first balanced-looking object in the text.
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        /* falls through */
      }
    }
    throw new AiProviderError("bad_response", "Model response was not valid JSON");
  }
}

/**
 * Retry with exponential backoff, but only for failures a retry can fix.
 *
 * Auth errors and schema violations repeat identically, so retrying them just
 * burns quota and delays the admin's feedback (plan §20).
 */
export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: { attempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelay = options.baseDelayMs ?? 800;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;

      const retryable = error instanceof AiProviderError && error.retryable;
      if (!retryable || attempt === attempts) break;

      const delay = baseDelay * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
