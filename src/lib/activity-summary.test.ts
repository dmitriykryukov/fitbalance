import { describe, expect, it } from 'vitest';
import { summarize, toHistory, type ActivityLike, type WorkoutLike } from './activity-summary.js';

const activity = (over: Partial<ActivityLike>): ActivityLike => ({
	id: crypto.randomUUID(),
	activity_type: 'running',
	title: null,
	local_date: '2026-11-09',
	started_at: null,
	created_at: '2026-11-09T08:00:00Z',
	duration_seconds: 1800,
	distance_meters: null,
	steps: null,
	estimated_kcal_burned: null,
	...over
});

const workout = (over: Partial<WorkoutLike>): WorkoutLike => ({
	id: crypto.randomUUID(),
	title: 'Push day',
	local_date: '2026-11-09',
	started_at: null,
	created_at: '2026-11-09T08:00:00Z',
	duration_seconds: 3600,
	estimated_kcal_burned: 210,
	exercise_count: 3,
	set_count: 9,
	...over
});

describe('toHistory', () => {
	it('merges workouts and activities newest first, with pace and speed', () => {
		const history = toHistory(
			[workout({ id: 'w1', local_date: '2026-11-08' })],
			[
				activity({ id: 'run', distance_meters: 7200, duration_seconds: 2640 }),
				activity({ id: 'old', local_date: '2026-11-01' })
			]
		);
		expect(history.map((e) => e.id)).toEqual(['run', 'w1', 'old']);
		expect(history[0]).toMatchObject({
			type: 'running',
			pace_seconds_per_km: 367,
			speed_kmh: 9.82
		});
		expect(history[1]).toMatchObject({ kind: 'workout', type: 'strength', set_count: 9 });
	});

	it('orders the same day by start time, falling back to creation time', () => {
		const history = toHistory(
			[],
			[
				activity({ id: 'morning', started_at: '2026-11-09T07:00:00Z' }),
				activity({ id: 'evening', started_at: '2026-11-09T19:00:00Z' })
			]
		);
		expect(history.map((e) => e.id)).toEqual(['evening', 'morning']);
	});
});

describe('summarize', () => {
	it('builds one bar per day; days without logs are null, not zero', () => {
		const history = toHistory(
			[workout({ local_date: '2026-11-07', duration_seconds: null })],
			[activity({ local_date: '2026-11-09', duration_seconds: 1500 })]
		);
		const s = summarize('2026-11-03', '2026-11-09', history);
		expect(s.days).toHaveLength(7);
		expect(s.days[0]).toEqual({ date: '2026-11-03', seconds: null, entries: 0 });
		expect(s.days[4]).toEqual({ date: '2026-11-07', seconds: null, entries: 1 });
		expect(s.days[6]).toEqual({ date: '2026-11-09', seconds: 1500, entries: 1 });
		expect(s.sessions).toBe(2);
		expect(s.activeSeconds).toBe(1500);
	});

	it('keeps totals null when nothing of that kind was logged', () => {
		const s = summarize('2026-11-03', '2026-11-09', []);
		expect(s).toMatchObject({
			sessions: 0,
			activeSeconds: null,
			distanceMeters: null,
			activeKcal: null,
			walking: { count: 0, steps: null, distanceMeters: null },
			cardio: { count: 0, distanceMeters: null, avgPaceSecondsPerKm: null }
		});
	});

	it('averages pace over runs with distance (Σ seconds ÷ Σ km) and sums categories', () => {
		const history = toHistory(
			[workout({}), workout({ duration_seconds: 2700, estimated_kcal_burned: null, set_count: 6 })],
			[
				activity({ distance_meters: 5000, duration_seconds: 1500, estimated_kcal_burned: 400 }),
				activity({ distance_meters: 10000, duration_seconds: 3300 }),
				activity({ distance_meters: null, duration_seconds: 1200 }),
				activity({ activity_type: 'cycling', distance_meters: 20000, duration_seconds: 3600 }),
				activity({ activity_type: 'walking', steps: 6000, distance_meters: 4000 }),
				activity({ activity_type: 'walking', steps: null }),
				activity({ local_date: '2026-10-01', distance_meters: 1000 })
			]
		);
		const s = summarize('2026-11-03', '2026-11-09', history);
		expect(s.cardio.avgPaceSecondsPerKm).toBe(320); // 4800 s / 15 km
		expect(s.cardio.count).toBe(4);
		expect(s.cardio.distanceMeters).toBe(35000);
		expect(s.walking).toEqual({ count: 2, steps: 6000, distanceMeters: 4000 });
		expect(s.strength).toEqual({ count: 2, seconds: 6300, sets: 15 });
		expect(s.distanceMeters).toBe(39000);
		expect(s.activeKcal).toBe(610);
		expect(s.sessions).toBe(8);
	});
});
