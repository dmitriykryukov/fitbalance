import {
	AI_DAILY_COACH_LIMIT,
	AI_DAILY_FOOD_PARSE_LIMIT,
	AI_FOOD_PARSER_MODEL,
	ANTHROPIC_API_KEY
} from '$app/env/private';
import { ClaudeProvider } from './claude.provider.js';
import type { AIProvider } from './provider.js';

export type AIFeature = 'food_parse' | 'coach' | 'daily_insight';

/** Per-feature settings (AI_SPEC.md → Models and settings). */
export const AI_SETTINGS = {
	food_parse: {
		model: AI_FOOD_PARSER_MODEL,
		effort: 'low',
		maxTokens: 8000,
		timeoutMs: 30_000,
		dailyLimit: AI_DAILY_FOOD_PARSE_LIMIT
	},
	coach: { dailyLimit: AI_DAILY_COACH_LIMIT }
} as const;

let provider: AIProvider | undefined;
let override: AIProvider | undefined;

/** The configured provider (Claude). Throws AIError('config') without an API key. */
export function getAIProvider(): AIProvider {
	if (override) return override;
	provider ??= ClaudeProvider.fromApiKey(ANTHROPIC_API_KEY);
	return provider;
}

/** Tests only: replace the provider with a fake (pass undefined to restore). */
export function setAIProviderForTests(fake: AIProvider | undefined): void {
	override = fake;
}
