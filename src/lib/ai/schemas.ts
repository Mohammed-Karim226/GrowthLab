import { z } from "zod";

import { METRIC_UNITS } from "@/lib/analytics/normalization";
import { platformSchema } from "@/lib/validation/schemas";

/**
 * Contracts for everything the model returns.
 *
 * A model response is untrusted input. Nothing reaches the database before it
 * passes through here, and every schema is `.strict()` so an unexpected field
 * fails loudly instead of being silently carried along (plan §16, §18).
 */

/**
 * A single metric read off a screenshot.
 *
 * `value` is nullable on purpose: the model is instructed to report a metric it
 * can see but cannot read as null rather than guess at it. `confidence` is the
 * model's own certainty and drives the needs_review flag downstream (plan §15).
 */
export const extractedMetricSchema = z
  .object({
    metric_name: z.string().trim().min(1).max(80),
    value: z.number().finite().nullable(),
    unit: z.enum(METRIC_UNITS).optional(),
    confidence: z.number().min(0).max(1),
    /** What the model actually saw, e.g. "1.2K" — kept for the review screen. */
    literal: z.string().trim().max(60).nullable().optional(),
  })
  .strict();

export type ExtractedMetric = z.infer<typeof extractedMetricSchema>;

/** One vision pass over a platform's screenshots. */
export const extractionResultSchema = z
  .object({
    platform: platformSchema,
    /** Whatever date range the screenshots claim, verbatim. Never invented. */
    period_label: z.string().trim().max(120).nullable().optional(),
    metrics: z.array(extractedMetricSchema).max(80),
    /** Regions the model could not read at all. Surfaced to the admin as-is. */
    unreadable: z.array(z.string().trim().max(200)).max(30).optional(),
  })
  .strict();

export type ExtractionResult = z.infer<typeof extractionResultSchema>;

/**
 * The written interpretation.
 *
 * Mirrors AiSummaryPayload minus `generated_at`, which the application stamps —
 * a timestamp from the model would be a fabricated fact.
 */
export const aiSummarySchema = z
  .object({
    summary: z.string().trim().min(1).max(2000),
    went_well: z.array(z.string().trim().min(1).max(400)).max(6),
    what_changed: z.array(z.string().trim().min(1).max(400)).max(6),
    needs_attention: z.array(z.string().trim().min(1).max(400)).max(6),
    recommendations: z.array(z.string().trim().min(1).max(400)).max(6),
  })
  .strict();

export type AiSummary = z.infer<typeof aiSummarySchema>;

/** Request bodies for the two AI routes. */

export const analyzeBatchSchema = z
  .object({
    insightBatchId: z.string().uuid(),
    /** Re-run a batch that already has a completed analysis (plan §19). */
    force: z.boolean().optional(),
  })
  .strict();

export const generateSummarySchema = z
  .object({
    reportVersionId: z.string().uuid(),
    force: z.boolean().optional(),
  })
  .strict();

/**
 * Parse a model response, returning issue paths rather than throwing.
 *
 * The caller logs `issues` server-side and stores them on the failed analysis
 * row; the browser only ever sees an errorKey.
 */
export function parseModelJson<S extends z.ZodTypeAny>(
  schema: S,
  value: unknown
): { ok: true; data: z.infer<S> } | { ok: false; issues: string[] } {
  const parsed = schema.safeParse(value);
  if (parsed.success) return { ok: true, data: parsed.data };

  return {
    ok: false,
    issues: parsed.error.issues.map((issue) =>
      issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message
    ),
  };
}
