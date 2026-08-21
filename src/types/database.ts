/**
 * Hand-maintained mirror of supabase/migrations/0001_init.sql.
 *
 * Kept hand-written rather than generated so the schema contract is reviewable
 * in the same PR as the migration. If you change the migration, change this.
 */

export type Platform = "facebook" | "instagram" | "tiktok" | "youtube";

export const PLATFORMS: readonly Platform[] = [
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
] as const;

export type UserRole = "admin" | "client";

export type ReportStatus =
  | "draft"
  | "processing"
  | "needs_review"
  | "approved"
  | "published"
  | "archived"
  | "failed";

export type BatchStatus =
  | "draft"
  | "uploading"
  | "uploaded"
  | "processing"
  | "needs_review"
  | "approved"
  | "failed";

export type MetricSource = "ai" | "manual" | "calculated" | "imported";

export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";
export type AiJobStatus = "queued" | "processing" | "completed" | "failed" | "dead_letter";

export type ClientRow = {
  id: string;
  name: string;
  contact_email: string | null;
  company_name: string | null;
  avatar_url: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PaymentStatus = "pending" | "paid" | "overdue" | "waived";

export type ClientPaymentPlanRow = {
  id: string;
  client_id: string;
  billing_month: string;
  amount: number;
  total_plan_price: number | null;
  currency: string;
  status: PaymentStatus;
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  role: UserRole;
  client_id: string | null;
  full_name: string | null;
  created_at: string;
  updated_at: string;
};

export type ReportRow = {
  id: string;
  client_id: string;
  title: string;
  period_start: string;
  period_end: string;
  current_published_version_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Shape stored in report_versions.ai_summary. Validated by Zod before write. */
export type AiSummaryPayload = {
  summary: string;
  went_well: string[];
  what_changed: string[];
  needs_attention: string[];
  recommendations: string[];
  generated_at: string;
};

export type ReportVersionRow = {
  id: string;
  report_id: string;
  version_number: number;
  status: ReportStatus;
  summary: string | null;
  ai_summary: AiSummaryPayload | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type InsightBatchRow = {
  id: string;
  report_version_id: string;
  platform: Platform;
  account_id: string | null;
  status: BatchStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AccountRow = {
  id: string;
  client_id: string;
  platform: Platform;
  page_name: string | null;
  page_id: string | null;
  stage: string | null;
  created_at: string;
  updated_at: string;
};

export type InsightImageRow = {
  id: string;
  insight_batch_id: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  sort_order: number;
  uploaded_by: string | null;
  uploaded_at: string;
};

export type AiAnalysisRow = {
  id: string;
  insight_batch_id: string;
  provider: string;
  model: string;
  attempt: number;
  status: AnalysisStatus;
  raw_response: string | null;
  structured_response: unknown;
  error_message: string | null;
  image_count: number;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
};

export type AiJobRow = {
  id: string;
  insight_batch_id: string;
  status: AiJobStatus;
  force_run: boolean;
  attempts: number;
  max_attempts: number;
  available_at: string;
  locked_by: string | null;
  lease_expires_at: string | null;
  requested_by: string | null;
  result: Record<string, unknown> | null;
  error_key: string | null;
  error_detail: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type MetricRow = {
  id: string;
  report_version_id: string;
  insight_batch_id: string | null;
  platform: Platform;
  metric_name: string;
  metric_value: number | null;
  metric_unit: string;
  metric_date: string | null;
  source: MetricSource;
  confidence: number | null;
  needs_review: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

/** Columns the database fills in for us on insert. */
type Generated = "id" | "created_at" | "updated_at";

type InsertOf<Row, Optional extends keyof Row = never> = Omit<
  Row,
  Extract<Generated, keyof Row> | Optional
> &
  Partial<Pick<Row, Extract<Generated, keyof Row> | Optional>>;

type Table<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      clients: Table<
        ClientRow,
        InsertOf<
          ClientRow,
          "contact_email" | "company_name" | "avatar_url" | "notes" | "is_active"
        >
      >;
      client_payment_plans: Table<
        ClientPaymentPlanRow,
        InsertOf<ClientPaymentPlanRow, "total_plan_price" | "due_date" | "paid_at" | "notes" | "status" | "currency">
      >;
      profiles: Table<
        ProfileRow,
        InsertOf<ProfileRow, "role" | "client_id" | "full_name"> & { id: string }
      >;
      reports: Table<
        ReportRow,
        InsertOf<ReportRow, "current_published_version_id" | "created_by">
      >;
      report_versions: Table<
        ReportVersionRow,
        InsertOf<
          ReportVersionRow,
          "status" | "summary" | "ai_summary" | "created_by" | "published_at"
        >
      >;
      insight_batches: Table<
        InsightBatchRow,
        InsertOf<InsightBatchRow, "account_id" | "status" | "notes">
      >;
      accounts: Table<
        AccountRow,
        InsertOf<AccountRow, "page_name" | "page_id" | "stage">
      >;
      insight_images: Table<
        InsightImageRow,
        Omit<InsightImageRow, "id" | "uploaded_at"> & {
          id?: string;
          uploaded_at?: string;
        }
      >;
      ai_analyses: Table<
        AiAnalysisRow,
        InsertOf<
          AiAnalysisRow,
          | "attempt"
          | "status"
          | "raw_response"
          | "structured_response"
          | "error_message"
          | "image_count"
          | "created_by"
          | "completed_at"
        >
      >;
      ai_jobs: Table<
        AiJobRow,
        InsertOf<
          AiJobRow,
          | "status"
          | "force_run"
          | "attempts"
          | "max_attempts"
          | "available_at"
          | "locked_by"
          | "lease_expires_at"
          | "requested_by"
          | "result"
          | "error_key"
          | "error_detail"
          | "started_at"
          | "completed_at"
        >
      >;
      metrics: Table<
        MetricRow,
        InsertOf<
          MetricRow,
          | "insight_batch_id"
          | "metric_value"
          | "metric_unit"
          | "metric_date"
          | "source"
          | "confidence"
          | "needs_review"
          | "note"
        >
      >;
      audit_logs: Table<
        AuditLogRow,
        Omit<AuditLogRow, "id" | "created_at"> & { id?: string; created_at?: string }
      >;
    };
    Views: Record<never, never>;
    Functions: {
      auth_role: { Args: Record<never, never>; Returns: UserRole };
      auth_client_id: { Args: Record<never, never>; Returns: string | null };
      is_admin: { Args: Record<never, never>; Returns: boolean };
      enqueue_ai_job: {
        Args: { batch_id: string; force_requested?: boolean };
        Returns: AiJobRow;
      };
      claim_ai_job: {
        Args: { worker_name: string; lease_seconds?: number };
        Returns: AiJobRow | null;
      };
      finish_ai_job: {
        Args: { job_id: string; job_result: Record<string, unknown> };
        Returns: undefined;
      };
      fail_ai_job: {
        Args: {
          job_id: string;
          failure_key: string;
          failure_detail: string;
          retry_delay_seconds?: number;
        };
        Returns: AiJobStatus;
      };
    };
    Enums: {
      platform_type: Platform;
      user_role: UserRole;
      report_status: ReportStatus;
      batch_status: BatchStatus;
      metric_source: MetricSource;
      analysis_status: AnalysisStatus;
      ai_job_status: AiJobStatus;
    };
    CompositeTypes: Record<never, never>;
  };
};
