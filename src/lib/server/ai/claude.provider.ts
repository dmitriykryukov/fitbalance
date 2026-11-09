import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import {
	AIError,
	type AIEffort,
	type AIMessage,
	type AIProvider,
	type AIUsage
} from './provider.js';

type Call = {
	system: string;
	messages: AIMessage[];
	model: string;
	effort: AIEffort;
	maxTokens: number;
	timeoutMs: number;
	fallback?: boolean;
};

/** Beta header for the `fallbacks: "default"` form (the array form uses another one). */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

type TokenUsage = Pick<
	Anthropic.Usage,
	'input_tokens' | 'output_tokens' | 'cache_read_input_tokens' | 'cache_creation_input_tokens'
>;

function usageOf(model: string, started: number, usage?: TokenUsage): AIUsage {
	return {
		provider: 'anthropic',
		model,
		// Cached and uncached input both count towards what the call used.
		inputTokens: usage
			? usage.input_tokens +
				(usage.cache_read_input_tokens ?? 0) +
				(usage.cache_creation_input_tokens ?? 0)
			: null,
		outputTokens: usage ? usage.output_tokens : null,
		latencyMs: Math.max(0, Math.round(performance.now() - started))
	};
}

function retryAfter(headers: Headers | undefined): number | undefined {
	const value = Number(headers?.get('retry-after'));
	return Number.isFinite(value) && value > 0 ? Math.ceil(value) : undefined;
}

/** SDK errors → AIError, by typed class (never by message text). */
function mapError(error: unknown, usage: AIUsage): AIError {
	if (error instanceof AIError) return error;
	if (error instanceof Anthropic.RateLimitError) {
		return new AIError('rate_limited', error.message, usage, retryAfter(error.headers));
	}
	if (error instanceof Anthropic.APIConnectionTimeoutError) {
		return new AIError('timeout', error.message, usage);
	}
	if (
		error instanceof Anthropic.AuthenticationError ||
		error instanceof Anthropic.PermissionDeniedError ||
		error instanceof Anthropic.BadRequestError ||
		error instanceof Anthropic.NotFoundError ||
		error instanceof Anthropic.UnprocessableEntityError
	) {
		return new AIError('config', `${error.status}: ${error.message}`, usage);
	}
	if (error instanceof Anthropic.APIError) {
		// 5xx, 529 overloaded, connection errors and anything else from the API.
		return new AIError('provider', error.message, usage);
	}
	return new AIError('provider', error instanceof Error ? error.message : String(error), usage);
}

/**
 * Claude via the Anthropic SDK. One SDK retry per call; adaptive thinking
 * (the model's default) with depth set by `effort`. The system prompt is
 * marked cacheable.
 */
export class ClaudeProvider implements AIProvider {
	readonly name = 'anthropic';

	constructor(private readonly client: Anthropic) {}

	static fromApiKey(apiKey: string | undefined): ClaudeProvider {
		if (!apiKey) {
			// Reported as INTERNAL_ERROR; the reason is logged server-side only.
			throw new AIError('config', 'ANTHROPIC_API_KEY is not set');
		}
		return new ClaudeProvider(new Anthropic({ apiKey, maxRetries: 1 }));
	}

	private request(call: Call, format?: ReturnType<typeof zodOutputFormat>) {
		const params = {
			model: call.model,
			max_tokens: call.maxTokens,
			system: [
				{ type: 'text' as const, text: call.system, cache_control: { type: 'ephemeral' as const } }
			],
			messages: call.messages,
			output_config: format ? { effort: call.effort, format } : { effort: call.effort }
		};
		const options = { timeout: call.timeoutMs, maxRetries: 1 };
		if (!call.fallback) return this.client.messages.create(params, options);
		// A safety decline is re-run on Anthropic's recommended fallback model in
		// the same call; `stop_reason: "refusal"` then means the whole chain declined.
		return this.client.beta.messages.create(
			{ ...params, betas: [FALLBACK_BETA], fallbacks: 'default' },
			options
		);
	}

	private async send(call: Call, format?: ReturnType<typeof zodOutputFormat>) {
		const started = performance.now();
		let response: Awaited<ReturnType<ClaudeProvider['request']>>;
		try {
			response = await this.request(call, format);
		} catch (error) {
			throw mapError(error, usageOf(call.model, started));
		}

		// `response.model` names the model that answered (the fallback, if one ran).
		const usage = usageOf(response.model || call.model, started, response.usage);
		// Check why the model stopped before reading any content.
		if (response.stop_reason === 'refusal') {
			throw new AIError('refused', 'The model declined the request', usage);
		}
		if (response.stop_reason === 'max_tokens') {
			throw new AIError('invalid', 'Output was cut off by max_tokens', usage);
		}
		const text = (response.content as { type: string; text?: string }[])
			.filter((block) => block.type === 'text')
			.map((block) => block.text ?? '')
			.join('');
		return { text, usage };
	}

	async generateStructured<S extends z.ZodType>(
		input: Call & { schema: S }
	): Promise<{ data: z.output<S>; usage: AIUsage }> {
		const { text, usage } = await this.send(input, zodOutputFormat(input.schema));
		let json: unknown;
		try {
			json = JSON.parse(text);
		} catch {
			throw new AIError('invalid', 'Structured output was not valid JSON', usage);
		}
		const result = input.schema.safeParse(json);
		if (!result.success) {
			const issues = result.error.issues
				.slice(0, 5)
				.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
				.join('; ');
			throw new AIError('invalid', `Structured output failed validation: ${issues}`, usage);
		}
		return { data: result.data, usage };
	}

	async generateText(input: Call): Promise<{ text: string; usage: AIUsage }> {
		const { text, usage } = await this.send(input);
		if (!text.trim()) throw new AIError('invalid', 'Empty reply', usage);
		return { text, usage };
	}
}
