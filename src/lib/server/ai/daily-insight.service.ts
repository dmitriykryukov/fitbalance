import { addDays } from '#lib/dates.js';
import { InsightOutput, type DailyInsight } from '#lib/schemas/coach.js';
import { ApiError } from '../api.js';
import { unwrap } from '../db.js';
import type { Profile } from '../services/profile.js';
import type { SupabaseServerClient } from '../supabase.js';
import { buildInsightContext, loadCoachRaw, loggedDays, type CoachRaw } from './coach-context.js';
import { recordFailure } from './errors.js';
import { AI_SETTINGS, getAIProvider } from './index.js';
import { INSIGHT_SYSTEM, insightUserMessage } from './prompts/coach.js';
import { assertWithinDailyLimit, logUsage } from './rate-limit.js';

/** Days with records in the last 7 needed before an insight is generated. */
export const MIN_INSIGHT_DAYS = 2;

/**
 * Why there is no insight: `not_enough_data` (fewer than 2 logged days in the
 * last 7), `past_date` (only today's insight is generated), `unavailable`
 * (generation failed or the attempt limit was reached). The card is hidden in
 * every case.
 */
export type InsightReason = 'not_enough_data' | 'past_date' | 'unavailable';

export type InsightResult =
	{ insight: DailyInsight; reason: null } | { insight: null; reason: InsightReason };

const FIELDS = 'local_date, title, body, created_at';

async function cached(
	sb: SupabaseServerClient,
	userId: string,
	date: string,
	locale: 'en' | 'ru'
): Promise<DailyInsight | null> {
	return unwrap(
		await sb
			.from('ai_daily_insights')
			.select(FIELDS)
			.eq('user_id', userId)
			.eq('local_date', date)
			.eq('locale', locale)
			.maybeSingle()
	);
}

/**
 * GET /api/ai/daily-insight: the insight for `date` in the user's language.
 * Today's is generated on the first request and stored; later requests (and
 * other days) only read the stored one. Failures never reach the user — the
 * card is simply hidden — but are logged to `ai_usage`, and at most
 * `dailyLimit` attempts are made per 24 h so a failing call is not retried on
 * every page view.
 */
export async function getDailyInsight(
	sb: SupabaseServerClient,
	userId: string,
	profile: Profile,
	today: string,
	date: string = today,
	/** Already-loaded records (the Coach page has them); loaded here otherwise. */
	preloaded?: CoachRaw
): Promise<InsightResult> {
	const locale = profile.locale === 'ru' ? 'ru' : 'en';
	const stored = await cached(sb, userId, date, locale);
	if (stored) return { insight: stored, reason: null };
	if (date !== today) return { insight: null, reason: 'past_date' };

	const raw = preloaded ?? (await loadCoachRaw(sb, userId, profile, today));
	if (loggedDays(raw, addDays(today, -6), today) < MIN_INSIGHT_DAYS) {
		return { insight: null, reason: 'not_enough_data' };
	}

	const settings = AI_SETTINGS.daily_insight;
	try {
		await assertWithinDailyLimit(sb, userId, 'daily_insight', settings.dailyLimit);
	} catch (error) {
		if (error instanceof ApiError && error.code === 'RATE_LIMITED') {
			return { insight: null, reason: 'unavailable' };
		}
		throw error;
	}

	let output: InsightOutput;
	let model: string;
	let provider: string;
	try {
		const result = await getAIProvider().generateStructured({
			system: INSIGHT_SYSTEM,
			messages: [{ role: 'user', content: insightUserMessage(buildInsightContext(raw), locale) }],
			schema: InsightOutput,
			model: settings.model,
			effort: settings.effort,
			maxTokens: settings.maxTokens,
			timeoutMs: settings.timeoutMs
		});
		await logUsage(sb, userId, 'daily_insight', result.usage, 'ok');
		output = result.data;
		model = result.usage.model;
		provider = result.usage.provider;
	} catch (error) {
		const failure = await recordFailure(sb, userId, 'daily_insight', error);
		if (failure.kind === 'config') console.error(`[ai] daily_insight config: ${failure.message}`);
		return { insight: null, reason: 'unavailable' };
	}

	// A parallel request may have stored one first: keep that one.
	const { error } = await sb
		.from('ai_daily_insights')
		.upsert(
			{ user_id: userId, local_date: today, locale, ...output, provider, model },
			{ onConflict: 'user_id,local_date,locale', ignoreDuplicates: true }
		);
	if (error) {
		console.error('[ai] could not store the daily insight', error.code, error.message);
		return { insight: null, reason: 'unavailable' };
	}
	const saved = await cached(sb, userId, today, locale);
	return saved ? { insight: saved, reason: null } : { insight: null, reason: 'unavailable' };
}
