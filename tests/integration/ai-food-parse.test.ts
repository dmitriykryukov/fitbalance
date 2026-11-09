import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { localDate } from '../../src/lib/dates.js';
import type { FoodParseV1 } from '../../src/lib/schemas/food-parse.js';
import { AI_SETTINGS, setAIProviderForTests } from '../../src/lib/server/ai/index.js';
import { AIError, type AIProvider, type AIUsage } from '../../src/lib/server/ai/provider.js';
import * as foodParse from '../../src/routes/api/ai/food-parse/+server.js';
import * as foods from '../../src/routes/api/foods/+server.js';
import * as meals from '../../src/routes/api/meals/+server.js';
import { call, createTestUser, deleteTestUser, type TestUser } from './helpers.js';

const DAY = localDate('UTC');

const usage: AIUsage = {
	provider: 'anthropic',
	model: 'test-model',
	inputTokens: 1200,
	outputTokens: 300,
	latencyMs: 850
};

const output: FoodParseV1 = {
	schema_version: '1',
	items: [
		{
			name: 'OATMEAL',
			quantity: 1,
			unit: 'bowl',
			grams: 250,
			preparation: 'boiled',
			is_assumption: false,
			nutrition_per_100g: { kcal: 70, protein_g: 2.5, carbs_g: 12, fat_g: 1.4, fibre_g: 1.7 },
			confidence: 0.8,
			uncertainties: ['Bowl size assumed.']
		},
		{
			name: 'Butter',
			quantity: 1,
			unit: 'tsp',
			grams: 5,
			preparation: null,
			is_assumption: true,
			// 0.9·4 + 0.1·4 + 81·9 = 733: within range of the 717 stated
			nutrition_per_100g: { kcal: 717, protein_g: 0.9, carbs_g: 0.1, fat_g: 81, fibre_g: 0 },
			confidence: 0.3,
			uncertainties: ['Not mentioned; remove if none was used.']
		},
		{
			name: 'Honey',
			quantity: null,
			unit: null,
			grams: null,
			preparation: null,
			is_assumption: false,
			// Energy that does not add up → a warning, not a correction.
			nutrition_per_100g: { kcal: 600, protein_g: 0.3, carbs_g: 82, fat_g: 0, fibre_g: 0.2 },
			confidence: 0.4,
			uncertainties: []
		}
	],
	clarifying_questions: ['How much honey?'],
	notes: []
};

/** A provider that replays whatever the current test sets in `next`. */
let next: () => Promise<{ data: unknown; usage: AIUsage }>;
const calls: Parameters<AIProvider['generateStructured']>[0][] = [];
const fake: AIProvider = {
	name: 'fake',
	async generateStructured(input) {
		calls.push(input);
		return next() as never;
	},
	async generateText() {
		throw new Error('not used');
	}
};

let a: TestUser;
let limited: TestUser;

async function usageRows(user: TestUser) {
	const { data, error } = await user.client
		.from('ai_usage')
		.select('*')
		.order('created_at', { ascending: true });
	if (error) throw error;
	return data;
}

const parse = (user: TestUser | null, body: unknown) =>
	call(foodParse.POST, user, { url: '/api/ai/food-parse', body });

beforeAll(async () => {
	setAIProviderForTests(fake);
	[a, limited] = await Promise.all([createTestUser('ai-a'), createTestUser('ai-limit')]);
	// A saved food with the same name in another case → "Use my saved values".
	const res = await call(foods.POST, a, {
		url: '/api/foods',
		body: {
			name: 'Oatmeal',
			kcal_per_100g: 71,
			protein_per_100g: 2.5,
			carbs_per_100g: 12,
			fat_per_100g: 1.5
		}
	});
	expect(res.status).toBe(201);
});

afterEach(() => {
	calls.length = 0;
});

afterAll(async () => {
	setAIProviderForTests(undefined);
	await Promise.all([deleteTestUser(a), deleteTestUser(limited)]);
});

