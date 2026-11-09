import { z } from 'zod';
import { MIN_LOCAL_DATE } from '#lib/dates.js';

/** `POST /api/ai/coach` (AI_SPEC.md → AI Coach → Request). */
export const CoachRequest = z.strictObject({
	conversation_id: z.uuid().nullable().default(null),
	message: z.string().trim().min(1).max(2000)
});
export type CoachRequest = z.output<typeof CoachRequest>;

/** `GET /api/ai/daily-insight?date=` (date defaults to the user's today). */
export const DailyInsightQuery = z.strictObject({
	date: z.iso
		.date()
		.refine((d) => d >= MIN_LOCAL_DATE, { message: 'Date is too early' })
		.optional()
});

/**
 * Daily insight structured output. The prompt asks for less (80 / 350
 * characters); these limits are the database's, so anything longer is
 * rejected as invalid instead of being cut.
 */
export const InsightOutput = z.object({
	title: z.string().trim().min(1).max(120).describe('One short line, no trailing period'),
	body: z.string().trim().min(1).max(600).describe('1-3 sentences with one concrete action')
});
export type InsightOutput = z.output<typeof InsightOutput>;

export type CoachMessage = {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	created_at: string;
};

export type CoachReply = { conversation_id: string; message: CoachMessage };

export type ConversationSummary = {
	id: string;
	title: string | null;
	created_at: string;
	updated_at: string;
};

export type DailyInsight = {
	local_date: string;
	title: string;
	body: string;
	created_at: string;
};
