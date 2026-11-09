import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { addDays, localDate } from '../../src/lib/dates.js';
import { AI_SETTINGS, setAIProviderForTests } from '../../src/lib/server/ai/index.js';
import { COACH_SYSTEM, INSIGHT_SYSTEM } from '../../src/lib/server/ai/prompts/coach.js';
import {
	AIError,
	type AIMessage,
	type AIProvider,
	type AIUsage
} from '../../src/lib/server/ai/provider.js';
import * as coach from '../../src/routes/api/ai/coach/+server.js';
import * as conversation from '../../src/routes/api/ai/conversations/[id]/+server.js';
import * as conversations from '../../src/routes/api/ai/conversations/+server.js';
import * as insight from '../../src/routes/api/ai/daily-insight/+server.js';
import * as goals from '../../src/routes/api/goals/+server.js';
import * as meals from '../../src/routes/api/meals/+server.js';
import { call, createTestUser, deleteTestUser, type TestUser } from './helpers.js';

// Profiles default to UTC, so the API's "today" is the UTC date.
const DAY = localDate('UTC');
const ago = (n: number) => addDays(DAY, -n);

const usage: AIUsage = {
	provider: 'anthropic',
	model: 'claude-sonnet-5-5',
	inputTokens: 3000,
	outputTokens: 400,
	latencyMs: 2100
};

type TextCall = Parameters<AIProvider['generateText']>[0];
type StructuredCall = Parameters<AIProvider['generateStructured']>[0];

/** A provider that replays whatever the current test sets; records every call. */
let nextText: () => Promise<{ text: string; usage: AIUsage }>;
let nextInsight: () => Promise<{ data: unknown; usage: AIUsage }>;
const textCalls: TextCall[] = [];
const structuredCalls: StructuredCall[] = [];
const fake: AIProvider = {
	name: 'fake',
	async generateStructured(input) {
		structuredCalls.push(input);
		return nextInsight() as never;
	},
	async generateText(input) {
		textCalls.push(input);
		return nextText();
	}
};

const meal = (date: string, kcal: number, name: string) => ({
	local_date: date,
	logged_at: `${date}T12:00:00Z`,
	meal_type: 'lunch',
	items: [
		{
			name,
			grams: kcal / 5,
			nutrition_per_100g: { kcal: 500, protein_g: 20, carbs_g: 50, fat_g: 10, fibre_g: null },
			estimate_source: 'user_entered'
		}
	]
});

let a: TestUser; // two logged days, goals
let b: TestUser; // another user with their own data
let empty: TestUser; // nothing logged
let limited: TestUser;

/** The JSON context pack inside the latest user message. */
function contextOf(message: AIMessage) {
	const match = /<user_data>\n(.*)\n<\/user_data>/s.exec(message.content);
	if (!match) throw new Error('no <user_data> block');
	return JSON.parse(match[1]);
}

async function usageRows(user: TestUser, feature: string) {
	const { data, error } = await user.client
		.from('ai_usage')
		.select('*')
		.eq('feature', feature)
		.order('created_at', { ascending: true });
	if (error) throw error;
	return data;
}

const ask = (user: TestUser | null, body: unknown) =>
	call(coach.POST, user, { url: '/api/ai/coach', body });

beforeAll(async () => {
	setAIProviderForTests(fake);
	[a, b, empty, limited] = await Promise.all([
		createTestUser('coach-a'),
		createTestUser('coach-b'),
		createTestUser('coach-empty'),
		createTestUser('coach-limit')
	]);
	const steps = [
		call(goals.PUT, a, { body: { calories_kcal: 2000, protein_g: 120 } }),
		call(meals.POST, a, { body: meal(ago(1), 1800, 'Buckwheat') }),
		call(meals.POST, a, { body: meal(ago(3), 2100, 'Pasta') }),
		call(meals.POST, b, { body: meal(ago(1), 3500, 'Secret cake of user B') }),
		call(meals.POST, b, { body: meal(ago(2), 3000, 'Secret pie of user B') })
	];
	for (const res of await Promise.all(steps)) {
		expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
	}
});

afterEach(() => {
	textCalls.length = 0;
	structuredCalls.length = 0;
});

afterAll(async () => {
	setAIProviderForTests(undefined);
	await Promise.all([a, b, empty, limited].map(deleteTestUser));
});

