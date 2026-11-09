import type { z } from 'zod';

/** What one AI call cost; stored in `ai_usage` (never the prompt or the reply). */
export type AIUsage = {
	provider: string;
	model: string;
	/** Null when the call failed before the provider reported usage. */
	inputTokens: number | null;
	outputTokens: number | null;
	latencyMs: number;
};

export type AIMessage = { role: 'user' | 'assistant'; content: string };

export type AIEffort = 'low' | 'medium' | 'high';

type CallOptions = {
	/** Static and cacheable: no dates and no user data. */
	system: string;
	messages: AIMessage[];
	model: string;
	effort: AIEffort;
	maxTokens: number;
	timeoutMs: number;
};

export interface AIProvider {
	readonly name: string;
	generateStructured<S extends z.ZodType>(
		input: CallOptions & { schema: S }
	): Promise<{ data: z.output<S>; usage: AIUsage }>;
	generateText(input: CallOptions): Promise<{ text: string; usage: AIUsage }>;
}

/**
 * Why an AI call failed, independent of the provider:
 * - `rate_limited`: the provider returned 429
 * - `timeout`: no answer within the time limit
 * - `provider`: 5xx, overloaded or connection error
 * - `refused`: the model declined the request
 * - `invalid`: output cut off by max_tokens, not JSON, or failed the schema
 * - `config`: missing/invalid API key or a request the provider rejects (a bug)
 */
export type AIErrorKind =
	'rate_limited' | 'timeout' | 'provider' | 'refused' | 'invalid' | 'config';

export class AIError extends Error {
	constructor(
		readonly kind: AIErrorKind,
		message: string,
		/** Present when the call reached the provider (for `ai_usage`). */
		readonly usage?: AIUsage,
		readonly retryAfterSeconds?: number
	) {
		super(message);
		this.name = 'AIError';
	}
}
