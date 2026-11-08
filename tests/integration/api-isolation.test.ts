import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as goals from '../../src/routes/api/goals/+server.js';
import * as suggestion from '../../src/routes/api/goals/suggestion/+server.js';
import * as measurement from '../../src/routes/api/measurements/[id]/+server.js';
import * as measurements from '../../src/routes/api/measurements/+server.js';
import * as profile from '../../src/routes/api/profile/+server.js';
import { call, createTestUser, deleteTestUser, type TestUser } from './helpers.js';

let a: TestUser;
let b: TestUser;
let measurementId: string;

beforeAll(async () => {
	[a, b] = await Promise.all([createTestUser('a'), createTestUser('b')]);

	const setup = await call(profile.PATCH, a, {
		body: {
			display_name: 'Alice',
			date_of_birth: '1994-05-10',
			sex: 'female',
			height_cm: 168,
			timezone: 'Europe/Berlin'
		}
	});
	expect(setup.status).toBe(200);

	const created = await call(measurements.POST, a, {
		body: { local_date: '2026-11-01', weight_kg: 64.5, waist_cm: 74 }
	});
	expect(created.status).toBe(201);
	measurementId = created.body.data.measurement.id;
});

afterAll(async () => {
	await Promise.all([deleteTestUser(a), deleteTestUser(b)]);
});

describe('without a session', () => {
	it('every endpoint answers 401 UNAUTHENTICATED', async () => {
		for (const handler of [profile.GET, goals.GET, suggestion.GET, measurements.GET]) {
			const res = await call(handler, null);
			expect(res.status).toBe(401);
			expect(res.body.error.code).toBe('UNAUTHENTICATED');
		}
	});
});

describe('profile', () => {
	it("each user only sees their own profile; B's is untouched", async () => {
		const own = await call(profile.GET, a);
		expect(own.body.data.profile).toMatchObject({ id: a.id, display_name: 'Alice' });

		const other = await call(profile.GET, b);
		expect(other.body.data.profile).toMatchObject({ id: b.id, display_name: null });
	});

	it('rejects user_id in the body and invalid values', async () => {
		const smuggled = await call(profile.PATCH, b, {
			body: { display_name: 'Mallory', user_id: a.id }
		});
		expect(smuggled.status).toBe(422);
		expect(smuggled.body.error.code).toBe('VALIDATION_ERROR');

		const badZone = await call(profile.PATCH, b, { body: { timezone: 'Mars/Base' } });
		expect(badZone.status).toBe(422);
	});

	it('sets onboarded_at once', async () => {
		const first = await call(profile.PATCH, b, { body: { onboarded: true } });
		const stamp = first.body.data.profile.onboarded_at;
		expect(stamp).toBeTruthy();
		const second = await call(profile.PATCH, b, { body: { onboarded: true } });
		expect(second.body.data.profile.onboarded_at).toBe(stamp);
	});
});

describe('measurements', () => {
	it("B cannot list, update or delete A's measurement (404, not 403)", async () => {
		const list = await call(measurements.GET, b);
		expect(list.body.data.measurements).toEqual([]);

		const patch = await call(measurement.PATCH, b, {
			params: { id: measurementId },
			body: { weight_kg: 99 }
		});
		expect(patch.status).toBe(404);
		expect(patch.body.error.code).toBe('NOT_FOUND');

		const del = await call(measurement.DELETE, b, { params: { id: measurementId } });
		expect(del.status).toBe(404);

		const own = await call(measurements.GET, a);
		expect(own.body.data.measurements).toHaveLength(1);
		expect(own.body.data.measurements[0]).toMatchObject({ id: measurementId, weight_kg: 64.5 });
	});

	it('validates input and future dates', async () => {
		const empty = await call(measurements.POST, a, { body: { local_date: '2026-11-02' } });
		expect(empty.status).toBe(422);

		const future = await call(measurements.POST, a, {
			body: { local_date: '2099-01-01', weight_kg: 70 }
		});
		expect(future.status).toBe(422);
		expect(future.body.error.fields).toHaveProperty('local_date');

		const badId = await call(measurement.DELETE, a, { params: { id: 'not-a-uuid' } });
		expect(badId.status).toBe(404);
	});

	it('A can update and delete their own measurement', async () => {
		const extra = await call(measurements.POST, a, {
			body: { local_date: '2026-11-02', waist_cm: 75 }
		});
		const id = extra.body.data.measurement.id;

		const patch = await call(measurement.PATCH, a, { params: { id }, body: { waist_cm: 73.5 } });
		expect(patch.status).toBe(200);
		expect(patch.body.data.measurement.waist_cm).toBe(73.5);

		const del = await call(measurement.DELETE, a, { params: { id } });
		expect(del.status).toBe(204);
	});
});

describe('goals', () => {
	it('saves a version for today and keeps it private', async () => {
		const put = await call(goals.PUT, a, {
			body: { fitness_goal: 'lose_fat', calories_kcal: 1800, protein_g: 130 }
		});
		expect(put.status).toBe(200);
		expect(put.body.data.goal).toMatchObject({
			user_id: a.id,
			calories_kcal: 1800,
			carbs_g: null
		});

		// Saving again the same day replaces that version (still one row).
		await call(goals.PUT, a, { body: { fitness_goal: 'maintain', calories_kcal: 2000 } });
		const { data: rows } = await a.client.from('user_goals').select('id');
		expect(rows).toHaveLength(1);

		const other = await call(goals.GET, b);
		expect(other.body.data.goal).toBeNull();
	});

	it('suggests targets from profile and latest weight', async () => {
		const res = await call(suggestion.GET, a, {
			url: '/api/goals/suggestion?fitness_goal=lose_fat'
		});
		expect(res.status).toBe(200);
		expect(res.body.data.missing).toEqual([]);
		expect(res.body.data.suggestion.calories_kcal).toBeGreaterThan(1200);

		const missing = await call(suggestion.GET, b);
		expect(missing.body.data.suggestion).toBeNull();
		expect(missing.body.data.missing).toEqual(['date_of_birth', 'height_cm', 'weight_kg']);
	});
});
