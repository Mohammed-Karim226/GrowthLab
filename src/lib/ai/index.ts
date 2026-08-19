import "server-only";

import { createGeminiProvider } from "./gemini";
import type { AiProvider } from "./provider";

/**
 * Provider selection.
 *
 * One place to swap implementations. Resolved per call rather than cached at
 * module scope so a missing key surfaces as a handled request failure instead
 * of a module-load crash that takes the whole route down.
 */
export function getAiProvider(): AiProvider {
  return createGeminiProvider();
}

export * from "./provider";
export * from "./schemas";
export * from "./prompts";
