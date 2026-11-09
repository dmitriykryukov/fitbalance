import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addDays, localDate } from '../../src/lib/dates.js';
import * as activity from '../../src/routes/api/activities/[id]/+server.js';
import * as activities from '../../src/routes/api/activities/+server.js';
import * as dashboard from '../../src/routes/api/dashboard/+server.js';
import * as exercises from '../../src/routes/api/exercises/+server.js';
import * as goals from '../../src/routes/api/goals/+server.js';
import * as measurements from '../../src/routes/api/measurements/+server.js';
import * as workout from '../../src/routes/api/workouts/[id]/+server.js';
import * as workouts from '../../src/routes/api/workouts/+server.js';
import { call, createTestUser, deleteTestUser, type TestUser } from './helpers.js';

// Profiles default to UTC, so "today" for the API is the UTC date.
const DAY = localDate('UTC');
const WEEK = `from=${addDays(DAY, -6)}&to=${DAY}`;

let a: TestUser;
let b: TestUser;

const run = (extra: Record<string, unknown> = {}) => ({
	activity_type: 'running',
	local_date: DAY,
	started_at: `${DAY}T07:30:00Z`,
	duration_seconds: 2640,
	distance_meters: 7200,
	...extra
});

const pushDay = (extra: Record<string, unknown> = {}) => ({
	title: 'Push day',
	local_date: DAY,
	duration_seconds: 2700,
	exercises: [
		{
			name: 'Bench press',
			muscle_group: 'chest',
			equipment: 'Barbell',
			sets: [
				{ reps: 10, weight_kg: 60 },
				{ reps: 8, weight_kg: 65 }
			]
		},
		{ name: 'Push-up', sets: [{ reps: 20 }] }
	],
	...extra
});

beforeAll(async () => {
	[a, b] = await Promise.all([createTestUser('aa'), createTestUser('ab')]);
	const goal = await call(goals.PUT, a, { body: { calories_kcal: 2000 } });
	expect(goal.status).toBe(200);
});

afterAll(async () => {
	await Promise.all([deleteTestUser(a), deleteTestUser(b)]);
});

describe('without a session', () => {
	it('answers 401 everywhere', async () => {
		const params = { id: crypto.randomUUID() };
		for (const handler of [activities.GET, workouts.GET, exercises.GET]) {
			expect((await call(handler, null, { url: `/api/x?${WEEK}` })).status).toBe(401);
		}
		expect((await call(activities.POST, null, { body: run() })).status).toBe(401);
		expect((await call(workouts.POST, null, { body: pushDay() })).status).toBe(401);
		expect((await call(activity.GET, null, { params })).status).toBe(401);
		expect((await call(workout.DELETE, null, { params })).status).toBe(401);
	});
});

describe('validation', () => {
	it('rejects bad activities', async () => {
		const bad = [
			run({ activity_type: 'other' }), // other needs a title
			run({ activity_type: 'swimming' }),
			run({ duration_seconds: 0 }),
			run({ local_date: addDays(DAY, 2) }), // future (one day of slack is allowed for time zones)
			run({ surprise: true })
		];
		for (const body of bad) {
			const res = await call(activities.POST, a, { body });
			expect(res.status, JSON.stringify(body)).toBe(422);
		}
	});

	it('rejects bad workouts and ranges', async () => {
		const noSets = pushDay({ exercises: [{ name: 'Squat', sets: [] }] });
		const emptySet = pushDay({ exercises: [{ name: 'Squat', sets: [{ weight_kg: 100 }] }] });
		for (const body of [pushDay({ exercises: [] }), noSets, emptySet, pushDay({ title: ' ' })]) {
			expect((await call(workouts.POST, a, { body })).status).toBe(422);
		}
		const tooLong = `from=${addDays(DAY, -400)}&to=${DAY}`;
		expect((await call(activities.GET, a, { url: `/api/activities?${tooLong}` })).status).toBe(422);
		const reversed = `from=${DAY}&to=${addDays(DAY, -1)}`;
		expect((await call(workouts.GET, a, { url: `/api/workouts?${reversed}` })).status).toBe(422);
	});
});

