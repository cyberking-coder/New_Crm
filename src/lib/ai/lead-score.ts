import { z } from "zod";
import { generateStructured } from "./anthropic";

export const leadScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  tier: z.enum(["cold", "warm", "hot"]),
  rationale: z.array(z.string().min(2).max(300)).min(2).max(6),
  suggested_action: z.string().min(2).max(400),
});

export type LeadScore = z.infer<typeof leadScoreSchema>;

export type ScoreSignals = {
  // Registrant basics
  email: string;
  full_name?: string | null;
  company?: string | null;
  phone?: string | null;
  // Attribution
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  // Attendance
  registered_at: string;
  attended: boolean;
  total_minutes_attended?: number | null;
  session_duration_minutes?: number | null;
  join_count?: number;
  // Engagement
  poll_responses?: number;
  questions_asked?: number;
  offers_clicked?: number;
  chat_messages?: number;
  // Webinar context
  webinar_title: string;
  webinar_type: string;
};

export async function scoreLead(signals: ScoreSignals) {
  const user = `Score this webinar registrant 0–100 and classify as cold/warm/hot.

Guidance:
- 70–100 (hot): attended most of a live session OR interacted (polls, questions, offer clicks). Reach out this week.
- 40–69 (warm): registered + attended briefly, or no attendance but strong signals (business email, named company).
- 0–39 (cold): no attendance, personal email, no engagement. Nurture via sequence.

Give 3–5 short rationale bullets grounded ONLY in the signals below. End with one suggested next action for a sales rep.

Signals:
${JSON.stringify(signals, null, 2)}`;

  const { value, model, inputTokens, outputTokens } = await generateStructured({
    system:
      "You are a B2B sales analyst. You score webinar leads for a sales team. Be concrete and conservative — only cite signals you can see.",
    user,
    schema: leadScoreSchema,
    schemaName: "LeadScore",
    maxTokens: 600,
  });

  return { score: value, model, inputTokens, outputTokens };
}
