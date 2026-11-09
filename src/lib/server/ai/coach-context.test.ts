import { describe, expect, it } from 'vitest';
import type { HistoryEntry } from '#lib/activity-summary.js';
import {
	buildCoachContext,
	buildInsightContext,
	loggedDays,
	type CoachRaw,
	type CoachWorkout
} from './coach-context.js';

const TODAY = '2026-11-09';
const ago = (n: number) => {
	const d = new Date(`${TODAY}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() - n);
	return d.toISOString().slice(0, 10);
};

function raw(overrides: Partial<CoachRaw> = {}): CoachRaw {
	return {
		today: TODAY,
		local_time: '14:05',
		profile: { date_of_birth: '1990-05-01', sex: 'female', height_cm: 168 },
		goals: [],
		nutrition: [],
		meals: [],
		history: [],
		workouts: [],
		measurements: [],
		has_any: { meals: false, activities: false, workouts: false, measurements: false },
		...overrides
	};
}

function run(date: string, minutes: number, km: number | null = null): HistoryEntry {
	return {
		kind: 'activity',
		id: `act-${date}`,
		type: 'running',
		title: null,
		local_date: date,
		started_at: null,
		created_at: `${date}T07:00:00Z`,
		duration_seconds: minutes * 60,
		distance_meters: km === null ? null : km * 1000,
		steps: null,
		kcal: 400,
		exercise_count: null,
		set_count: null,
		pace_seconds_per_km: null,
		speed_kmh: null
	};
}

const goal = {
	effective_from: ago(60),
	fitness_goal: 'lose_fat',
	calories_kcal: 2000,
	protein_g: 120,
	carbs_g: 200,
	fat_g: 60,
	target_weight_kg: 65,
	target_waist_cm: null,
	weekly_activity_minutes: 150
};

const day = (date: string, kcal: number, protein: number) => ({
	local_date: date,
	kcal,
	protein_g: protein,
	carbs_g: 150,
	fat_g: 50
});

describe('buildCoachContext', () => {
	it('with no data: every day not logged, nothing averaged, all types flagged', () => {
		const ctx = buildCoachContext(raw());
		expect(ctx.today.nutrition).toBe('not_logged');
		expect(ctx.nutrition_7d).toHaveLength(7);
		expect(ctx.nutrition_7d.every((d) => 'status' in d && d.status === 'not_logged')).toBe(true);
		expect(ctx.nutrition_30d.days_logged).toBe(0);
		expect(ctx.nutrition_30d.averages_over_logged_days).toBeNull();
		expect(ctx.activity_14d.minutes_last_7d).toBeNull(); // unknown, not 0
		expect(ctx.goals).toBeNull();
		expect(ctx.measurements.weight.latest).toBeNull();
		expect(ctx.completeness.no_records).toEqual([
			'nutrition',
			'cardio_activities',
			'strength_workouts',
			'body_measurements',
			'goals'
		]);
		expect(ctx.completeness.ai_estimated_item_share_30d).toBeNull();
	});

	it('with 2 of 7 days logged: averages use the logged days only', () => {
		const ctx = buildCoachContext(
			raw({
				goals: [goal],
				nutrition: [day(ago(1), 1800, 100), day(ago(3), 2200, 140)],
				has_any: { meals: true, activities: false, workouts: false, measurements: false }
			})
		);
		expect(ctx.nutrition_7d.filter((d) => !('status' in d))).toHaveLength(2);
		expect(ctx.nutrition_7d.at(-2)).toMatchObject({ date: ago(1), kcal: 1800, target_kcal: 2000 });
		expect(ctx.nutrition_30d).toMatchObject({
			days_logged: 2,
			averages_over_logged_days: { kcal: 2000, protein_g: 120 },
			within_10pct_of_target_pct: 100
		});
		expect(ctx.completeness.nutrition_days_logged_7d).toBe(2);
		expect(ctx.completeness.no_records).not.toContain('nutrition');
		expect(ctx.goals).toMatchObject({ calories_kcal: 2000, weekly_activity_minutes: 150 });
	});

	it("describes today's meals and the share of AI-estimated items", () => {
		const ctx = buildCoachContext(
			raw({
				nutrition: [day(TODAY, 650, 30)],
				meals: [
					{
						local_date: TODAY,
						meal_type: 'breakfast',
						items: [{ estimate_source: 'ai_estimate' }, { estimate_source: 'user_entered' }]
					},
					{ local_date: ago(2), meal_type: 'lunch', items: [{ estimate_source: 'my_food' }] },
					{ local_date: ago(2), meal_type: 'dinner', items: [{ estimate_source: 'ai_edited' }] }
				]
			})
		);
		expect(ctx.today.nutrition).toMatchObject({
			kcal: 650,
			meals_logged: ['breakfast'],
			includes_ai_estimates: true
		});
		expect(ctx.today.local_time).toBe('14:05');
		expect(ctx.today.weekday).toBe('Monday');
		expect(ctx.completeness.ai_estimated_item_share_30d).toBe(0.5);
	});

	it('summarizes activity minutes per week and workouts with their best set', () => {
		const workout: CoachWorkout = {
			title: 'Upper body',
			local_date: ago(2),
			duration_seconds: 3000,
			sets: [
				{
					exercise_order: 0,
					exercise_name: 'Bench press',
					reps: 8,
					weight_kg: 60,
					duration_seconds: null,
					distance_meters: null
				},
				{
					exercise_order: 0,
					exercise_name: 'Bench press',
					reps: 10,
					weight_kg: 60,
					duration_seconds: null,
					distance_meters: null
				},
				{
					exercise_order: 0,
					exercise_name: 'Bench press',
					reps: 12,
					weight_kg: 50,
					duration_seconds: null,
					distance_meters: null
				},
				{
					exercise_order: 1,
					exercise_name: 'Plank',
					reps: null,
					weight_kg: null,
					duration_seconds: 60,
					distance_meters: null
				}
			]
		};
		const strength: HistoryEntry = { ...run(ago(2), 50), kind: 'workout', type: 'strength' };
		const ctx = buildCoachContext(
			raw({
				goals: [goal],
				workouts: [workout],
				history: [run(ago(1), 30, 5), strength, run(ago(9), 40, 6), run(ago(20), 60, 10)]
			})
		);
		expect(ctx.activity_14d.minutes_last_7d).toBe(80);
		expect(ctx.activity_14d.minutes_previous_7d).toBe(40);
		// Only cardio sessions here; strength is in workouts_14d. Day 20 is outside 14 days.
		expect(ctx.activity_14d.sessions.map((s) => s.date)).toEqual([ago(1), ago(9)]);
		expect(ctx.activity_14d.sessions[0]).toMatchObject({
			type: 'running',
			duration_min: 30,
			distance_km: 5
		});
		expect(ctx.workouts_14d).toEqual([
			{
				date: ago(2),
				title: 'Upper body',
				duration_min: 50,
				exercises: [
					{ name: 'Bench press', sets: 3, best_set: '60 kg x 10' },
					{ name: 'Plank', sets: 1, best_set: '60 s' }
				]
			}
		]);
	});

	it('reports the 30-day weight change from measured days only', () => {
		const m = (date: string, weight: number | null, waist: number | null = null) => ({
			local_date: date,
			measured_at: `${date}T08:00:00Z`,
			weight_kg: weight,
			waist_cm: waist
		});
		const ctx = buildCoachContext(
			raw({
				goals: [goal],
				measurements: [m(ago(1), 70.2), m(ago(10), null, 80), m(ago(25), 71), m(ago(45), 73)]
			})
		);
		expect(ctx.measurements.weight).toEqual({
			latest: 70.2,
			latest_date: ago(1),
			target: 65,
			change_30d: { from_date: ago(25), to_date: ago(1), change: -0.8 }
		});
		expect(ctx.measurements.waist.change_30d).toBeNull(); // one point is not a change
		expect(ctx.measurements.recent).toHaveLength(4);
	});

	it('contains no identity, contact details or record ids', () => {
		const profile = {
			id: 'user-uuid-123',
			display_name: 'Anna Secret',
			date_of_birth: '1990-05-01',
			sex: 'female',
			height_cm: 168,
			timezone: 'Europe/Moscow'
		};
		const json = JSON.stringify(
			buildCoachContext(raw({ profile, history: [run(ago(1), 30)], goals: [goal] }))
		);
		expect(json).not.toContain('user-uuid-123');
		expect(json).not.toContain('Anna');
		expect(json).not.toContain('act-');
		expect(json).toContain('"age_years":36');
	});

	it('stays well under the token budget with a busy month', () => {
		const history = Array.from({ length: 14 }, (_, i) => run(ago(i), 45, 7));
		const nutrition = Array.from({ length: 30 }, (_, i) => day(ago(i), 2000, 110));
		const json = JSON.stringify(buildCoachContext(raw({ history, nutrition, goals: [goal] })));
		// ~4 characters per token: 6 000 tokens ≈ 24 000 characters.
		expect(json.length).toBeLessThan(12_000);
	});
});

describe('buildInsightContext', () => {
	it('is the smaller pack: today, 7 days, goal, weight', () => {
		const ctx = buildInsightContext(
			raw({ goals: [goal], history: [run(ago(3), 30), run(ago(10), 30)] })
		);
		expect(Object.keys(ctx)).toEqual([
			'today',
			'profile',
			'goals',
			'nutrition_7d',
			'activity_7d',
			'weight',
			'completeness'
		]);
		expect(ctx.activity_7d).toMatchObject({ minutes: 30, weekly_goal_minutes: 150 });
		expect(ctx.activity_7d.sessions).toHaveLength(1);
	});
});

describe('loggedDays', () => {
	it('counts distinct days with any record in the range', () => {
		const r = raw({
			nutrition: [day(ago(1), 1800, 90)],
			history: [run(ago(1), 30), run(ago(4), 30), run(ago(8), 30)],
			measurements: [
				{ local_date: ago(2), measured_at: `${ago(2)}T08:00:00Z`, weight_kg: 70, waist_cm: null }
			]
		});
		expect(loggedDays(r, ago(6), TODAY)).toBe(3);
		expect(loggedDays(raw(), ago(6), TODAY)).toBe(0);
	});
});