describe('activities and active kcal', () => {
	let runId: string;

	it('without a weight, active kcal is not estimated (null, never a guess)', async () => {
		const res = await call(activities.POST, a, { body: run() });
		expect(res.status).toBe(201);
		const saved = res.body.data.activity;
		runId = saved.id;
		expect(saved).toMatchObject({
			activity_type: 'running',
			estimated_kcal_burned: null,
			kcal_source: null,
			pace_seconds_per_km: 367,
			average_speed_kmh: 9.82
		});
	});

	it('with a weight, estimates MET × kg × h, or keeps the user value', async () => {
		const weight = await call(measurements.POST, a, { body: { local_date: DAY, weight_kg: 72 } });
		expect(weight.status).toBe(201);

		// Re-estimate on request (active_kcal: null): 9.8 MET × 72 kg × 0.733 h = 517.
		const patched = await call(activity.PATCH, a, {
			params: { id: runId },
			body: { active_kcal: null }
		});
		expect(patched.body.data.activity).toMatchObject({
			estimated_kcal_burned: 517,
			kcal_source: 'estimated'
		});

		const own = await call(activities.POST, a, {
			body: run({
				activity_type: 'cycling',
				distance_meters: 20000,
				duration_seconds: 3600,
				active_kcal: 480
			})
		});
		expect(own.body.data.activity).toMatchObject({
			estimated_kcal_burned: 480,
			kcal_source: 'user',
			average_speed_kmh: 20
		});

		// Changing the duration keeps a user value…
		const kept = await call(activity.PATCH, a, {
			params: { id: own.body.data.activity.id },
			body: { duration_seconds: 4000 }
		});
		expect(kept.body.data.activity).toMatchObject({
			estimated_kcal_burned: 480,
			kcal_source: 'user'
		});

		// …and re-estimates an estimated one: 9.8 × 72 × (1800 / 3600) = 353.
		const shorter = await call(activity.PATCH, a, {
			params: { id: runId },
			body: { duration_seconds: 1800, distance_meters: 5000 }
		});
		expect(shorter.body.data.activity).toMatchObject({
			estimated_kcal_burned: 353,
			kcal_source: 'estimated',
			pace_seconds_per_km: 360
		});
	});

	it('logs walks with steps and other activities with a title', async () => {
		const walk = await call(activities.POST, a, {
			body: { activity_type: 'walking', local_date: DAY, duration_seconds: 1800, steps: 4200 }
		});
		expect(walk.status).toBe(201);
		const yoga = await call(activities.POST, a, {
			body: { activity_type: 'other', title: 'Yoga', local_date: DAY, duration_seconds: 3600 }
		});
		expect(yoga.status).toBe(201);
		// 4.0 MET × 72 kg × 1 h
		expect(yoga.body.data.activity).toMatchObject({ estimated_kcal_burned: 288, title: 'Yoga' });

		const list = await call(activities.GET, a, { url: `/api/activities?${WEEK}` });
		expect(list.body.data.activities).toHaveLength(4);
	});

	it('another user cannot read, change or delete it', async () => {
		const params = { id: runId };
		expect((await call(activity.GET, b, { params })).status).toBe(404);
		expect((await call(activity.PATCH, b, { params, body: { duration_seconds: 60 } })).status).toBe(
			404
		);
		expect((await call(activity.DELETE, b, { params })).status).toBe(404);
		const list = await call(activities.GET, b, { url: `/api/activities?${WEEK}` });
		expect(list.body.data.activities).toEqual([]);
	});

	it('active kcal never changes "kcal left"', async () => {
		const res = await call(dashboard.GET, a, { url: `/api/dashboard?date=${DAY}` });
		const data = res.body.data;
		expect(data.activity.active_kcal).toBeGreaterThan(0);
		expect(data.activity.steps).toBe(4200);
		expect(data.nutrition.kcal_left).toBe(2000); // no food logged; activity not subtracted
	});

	it('deletes', async () => {
		expect((await call(activity.DELETE, a, { params: { id: runId } })).status).toBe(204);
		expect((await call(activity.GET, a, { params: { id: runId } })).status).toBe(404);
	});
});