describe('POST /api/ai/food-parse', () => {
	it('requires a session', async () => {
		const res = await parse(null, { description: 'Eggs' });
		expect(res.status).toBe(401);
		expect(calls).toHaveLength(0);
	});

	it('validates the body before calling the AI', async () => {
		for (const body of [
			{ description: '' },
			{ description: 'x'.repeat(1001) },
			{ description: 'Eggs', model: 'claude-opus-5-5' },
			{ description: 'Eggs', meal_type: 'brunch' }
		]) {
			const res = await parse(a, body);
			expect(res.status).toBe(422);
			expect(res.body.error.code).toBe('VALIDATION_ERROR');
		}
		expect(calls).toHaveLength(0);
	});

	it('returns checked estimates, saves nothing and logs usage without content', async () => {
		next = async () => ({ data: output, usage });
		const res = await parse(a, {
			description: 'Овсянка с мёдом',
			meal_type: 'breakfast'
		});
		expect(res.status).toBe(200);
		const data = res.body.data;

		// The model gets the static prompt and the profile locale; the client can't pick a model.
		expect(calls[0].model).toBe(AI_SETTINGS.food_parse.model);
		expect(calls[0].effort).toBe('low');
		expect(calls[0].messages[0].content).toContain('App language: en');
		expect(calls[0].messages[0].content).toContain('Овсянка с мёдом');
		expect(calls[0].system).not.toContain('Овсянка');

		const [oats, butter, honey] = data.items;
		expect(oats.my_food_match).toMatchObject({ name: 'Oatmeal' });
		expect(oats.my_food_match.nutrition_per_100g.kcal).toBe(71);
		expect(oats.preview).toEqual({
			kcal: 175,
			protein_g: 6.3,
			carbs_g: 30,
			fat_g: 3.5,
			fibre_g: 4.3
		});
		expect(butter.is_assumption).toBe(true);
		expect(butter.warnings).toEqual([]);
		expect(honey.grams).toBeNull();
		expect(honey.preview).toBeNull();
		expect(honey.warnings).toEqual(['energy_mismatch']);
		expect(data.preview_total.kcal).toBe(175 + 35.9);
		expect(data.clarifying_questions).toEqual(['How much honey?']);

		const rows = await usageRows(a);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			feature: 'food_parse',
			provider: 'anthropic',
			model: 'test-model',
			input_tokens: 1200,
			output_tokens: 300,
			latency_ms: 850,
			status: 'ok'
		});
		expect(Object.keys(rows[0]).sort()).toEqual(
			[
				'created_at',
				'feature',
				'id',
				'input_tokens',
				'latency_ms',
				'model',
				'output_tokens',
				'provider',
				'status',
				'user_id'
			].sort()
		);

		const mealsRes = await call(meals.GET, a, { url: `/api/meals?date=${DAY}` });
		expect(mealsRes.body.data.meals).toHaveLength(0);
	});

	it('uses the Russian profile locale', async () => {
		await a.client.from('profiles').update({ locale: 'ru' }).eq('id', a.id);
		next = async () => ({ data: output, usage });
		await parse(a, { description: 'Гречка' });
		expect(calls[0].messages[0].content).toContain('App language: ru');
		await a.client.from('profiles').update({ locale: 'en' }).eq('id', a.id);
	});

	it.each([
		['refused', 422, 'AI_REFUSED', 'invalid_response'],
		['invalid', 502, 'AI_INVALID_RESPONSE', 'invalid_response'],
		['timeout', 502, 'AI_PROVIDER_ERROR', 'timeout'],
		['provider', 502, 'AI_PROVIDER_ERROR', 'provider_error'],
		['rate_limited', 429, 'RATE_LIMITED', 'rate_limited']
	] as const)('maps %s to %i %s and logs %s', async (kind, status, code, logged) => {
		next = async () => {
			throw new AIError(kind, `${kind} (test)`, usage, kind === 'rate_limited' ? 30 : undefined);
		};
		const before = (await usageRows(a)).length;
		const res = await parse(a, { description: 'Something' });
		expect(res.status).toBe(status);
		expect(res.body.error.code).toBe(code);
		expect(res.body.error.message).not.toContain('(test)'); // provider details stay server-side
		if (kind === 'rate_limited') expect(res.body.error.retry_after_seconds).toBe(30);
		const rows = await usageRows(a);
		expect(rows).toHaveLength(before + 1);
		expect(rows.at(-1)!.status).toBe(logged);
	});

	it('reports a configuration problem as INTERNAL_ERROR', async () => {
		next = async () => {
			throw new AIError('config', 'ANTHROPIC_API_KEY is not set');
		};
		const res = await parse(a, { description: 'Something' });
		expect(res.status).toBe(500);
		expect(res.body.error.code).toBe('INTERNAL_ERROR');
		expect(res.body.error.message).not.toContain('ANTHROPIC');
	});

	it('stops at the daily limit without calling the AI', async () => {
		const limit = AI_SETTINGS.food_parse.dailyLimit;
		const rows = Array.from({ length: limit }, () => ({
			user_id: limited.id,
			feature: 'food_parse',
			provider: 'anthropic',
			model: 'test-model',
			status: 'ok'
		}));
		const { error } = await limited.client.from('ai_usage').insert(rows);
		expect(error).toBeNull();

		next = async () => ({ data: output, usage });
		const res = await parse(limited, { description: 'Eggs' });
		expect(res.status).toBe(429);
		expect(res.body.error.code).toBe('RATE_LIMITED');
		expect(res.body.error.retry_after_seconds).toBeGreaterThan(86_000);
		expect(calls).toHaveLength(0);

		// Users cannot reset their quota.
		await limited.client.from('ai_usage').delete().eq('user_id', limited.id);
		expect(await usageRows(limited)).toHaveLength(limit);
	});

	it('the reviewed items save as an AI meal with database totals', async () => {
		next = async () => ({ data: output, usage });
		const parsed = (await parse(a, { description: 'Oatmeal with butter' })).body.data;
		const [oats, butter] = parsed.items;

		const res = await call(meals.POST, a, {
			url: '/api/meals',
			body: {
				local_date: DAY,
				meal_type: 'breakfast',
				input_method: 'ai',
				ai_description: 'Oatmeal with butter',
				items: [
					{
						name: oats.my_food_match.name,
						quantity: 1,
						unit: 'bowl',
						grams: 250,
						nutrition_per_100g: oats.my_food_match.nutrition_per_100g,
						estimate_source: 'my_food',
						food_item_id: oats.my_food_match.id
					},
					{
						name: butter.name,
						quantity: 1,
						unit: 'tsp',
						grams: butter.grams,
						nutrition_per_100g: butter.nutrition_per_100g,
						estimate_source: 'ai_estimate',
						confidence: butter.confidence
					}
				]
			}
		});
		expect(res.status).toBe(201);
		const meal = res.body.data.meal;
		expect(meal.input_method).toBe('ai');
		expect(meal.ai_description).toBe('Oatmeal with butter');
		expect(meal.has_ai_estimates).toBe(true);
		// 71 × 2.5 = 177.5 and 717 × 0.05 = 35.9
		expect(meal.totals.kcal).toBe(213.4);
	});
});
