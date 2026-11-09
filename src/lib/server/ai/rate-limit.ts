import { m } from '#lib/paraglide/messages.js';
import { ApiError } from '../api.js';
import { unwrap } from '../db.js';
import type { SupabaseServerClient } from '../supabase.js';
import type { AIFeature } from './index.js';
import type { AIUsage } from './provider.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export type UsageStatus = 'ok' | 'provider_error' | 'invalid_response' | 'timeout' | 'rate_limited';

/**
 * Throws RATE_LIMITED when the user already made `limit` calls of this
 * feature in the last 24 hours. `retry_after_seconds` is when the oldest of
 * those calls leaves the window. Users cannot delete `ai_usage` rows, so the
 * count cannot be reset from the browser.
 */
export async function assertWithinDailyLimit(
	sb: SupabaseServerClient,
	userId: string,
	feature: AIFeature,
	limit: number,
	now = new Date()
): Promise<void> {
	const since = new Date(now.getTime() - DAY_MS);
	const result = await sb
		.from('ai_usage')
		.select('created_at', { count: 'exact' })
		.eq('user_id', userId)
		.eq('feature', feature)
		.gt('created_at', since.toISOString())
		.order('created_at', { ascending: true })
		.limit(1);
	const rows = unwrap(result) ?? [];
	const used = result.count ?? 0;
	if (used < limit) return;

	const oldest = rows[0] ? new Date(rows[0].created_at).getTime() : now.getTime();
	const retryAfter = Math.max(1, Math.ceil((oldest + DAY_MS - now.getTime()) / 1000));
	throw new ApiError('RATE_LIMITED', m.ai_error_daily_limit(), undefined, retryAfter);
}

/**
 * Appends one `ai_usage` row: tokens, latency and status only — never the
 * meal text or the model's reply. A logging failure is reported server-side
 * and does not fail the user's request.
 */
export async function logUsage(
	sb: SupabaseServerClient,
	userId: string,
	feature: AIFeature,
	usage: AIUsage,
	status: UsageStatus
): Promise<void> {
	const { error } = await sb.from('ai_usage').insert({
		user_id: userId,
		feature,
		provider: usage.provider,
		model: usage.model,
		input_tokens: usage.inputTokens,
		output_tokens: usage.outputTokens,
		latency_ms: usage.latencyMs,
		status
	});
	if (error) console.error('[ai] could not log usage', error.code, error.message);
}
