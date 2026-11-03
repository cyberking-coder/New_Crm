import { z } from "zod";
import { generateStructured } from "./anthropic";

export const engagementSummarySchema = z.object({
  summary: z.string().min(10).max(2000),
  highlights: z.array(z.string().min(2).max(240)).max(8),
  top_questions: z.array(z.string().min(2).max(240)).max(10),
  risks: z.array(z.string().min(2).max(240)).max(6),
});

export type EngagementSummary = z.infer<typeof engagementSummarySchema>;

export type EngagementInput = {
  webinar_title: string;
  webinar_type: string;
  session_scheduled_at: string | null;
  session_duration_minutes: number | null;
  registrants: number;
  attendees: number;
  avg_attendance_minutes: number | null;
  poll_responses: number;
  questions: { body: string; status: string }[];
  offers_shown: number;
  offers_clicked: number;
  chat_messages: number;
  reactions: number;
};

export async function summarizeEngagement(input: EngagementInput) {
  const user = `Summarize how this webinar session went for the team.

Return:
- summary: 2–4 sentences, plain language, no fluff
- highlights: up to 5 concrete positives, each one short
- top_questions: the most important attendee questions verbatim (dedupe near-duplicates), empty array if none
- risks: up to 3 things to improve (low show-up, poor retention, unanswered questions), empty if none

Signals:
${JSON.stringify(input, null, 2)}`;

  const { value, model, inputTokens, outputTokens } = await generateStructured({
    system:
      "You write short, honest post-webinar debriefs for marketing and sales teams. Be concrete, no corporate-speak.",
    user,
    schema: engagementSummarySchema,
    schemaName: "EngagementSummary",
    maxTokens: 1200,
  });

  return { summary: value, model, inputTokens, outputTokens };
}
