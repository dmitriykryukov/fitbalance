import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addDays, localDate } from '../../src/lib/dates.js';
import * as activities from '../../src/routes/api/activities/+server.js';
import * as goals from '../../src/routes/api/goals/+server.js';
import * as meals from '../../src/routes/api/meals/+server.js';
import * as measurements from '../../src/routes/api/measurements/+server.js';
import * as statistics from '../../src/routes/api/statistics/+server.js';
import * as workouts from '../../src/routes/api/workouts/+server.js';
import { call, createTestUser, deleteTestUser, type TestUser } from './helpers.js';

// Profiles default to UTC, so the API's "today" is the UTC date.
const DAY = localDate('UTC');
const ago = (n: number) => addDays(DAY, -n);

let a: TestUser;
let b: TestUser;

/** 500 kcal per 100 g eaten as kcal / 5 grams, so the day total is exactly `kcal`. */
const meal = (date: string, kcal: number) => ({
	local_date: date,
	logged_at: `${date}T12:00:00Z`,
	meal_type: 'lunch',
	items: [
		{
			name: 'Test food',
			grams: kcal / 5,
			nutrition_per_100g: { kcal: 500, protein_g: 20, carbs_g: 50, fat_g: 10, fibre_g: null },
			estimate_source: 'user_entered'
		}
	]
});

async function stats(user: TestUser, query: string) {
	const res = await call(statistics.GET, user, { url: `/api/statistics?${query}` });
	return res;
}

beforeAll(async () => {
	[a, b] = await Promise.all([createTestUser('sa'), createTestUser('sb')]);
	const steps = [
		call(goals.PUT, a, { body: { calories_kcal: 2000, protein_g: 150, target_weight_kg: 78 } }),
		call(meals.POST, a, { body: meal(ago(1), 1900) }),
		call(meals.POST, a, { body: meal(ago(3), 2500) }),
		call(meals.POST, a, { body: meal(ago(20), 1500) }),
		call(activities.POST, a, {
			body: {
				activity_type: 'running',
				local_date: ago(2),
				duration_seconds: 1800,
				distance_meters: 5000
			}
		}),
		call(activities.POST, a, {
			body: { activity_type: 'walking', local_date: ago(4), duration_seconds: 2400, steps: 6000 }
		}),
		call(workouts.POST, a, {
			body: {
				title: 'Legs',
				local_date: DAY,
				duration_seconds: 3600,
				exercises: [{ name: 'Squat', sets: [{ reps: 5, weight_kg: 100 }] }]
			}
		}),
		call(measurements.POST, a, { body: { local_date: ago(40), weight_kg: 84 } }),
		call(measurements.POST, a, { body: { local_date: ago(6), weight_kg: 82, waist_cm: 90 } }),
		call(measurements.POST, a, { body: { local_date: ago(1), weight_kg: 81 } })
	];
	for (const res of await Promise.all(steps))
		expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
	// Goals saved through the API start today; add an older version so past days have a target.
	const older = await a.client.from('user_goals').insert({
		user_id: a.id,
		effective_from: ago(30),
		calories_kcal: 2000,
		protein_g: 140
	});
	expect(older.error).toBeNull();
});

afterAll(async () => {
	await Promise.all([deleteTestUser(a), deleteTestUser(b)]);
});

describe('GET /api/statistics', () => {
	it('needs a session and a valid range', async () => {
		expect((await call(statistics.GET, null, { url: '/api/statistics' })).status).toBe(401);
		expect((await stats(a, 'range=14d')).status).toBe(422);
		expect((await stats(a, `range=7d&end=${addDays(DAY, 5)}`)).status).toBe(422);
	});

	it('7 days: averages over logged days only, unlogged days are null', async () => {
		const res = await stats(a, 'range=7d');
		expect(res.status).toBe(200);
		const { nutrition, activity, body, from, to, days_total } = res.body.data;
		expect({ from, to, days_total }).toEqual({ from: ago(6), to: DAY, days_total: 7 });

		expect(nutrition.days).toHaveLength(7);
		expect(nutrition.days_logged).toBe(2);
		expect(nutrition.avg_kcal).toBe(2200); // (1900 + 2500) / 2 — not / 7
		expect(nutrition.days.filter((d: { kcal: number | null }) => d.kcal === null)).toHaveLength(5);
		expect(nutrition.days.find((d: { date: string }) => d.date === ago(2)).kcal).toBeNull();
		expect(nutrition.within_target_pct).toBe(50); // 1900 within ±10 % of 2000; 2500 is not
		expect(nutrition.targets).toMatchObject({ calories_kcal: 2000, protein_g: 150 });

		// Matches the daily_nutrition view.
		const view = await a.client
			.from('daily_nutrition')
			.select('local_date, kcal')
			.eq('local_date', ago(1))
			.single();
		expect(nutrition.days.find((d: { date: string }) => d.date === ago(1)).kcal).toBe(
			view.data!.kcal
		);

		expect(activity).toMatchObject({
			sessions: 3,
			strength_workouts: 1,
			active_seconds: 7800,
			run_distance_meters: 5000,
			steps: 6000
		});
		expect(activity.days.map((d: { seconds: number | null }) => d.seconds)).toEqual([
			null,
			null,
			2400,
			null,
			1800,
			null,
			3600
		]);

		expect(body.weight).toMatchObject({
			points: [
				{ date: ago(6), value: 82 },
				{ date: ago(1), value: 81 }
			],
			current: 81,
			target: 78,
			change: -1,
			progress_pct: 25
		});
		expect(body.waist).toMatchObject({
			current: 90,
			change: null,
			points: [{ date: ago(6), value: 90 }]
		});
	});

	it('30 and 90 days include older records', async () => {
		const month = (await stats(a, 'range=30d')).body.data;
		expect(month.nutrition.days).toHaveLength(30);
		expect(month.nutrition.days_logged).toBe(3);
		expect(month.nutrition.avg_kcal).toBe(1967);

		const quarter = (await stats(a, 'range=90d')).body.data;
		expect(quarter.body.weight.points).toHaveLength(3);
		expect(quarter.body.weight).toMatchObject({ change: -3, progress_pct: 50 });
	});

	it('an earlier end date only sees records up to that day', async () => {
		const res = (await stats(a, `range=7d&end=${ago(5)}`)).body.data;
		expect(res.to).toBe(ago(5));
		expect(res.nutrition.days_logged).toBe(0);
		// The window ago(11)…ago(5) holds the ago(6) measurement; the ago(1) one is after it.
		expect(res.body.weight).toMatchObject({ points: [{ date: ago(6), value: 82 }], current: 82 });
		expect(res.nutrition.targets).toMatchObject({ calories_kcal: 2000, protein_g: 140 });
	});

	it('days before the first goal version have no target', async () => {
		const data = (await stats(a, 'range=90d')).body.data;
		const days = data.nutrition.days as { date: string; target_kcal: number | null }[];
		expect(days.find((d) => d.date === ago(31))!.target_kcal).toBeNull();
		expect(days.find((d) => d.date === ago(30))!.target_kcal).toBe(2000);
	});

	it("another user sees none of A's records", async () => {
		const data = (await stats(b, 'range=90d')).body.data;
		expect(data.nutrition).toMatchObject({ days_logged: 0, avg_kcal: null, targets: null });
		expect(data.activity).toMatchObject({ sessions: 0, active_seconds: null, steps: null });
		expect(data.body.weight).toMatchObject({ points: [], current: null });
	});
});
