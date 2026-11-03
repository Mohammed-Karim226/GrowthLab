import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest/client";
import { processAiInsights } from "@/lib/inngest/functions";
import { cleanupDeletedReports } from "@/lib/inngest/report-cleanup";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processAiInsights, cleanupDeletedReports],
});
