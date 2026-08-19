import type { BatchStatus, ReportStatus } from "@/types/database";

type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "destructive"
  | "muted";

/** Map a lifecycle status onto a badge tone. Kept in one place so the admin and
 * portal never disagree about what "needs_review" looks like. */
export function statusBadgeVariant(status: ReportStatus | BatchStatus): BadgeVariant {
  switch (status) {
    case "published":
    case "approved":
      return "success";
    case "needs_review":
      return "warning";
    case "processing":
    case "uploading":
      return "secondary";
    case "failed":
      return "destructive";
    case "archived":
      return "muted";
    case "uploaded":
      return "default";
    case "draft":
    default:
      return "outline";
  }
}
