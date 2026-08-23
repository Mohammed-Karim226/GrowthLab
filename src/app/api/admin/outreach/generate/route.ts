import { z } from "zod";
import { apiOk, parseBody, withAdmin } from "@/lib/api";
import { AiProviderError, getAiProvider } from "@/lib/ai";

const inputSchema = z.object({ contact: z.object({ name: z.string(), company: z.string().nullable(), channel: z.string().nullable(), notes: z.string().nullable() }), sender: z.object({ name: z.string(), title: z.string().nullable() }).nullable(), goal: z.string().trim().min(3).max(500), tone: z.enum(["professional", "warm", "direct"]), context: z.string().max(2000).optional() });
const outputSchema = z.object({ subject: z.string().min(3).max(120), body: z.string().min(20).max(5000), rationale: z.string().max(500), warnings: z.array(z.string().max(300)).max(5).default([]) });

export const POST = withAdmin("generateOutreach", async (_session, request) => {
  const parsed = await parseBody(request, inputSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  const fallback = { subject: `A focused idea for ${input.contact.channel || input.contact.company || input.contact.name}`, body: `Hi ${input.contact.name},\n\nI have been looking at ${input.contact.channel || input.contact.company || "your work"} and noticed an opportunity that may support your next stage of growth.\n\nI would be glad to share the idea in a short conversation. If it is not relevant right now, no pressure at all.\n\nBest,\n${input.sender?.name || "GrowthLab"}`, rationale: "A concise, personalized starter that avoids pressure and keeps one clear next step.", warnings: ["Add one genuine observation about the recipient before sending."], source: "fallback" as const };
  try {
    const result = await getAiProvider().complete({ temperature: 0.65, maxOutputTokens: 1200, systemInstruction: "Write a concise human B2B outreach email. Return JSON only: subject, body, rationale, warnings. Use the requested tone. Include one credible personalized observation only when supported by the supplied context. Never invent metrics, praise, relationships, or urgency. Avoid spam language and keep one low-friction CTA. Plain text only.", prompt: JSON.stringify(input) });
    const validated = outputSchema.safeParse(result.json);
    if (validated.success) return apiOk({ ...validated.data, source: "ai" as const });
  } catch (error) { if (!(error instanceof AiProviderError)) console.error("[api:generateOutreach:ai]", error); }
  return apiOk(fallback);
});