describe('strength workouts', () => {
	let workoutId: string;

	it('saves a workout with exercises and sets in order, estimating kcal', async () => {
		const res = await call(workouts.POST, a, { body: pushDay() });
		expect(res.status).toBe(201);
		const saved = res.body.data.workout;
		workoutId = saved.id;
		// 3.5 MET × 72 kg × 0.75 h = 189
		expect(saved).toMatchObject({
			title: 'Push day',
			estimated_kcal_burned: 189,
			kcal_source: 'estimated',
			set_count: 3,
			volume_kg: 1120
		});
		expect(saved.exercises.map((x: { name: string }) => x.name)).toEqual([
			'Bench press',
			'Push-up'
		]);
		expect(saved.exercises[0]).toMatchObject({ muscle_group: 'chest', equipment: 'Barbell' });
		expect(saved.exercises[0].sets.map((s: { set_number: number }) => s.set_number)).toEqual([
			1, 2
		]);
		expect(saved.exercises[0].exercise_id).toEqual(expect.any(String));
	});

	it('adds new exercises to the user list once (case-insensitive) and suggests them first', async () => {
		const again = await call(workouts.POST, a, {
			body: pushDay({
				title: 'Push again',
				exercises: [{ name: ' bench PRESS ', sets: [{ reps: 5 }] }]
			})
		});
		expect(again.status).toBe(201);

		const own = await a.client.from('exercises').select('name');
		expect(own.data!.map((x) => x.name).sort()).toEqual(['Bench press', 'Push-up']);

		const res = await call(exercises.GET, a, { url: '/api/exercises?query=bench' });
		const list = res.body.data.exercises;
		expect(list[0]).toMatchObject({ name: 'Bench press', id: expect.any(String) });
		expect(
			list.filter((x: { name: string }) => x.name.toLowerCase() === 'bench press')
		).toHaveLength(1);

		const ru = await call(exercises.GET, b, { url: '/api/exercises?query=жим' });
		expect(ru.body.data.exercises.length).toBeGreaterThan(0);
		expect(ru.body.data.exercises.every((x: { id: string | null }) => x.id === null)).toBe(true);
	});

	it('PUT replaces all sets; a failing save changes nothing', async () => {
		const put = await call(workout.PUT, a, {
			params: { id: workoutId },
			body: pushDay({
				title: 'Push day (light)',
				active_kcal: 150,
				exercises: [{ name: 'Dips', muscle_group: 'chest', sets: [{ reps: 12 }, { reps: 10 }] }]
			})
		});
		expect(put.status).toBe(200);
		expect(put.body.data.workout).toMatchObject({
			title: 'Push day (light)',
			estimated_kcal_burned: 150,
			kcal_source: 'user',
			set_count: 2
		});

		// B's exercise id cannot be used by A: the whole save is rolled back.
		const bEx = await call(workouts.POST, b, {
			body: pushDay({ exercises: [{ name: 'Row', sets: [{ reps: 10 }] }] })
		});
		const foreign = bEx.body.data.workout.exercises[0].exercise_id;
		const bad = await call(workout.PUT, a, {
			params: { id: workoutId },
			body: pushDay({
				title: 'Should not save',
				exercises: [{ name: 'Row', exercise_id: foreign, sets: [{ reps: 1 }] }]
			})
		});
		expect(bad.status).toBe(422);
		const after = await call(workout.GET, a, { params: { id: workoutId } });
		expect(after.body.data.workout).toMatchObject({ title: 'Push day (light)', set_count: 2 });
	});

	it('another user cannot read, replace or delete it', async () => {
		const params = { id: workoutId };
		expect((await call(workout.GET, b, { params })).status).toBe(404);
		expect((await call(workout.PUT, b, { params, body: pushDay() })).status).toBe(404);
		expect((await call(workout.DELETE, b, { params })).status).toBe(404);
	});

	it('lists workouts in a range with counts', async () => {
		const res = await call(workouts.GET, a, { url: `/api/workouts?${WEEK}` });
		const list = res.body.data.workouts;
		expect(list).toHaveLength(2);
		const light = list.find((w: { id: string }) => w.id === workoutId);
		expect(light).toMatchObject({ exercise_count: 1, set_count: 2 });
	});

	it('delete removes the workout and its sets', async () => {
		expect((await call(workout.DELETE, a, { params: { id: workoutId } })).status).toBe(204);
		const sets = await a.client.from('workout_sets').select('id').eq('workout_id', workoutId);
		expect(sets.data).toEqual([]);
		expect((await call(workout.GET, a, { params: { id: workoutId } })).status).toBe(404);
	});
});
