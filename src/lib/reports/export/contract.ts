import { z } from "zod";
import type { PeriodComparison } from "@/lib/analytics/comparisons";
import type { AiSummaryPayload, MetricRow, ReportStatus } from "@/types/database";

export const reportPdfDefaults = {
  locale: "en" as const,
  pageSize: "A4" as const,
  includeSummary: true,
  includePlatforms: true,
  includeDetails: true,
};

export const reportPdfSections = ["includeSummary", "includePlatforms", "includeDetails"] as const;

/** Only saved version identifiers and presentation options cross the API boundary. */
export const reportExportSchema = z.object({
  reportVersionId: z.string().uuid(),
  revision: z.number().int().nonnegative(),
  locale: z.enum(["en", "ar"]).default(reportPdfDefaults.locale),
  pageSize: z.enum(["A4", "LETTER"]).default(reportPdfDefaults.pageSize),
  includeSummary: z.boolean().default(reportPdfDefaults.includeSummary),
  includePlatforms: z.boolean().default(reportPdfDefaults.includePlatforms),
  includeDetails: z.boolean().default(reportPdfDefaults.includeDetails),
}).strict();

export type ReportExportRequest = z.infer<typeof reportExportSchema>;
export type ReportPdfOptions = Omit<ReportExportRequest, "reportVersionId" | "revision">;

export type ReportPdfMetric = MetricRow & {
  accountId: string | null;
  accountName: string | null;
  accountStage: string | null;
};

/** Renderer input; populated exclusively by the server from reviewed, saved data. */
export type ReportPdfData = {
  report: {
    id: string;
    title: string;
    clientName: string;
    companyName: string | null;
    periodStart: string;
    periodEnd: string;
  };
  version: {
    id: string;
    number: number;
    revision: number;
    status: ReportStatus;
    publishedAt: string | null;
    summary: string | null;
    aiSummary: AiSummaryPayload | null;
  };
  metrics: ReportPdfMetric[];
  comparison: PeriodComparison;
  previousPeriod: {
    title: string;
    periodStart: string;
    periodEnd: string;
    versionNumber: number;
  } | null;
  excludedMetrics: number;
  totalMetrics: number;
  generatedAt: string;
};
