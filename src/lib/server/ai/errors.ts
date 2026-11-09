import { m } from '#lib/paraglide/messages.js';
import { ApiError } from '../api.js';
import type { SupabaseServerClient } from '../supabase.js';
import type { AIFeature } from './index.js';
import { AIError, type AIErrorKind } from './provider.js';
import { logUsage, type UsageStatus } from './rate-limit.js';

/** `ai_usage.status` for each failure (refusals count as invalid responses). */
export const USAGE_STATUS: Record<AIErrorKind, UsageStatus> = {
	rate_limited: 'rate_limited',
	timeout: 'timeout',
	provider: 'provider_error',
	refused: 'invalid_response',
	invalid: 'invalid_response',
	config: 'provider_error'
};

/** AIError → the API error envelope (AI_SPEC.md → Error mapping). */
export function aiApiError(error: AIError): Error {
	switch (error.kind) {
		case 'rate_limited':
			return new ApiError('RATE_LIMITED', m.ai_error_busy(), undefined, error.retryAfterSeconds);
		case 'timeout':
		case 'provider':
			return new ApiError('AI_PROVIDER_ERROR', m.ai_error_provider());
		case 'refused':
			return new ApiError('AI_REFUSED', m.ai_error_refused());
		case 'invalid':
			return new ApiError('AI_INVALID_RESPONSE', m.ai_error_invalid());
		case 'config':
			// A setup problem, not the user's: INTERNAL_ERROR, details in the server log.
			return new Error(`[ai] configuration: ${error.message}`);
	}
}

/**
 * Logs a failed call to `ai_usage` (when it reached the provider) and the
 * server log. Returns the AIError, or rethrows anything that is not one.
 */
export async function recordFailure(
	sb: SupabaseServerClient,
	userId: string,
	feature: AIFeature,
	error: unknown
): Promise<AIError> {
	if (!(error instanceof AIError)) throw error;
	if (error.usage) await logUsage(sb, userId, feature, error.usage, USAGE_STATUS[error.kind]);
	if (error.kind !== 'config') console.warn(`[ai] ${feature} ${error.kind}: ${error.message}`);
	return error;
}
