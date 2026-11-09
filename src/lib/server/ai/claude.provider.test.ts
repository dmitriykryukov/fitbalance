import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { FoodParseV1 } from '#lib/schemas/food-parse.js';
import { ClaudeProvider } from './claude.provider.js';
import { AIError } from './provider.js';

const good = {
	schema_version: '1',
	items: [
		{
			name: 'Fried eggs',
			quantity: 2,
			unit: 'piece',
			grams: 100,
			preparation: 'fried',
			is_assumption: false,
			nutrition_per_100g: { kcal: 196, protein_g: 13.6, carbs_g: 0.8, fat_g: 15.3, fibre_g: 0 },
			confidence: 0.85,
			uncertainties: ['Medium eggs assumed.']
		}
	],
	clarifying_questions: [],
	notes: []
};

function message(text: string, stop_reason = 'end_turn') {
	return {
		id: 'msg_test',
		type: 'message',
		role: 'assistant',
		model: 'claude-haiku-5-5',
		content: text ? [{ type: 'text', text }] : [],
		stop_reason,
		stop_sequence: null,
		usage: {
			input_tokens: 120,
			output_tokens: 80,
			cache_read_input_tokens: 900,
			cache_creation_input_tokens: 0
		}
	};
}

type Reply = (signal?: AbortSignal | null) => Response | Promise<Response>;

/** A provider whose HTTP layer returns canned responses (no network, no cost). */
function fake(reply: Reply) {
	const requests: { body: Record<string, unknown> }[] = [];
	const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
		requests.push({ body: JSON.parse(String(init?.body)) });
		if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
		return reply(init?.signal);
	};
	const client = new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 });
	return { provider: new ClaudeProvider(client), requests };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', ...headers }
	});

const apiError = (status: number, type: string) =>
	json({ type: 'error', error: { type, message: `${type} (test)` } }, status, {
		'retry-after-ms': '1'
	});

const call = {
	system: 'Static system prompt',
	messages: [{ role: 'user' as const, content: 'Two fried eggs' }],
	schema: FoodParseV1,
	model: 'claude-haiku-5-5',
	effort: 'low' as const,
	maxTokens: 8000,
	timeoutMs: 2000
};

async function failure(promise: Promise<unknown>): Promise<AIError> {
	try {
		await promise;
	} catch (error) {
		expect(error).toBeInstanceOf(AIError);
		return error as AIError;
	}
	throw new Error('expected the call to fail');
}

describe('ClaudeProvider.generateStructured', () => {
	it('returns parsed data and usage, and sends the expected request', async () => {
		const { provider, requests } = fake(() => json(message(JSON.stringify(good))));
		const { data, usage } = await provider.generateStructured(call);

		expect(data.items[0].name).toBe('Fried eggs');
		expect(usage).toMatchObject({
			provider: 'anthropic',
			model: 'claude-haiku-5-5',
			inputTokens: 1020, // uncached + cache reads
			outputTokens: 80
		});
		expect(usage.latencyMs).toBeGreaterThanOrEqual(0);

		const body = requests[0].body;
		expect(body.model).toBe('claude-haiku-5-5');
		expect(body.max_tokens).toBe(8000);
		expect(body.system).toEqual([
			{ type: 'text', text: 'Static system prompt', cache_control: { type: 'ephemeral' } }
		]);
		const config = body.output_config as { effort: string; format: { type: string } };
		expect(config.effort).toBe('low');
		expect(config.format.type).toBe('json_schema');
		expect(body).not.toHaveProperty('thinking');
		expect(body).not.toHaveProperty('temperature');
	});

	it('maps a refusal before reading content', async () => {
		const { provider } = fake(() => json(message('', 'refusal')));
		const error = await failure(provider.generateStructured(call));
		expect(error.kind).toBe('refused');
		expect(error.usage?.outputTokens).toBe(80);
	});

	it('treats output cut off by max_tokens as invalid', async () => {
		const { provider } = fake(() => json(message('{"schema_version":"1","items":[', 'max_tokens')));
		expect((await failure(provider.generateStructured(call))).kind).toBe('invalid');
	});

	it('treats non-JSON output as invalid', async () => {
		const { provider } = fake(() => json(message('Sorry, here are your eggs')));
		expect((await failure(provider.generateStructured(call))).kind).toBe('invalid');
	});

	it('treats out-of-range values as invalid', async () => {
		const bad = structuredClone(good);
		bad.items[0].nutrition_per_100g.kcal = 1500;
		const { provider } = fake(() => json(message(JSON.stringify(bad))));
		const error = await failure(provider.generateStructured(call));
		expect(error.kind).toBe('invalid');
		expect(error.message).toContain('nutrition_per_100g.kcal');
	});

	it('treats more than 3 clarifying questions as invalid', async () => {
		const bad = { ...good, clarifying_questions: ['a?', 'b?', 'c?', 'd?'] };
		const { provider } = fake(() => json(message(JSON.stringify(bad))));
		expect((await failure(provider.generateStructured(call))).kind).toBe('invalid');
	});

	it('maps 429 to rate_limited with retry-after', async () => {
		const { provider, requests } = fake(() =>
			json({ type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }, 429, {
				'retry-after': '7',
				'retry-after-ms': '1'
			})
		);
		const error = await failure(provider.generateStructured(call));
		expect(error.kind).toBe('rate_limited');
		expect(error.retryAfterSeconds).toBe(7);
		expect(error.usage?.inputTokens).toBeNull();
		expect(requests).toHaveLength(2); // one SDK retry
	});

	it('maps 5xx and overloaded to provider errors after one retry', async () => {
		for (const [status, type] of [
			[500, 'api_error'],
			[529, 'overloaded_error']
		] as const) {
			const { provider, requests } = fake(() => apiError(status, type));
			expect((await failure(provider.generateStructured(call))).kind).toBe('provider');
			expect(requests).toHaveLength(2);
		}
	});

	it('maps connection failures to provider errors', async () => {
		const { provider } = fake(() => {
			throw new TypeError('fetch failed');
		});
		expect((await failure(provider.generateStructured(call))).kind).toBe('provider');
	});

	it('maps a timeout', async () => {
		// Never answers; rejects only when the SDK aborts the request.
		const { provider, requests } = fake(
			(signal) =>
				new Promise<Response>((_, reject) =>
					signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
				)
		);
		const error = await failure(provider.generateStructured({ ...call, timeoutMs: 50 }));
		expect(error.kind).toBe('timeout');
		expect(requests).toHaveLength(2);
	});

	it('maps a bad API key or request to config (not shown to the user)', async () => {
		for (const [status, type] of [
			[401, 'authentication_error'],
			[400, 'invalid_request_error']
		] as const) {
			const { provider, requests } = fake(() => apiError(status, type));
			expect((await failure(provider.generateStructured(call))).kind).toBe('config');
			expect(requests).toHaveLength(1); // not retried
		}
	});

	it('refuses to start without an API key', () => {
		expect(() => ClaudeProvider.fromApiKey(undefined)).toThrow(AIError);
	});
});
