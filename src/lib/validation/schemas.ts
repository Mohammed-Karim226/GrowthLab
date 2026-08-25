import { z } from "zod";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { PLATFORMS } from "@/types/database";

/** Shared request schemas. Used by route handlers and by the forms that call them. */

export const platformSchema = z.enum(
  PLATFORMS as unknown as [string, ...string[]]
) as z.ZodType<(typeof PLATFORMS)[number]>;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Not a real date");

export const createClientSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    companyName: z.string().trim().max(160).optional().or(z.literal("")),
    email: z.string().trim().email(),
    password: z
      .string()
      .min(10, "Use at least 10 characters")
      .max(128)
      .refine((value) => !/^\s|\s$/.test(value), "No leading or trailing spaces"),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .strict();

export type CreateClientInput = z.infer<typeof createClientSchema>;

export const createAccountSchema = z.object({
  platform: platformSchema,
  pageName: z.string().trim().min(1).max(160),
  pageId: z.string().trim().max(160).optional().or(z.literal("")),
  stage: z.string().trim().max(80).optional().or(z.literal("")),
}).strict();

export const updateAccountSchema = z.object({
  pageName: z.string().trim().min(1).max(160).optional(),
  pageId: z.string().trim().max(160).nullable().optional(),
  stage: z.string().trim().max(80).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Nothing to update");

export const updateClientSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    companyName: z.string().trim().max(160).nullable().optional(),
    contactEmail: z.string().trim().email().nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

export const paymentPlanSchema = z.object({
  billingMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  amount: z.coerce.number().finite().nonnegative().max(1_000_000),
  totalPlanPrice: z.coerce.number().finite().nonnegative().max(10_000_000).nullable().optional(),
  currency: z.string().trim().min(3).max(8).default("USD"),
  status: z.enum(["pending", "paid", "overdue", "waived"] as const).default("pending"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
}).strict();

export const updatePaymentPlanSchema = paymentPlanSchema.partial().extend({
  paidAt: z.string().datetime().nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Nothing to update");

export const createReportSchema = z
  .object({
    clientId: z.string().uuid(),
    title: z.string().trim().min(2).max(160),
    periodStart: isoDate,
    periodEnd: isoDate,
  })
  .strict()
  .refine(
    (value) => Date.parse(value.periodEnd) >= Date.parse(value.periodStart),
    { message: "End date must be on or after the start date", path: ["periodEnd"] }
  );

export type CreateReportInput = z.infer<typeof createReportSchema>;

export const createBatchSchema = z
  .object({
    reportVersionId: z.string().uuid(),
    platform: platformSchema,
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .strict();

export const updateBatchSchema = z
  .object({
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const updateMetricSchema = z
  .object({
    metricName: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9_]+$/, "Use lowercase letters, digits and underscores")
      .optional(),
    metricValue: z.number().finite().nullable().optional(),
    metricUnit: z.enum(["count", "percent", "seconds", "minutes", "hours", "currency"]).optional(),
    metricDate: isoDate.nullable().optional(),
    needsReview: z.boolean().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

export const createMetricSchema = z
  .object({
    reportVersionId: z.string().uuid(),
    insightBatchId: z.string().uuid().nullable().optional(),
    platform: platformSchema,
    metricName: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9_]+$/, "Use lowercase letters, digits and underscores"),
    metricValue: z.number().finite().nullable(),
    metricUnit: z
      .enum(["count", "percent", "seconds", "minutes", "hours", "currency"])
      .default("count"),
    metricDate: isoDate.nullable().optional(),
  })
  .strict();

export const publishSchema = z
  .object({
    reportVersionId: z.string().uuid(),
    summary: z.string().trim().max(4000).optional(),
  })
  .strict();

export const approveVersionSchema = z
  .object({
    reportVersionId: z.string().uuid(),
    summary: z.string().trim().max(4000).nullable().optional(),
  })
  .strict();

export const unpublishSchema = z
  .object({
    reportVersionId: z.string().uuid(),
  })
  .strict();

/**
 * Start a new version of an already-published report.
 *
 * `carryOverMetrics` copies the published numbers into the draft so a small
 * correction does not mean re-uploading every screenshot.
 */
export const createVersionSchema = z
  .object({
    reportId: z.string().uuid(),
    carryOverMetrics: z.boolean().optional(),
  })
  .strict();

/** Client-side file validation, mirroring the storage bucket's own limits. */
export function validateImageFile(file: File): { ok: true } | { ok: false; reason: string } {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, reason: "type" };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "size" };
  }
  if (file.size === 0) {
    return { ok: false, reason: "empty" };
  }
  return { ok: true };
}