describe('POST /api/ai/coach', () => {
	it('requires a session and a valid body, before any AI call', async () => {
		expect((await ask(null, { message: 'Hi' })).status).toBe(401);
		for (const body of [
			{ message: '' },
			{ message: 'x'.repeat(2001) },
			{ message: 'Hi', model: 'claude-opus-5-5' },
			{ message: 'Hi', conversation_id: 'not-a-uuid' }
		]) {
			expect((await ask(a, body)).status).toBe(422);
		}
		expect(textCalls).toHaveLength(0);
	});

	let conversationId: string;

	it('answers from the signed-in user’s data only and stores the exchange', async () => {
		nextText = async () => ({ text: '**You logged 2 of 7 days.** Average 1,950 kcal.', usage });
		const res = await ask(a, { conversation_id: null, message: '  How was my week?  ' });
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		const reply = res.body.data;
		expect(reply.message).toMatchObject({
			role: 'assistant',
			content: '**You logged 2 of 7 days.** Average 1,950 kcal.'
		});
		conversationId = reply.conversation_id;

		// What the model received.
		expect(textCalls).toHaveLength(1);
		const sent = textCalls[0];
		expect(sent.system).toBe(COACH_SYSTEM);
		expect(sent).toMatchObject({
			model: AI_SETTINGS.coach.model,
			effort: 'medium',
			maxTokens: 16_000,
			timeoutMs: 60_000,
			fallback: true
		});
		expect(sent.messages).toHaveLength(1);
		const latest = sent.messages[0];
		expect(latest.content).toMatch(/^App language: en/);
		expect(latest.content).toContain('<question>\nHow was my week?\n</question>');
		const pack = contextOf(latest);
		expect(pack.nutrition_30d.days_logged).toBe(2);
		expect(
			pack.nutrition_7d.filter((d: { status?: string }) => d.status === 'not_logged')
		).toHaveLength(5);
		expect(pack.goals).toMatchObject({ calories_kcal: 2000, protein_g: 120 });
		expect(latest.content).not.toContain('Secret');
		expect(latest.content).not.toContain(a.id);
		expect(latest.content).not.toContain(b.id);
		expect(latest.content).not.toContain(a.email);

		// What was stored: the conversation (titled by the question) and both messages.
		const stored = await call(conversation.GET, a, { params: { id: conversationId } });
		expect(stored.body.data.conversation.title).toBe('How was my week?');
		expect(
			stored.body.data.conversation.messages.map((m: { role: string; content: string }) => [
				m.role,
				m.content
			])
		).toEqual([
			['user', 'How was my week?'],
			['assistant', '**You logged 2 of 7 days.** Average 1,950 kcal.']
		]);
		const { data: rows } = await a.client.from('ai_messages').select('provider, model, role');
		expect(rows?.find((r) => r.role === 'assistant')).toMatchObject({
			provider: 'anthropic',
			model: 'claude-sonnet-5-5'
		});

		const logged = await usageRows(a, 'coach');
		expect(logged).toHaveLength(1);
		expect(logged[0]).toMatchObject({
			status: 'ok',
			model: 'claude-sonnet-5-5',
			input_tokens: 3000,
			output_tokens: 400
		});
		expect(Object.keys(logged[0])).not.toContain('content');
	});

	it('continues a conversation with its earlier messages', async () => {
		nextText = async () => ({ text: 'Add a protein source to breakfast.', usage });
		const res = await ask(a, { conversation_id: conversationId, message: 'What should I change?' });
		expect(res.status).toBe(200);
		expect(res.body.data.conversation_id).toBe(conversationId);
		expect(textCalls[0].messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
		expect(textCalls[0].messages[0].content).toBe('How was my week?');

		const list = await call(conversations.GET, a);
		expect(list.body.data.conversations).toHaveLength(1);
		const stored = await call(conversation.GET, a, { params: { id: conversationId } });
		expect(stored.body.data.conversation.messages).toHaveLength(4);
	});

	it("never reaches another user's conversation", async () => {
		nextText = async () => ({ text: 'Should not happen', usage });
		const res = await ask(b, { conversation_id: conversationId, message: 'Hi' });
		expect(res.status).toBe(404);
		expect(textCalls).toHaveLength(0);
		expect((await call(conversation.GET, b, { params: { id: conversationId } })).status).toBe(404);
		expect((await call(conversation.DELETE, b, { params: { id: conversationId } })).status).toBe(
			404
		);
		expect((await call(conversations.GET, b)).body.data.conversations).toEqual([]);
		// Still there for its owner.
		expect((await call(conversation.GET, a, { params: { id: conversationId } })).status).toBe(200);
	});

	it('answers in Russian for a Russian profile, flagging missing data in the pack', async () => {
		const { error } = await empty.client
			.from('profiles')
			.update({ locale: 'ru' })
			.eq('id', empty.id);
		expect(error).toBeNull();
		nextText = async () => ({ text: 'Пока нет записей.', usage });
		const res = await ask(empty, { message: 'Как моё питание на этой неделе?' });
		expect(res.status).toBe(200);
		const latest = textCalls[0].messages[0];
		expect(latest.content).toMatch(/^App language: ru/);
		const pack = contextOf(latest);
		expect(pack.today.nutrition).toBe('not_logged');
		expect(pack.nutrition_30d.averages_over_logged_days).toBeNull();
		expect(pack.completeness.no_records).toEqual([
			'nutrition',
			'cardio_activities',
			'strength_workouts',
			'body_measurements',
			'goals'
		]);
	});

	it.each([
		['refused', 422, 'AI_REFUSED', 'invalid_response'],
		['timeout', 502, 'AI_PROVIDER_ERROR', 'timeout'],
		['rate_limited', 429, 'RATE_LIMITED', 'rate_limited']
	] as const)('stores nothing when the AI call fails (%s)', async (kind, status, code, logged) => {
		const before = (await call(conversations.GET, b)).body.data.conversations.length;
		nextText = async () => {
			throw new AIError(kind, `${kind} (test)`, usage, kind === 'rate_limited' ? 20 : undefined);
		};
		const res = await ask(b, { message: 'Should I stop taking my medication?' });
		expect(res.status).toBe(status);
		expect(res.body.error.code).toBe(code);
		expect((await call(conversations.GET, b)).body.data.conversations).toHaveLength(before);
		const { data: messages } = await b.client.from('ai_messages').select('id');
		expect(messages).toEqual([]);
		expect((await usageRows(b, 'coach')).at(-1)?.status).toBe(logged);
	});

	it('stops at the daily limit without calling the AI', async () => {
		const limit = AI_SETTINGS.coach.dailyLimit;
		const rows = Array.from({ length: limit }, () => ({
			user_id: limited.id,
			feature: 'coach',
			provider: 'anthropic',
			model: 'test',
			status: 'ok'
		}));
		expect((await limited.client.from('ai_usage').insert(rows)).error).toBeNull();
		const res = await ask(limited, { message: 'Hi' });
		expect(res.status).toBe(429);
		expect(res.body.error.code).toBe('RATE_LIMITED');
		expect(res.body.error.message).toMatch(/Coach/);
		expect(res.body.error.retry_after_seconds).toBeGreaterThan(0);
		expect(textCalls).toHaveLength(0);
	});

	it('deletes a conversation with its messages', async () => {
		const res = await call(conversation.DELETE, a, { params: { id: conversationId } });
		expect(res.status).toBe(204);
		expect((await call(conversation.GET, a, { params: { id: conversationId } })).status).toBe(404);
		const { data } = await a.client.from('ai_messages').select('id');
		expect(data).toEqual([]);
	});
});

describe('GET /api/ai/daily-insight', () => {
	const get = (user: TestUser, query = '') =>
		call(insight.GET, user, { url: `/api/ai/daily-insight${query}` });

	it('is hidden without enough data, and makes no AI call', async () => {
		const res = await get(empty);
		expect(res.status).toBe(200);
		expect(res.body.data).toEqual({ insight: null, reason: 'not_enough_data' });
		expect(structuredCalls).toHaveLength(0);
	});

	it('is generated once a day from the smaller pack, then served from the cache', async () => {
		nextInsight = async () => ({
			data: { title: 'Protein is close', body: 'Add 20 g of protein at breakfast today.' },
			usage: { ...usage, model: 'claude-haiku-5-5' }
		});
		const first = await get(a);
		expect(first.status, JSON.stringify(first.body)).toBe(200);
		expect(first.body.data.insight).toMatchObject({
			local_date: DAY,
			title: 'Protein is close',
			body: 'Add 20 g of protein at breakfast today.'
		});
		expect(structuredCalls).toHaveLength(1);
		expect(structuredCalls[0]).toMatchObject({
			system: INSIGHT_SYSTEM,
			model: AI_SETTINGS.daily_insight.model,
			effort: 'low'
		});
		const pack = contextOf(structuredCalls[0].messages[0]);
		expect(Object.keys(pack)).not.toContain('nutrition_30d');
		expect(JSON.stringify(pack)).not.toContain('Secret');

		const again = await get(a);
		expect(again.body.data.insight).toEqual(first.body.data.insight);
		expect(structuredCalls).toHaveLength(1); // cached
		expect(await usageRows(a, 'daily_insight')).toHaveLength(1);
	});

	it('is hidden (not an error) when generation fails, and the failure is logged', async () => {
		nextInsight = async () => {
			throw new AIError('invalid', 'too long', usage);
		};
		const res = await get(b);
		expect(res.status).toBe(200);
		expect(res.body.data).toEqual({ insight: null, reason: 'unavailable' });
		expect((await usageRows(b, 'daily_insight')).map((r) => r.status)).toEqual([
			'invalid_response'
		]);
	});

	it('only reads past days and rejects future ones', async () => {
		const past = await get(a, `?date=${ago(1)}`);
		expect(past.body.data).toEqual({ insight: null, reason: 'past_date' });
		expect(structuredCalls).toHaveLength(0);
		expect((await get(a, `?date=${addDays(DAY, 2)}`)).status).toBe(422);
	});
});
