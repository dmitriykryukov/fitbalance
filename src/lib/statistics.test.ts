import { describe, expect, it } from 'vitest';
import { toHistory } from './activity-summary.js';
import {
	bodyTrend,
	buildStatistics,
	goalOn,
	nutritionStats,
	rangeDates,
	type GoalVersion
} from './statistics.js';

const goal = (effective_from: string, kcal: number | null, extra: Partial<GoalVersion> = {}) => ({
	effective_from,
	calories_kcal: kcal,
	protein_g: 150,
	carbs_g: 200,
	fat_g: 60,
	target_weight_kg: null,
	target_waist_cm: null,
	...extra
});

const day = (local_date: string, kcal: number, protein_g = 100) => ({
	local_date,
	kcal,
	protein_g,
	carbs_g: 200,
	fat_g: 60
});

describe('ranges and goals', () => {
	it('7/30/90 day windows end on the given day (inclusive)', () => {
		expect(rangeDates('7d', '2026-11-09')).toEqual({ from: '2026-11-03', to: '2026-11-09' });
		expect(rangeDates('30d', '2026-11-09').from).toBe('2026-10-11');
		expect(rangeDates('90d', '2026-11-09').from).toBe('2026-08-12');
	});

	it('picks the goal version active on a date', () => {
		const versions = [goal('2026-11-05', 1800), goal('2026-10-01', 2000)];
		expect(goalOn(versions, '2026-09-30')).toBeNull();
		expect(goalOn(versions, '2026-11-04')?.calories_kcal).toBe(2000);
		expect(goalOn(versions, '2026-11-05')?.calories_kcal).toBe(1800);
	});
});

describe('nutritionStats', () => {
	it('averages logged days only; unlogged days are null gaps', () => {
		const s = nutritionStats(
			'2026-11-03',
			'2026-11-09',
			[day('2026-11-03', 1800, 120), day('2026-11-05', 2200, 90), day('2026-11-09', 1000, 30)],
			[goal('2026-10-01', 2000)]
		);
		expect(s.days).toHaveLength(7);
		expect(s.days[1]).toEqual({
			date: '2026-11-04',
			kcal: null,
			protein_g: null,
			carbs_g: null,
			fat_g: null,
			target_kcal: 2000
		});
		expect(s.days_logged).toBe(3);
		expect(s.avg_kcal).toBe(1667); // (1800 + 2200 + 1000) / 3, not / 7
		expect(s.avg_protein_g).toBe(80);
		// 1800 and 2200 are within ±10 % of 2000; 1000 is not.
		expect(s.within_target_pct).toBe(67);
		expect(s.days_with_target).toBe(3);
		expect(s.targets).toMatchObject({ calories_kcal: 2000, protein_g: 150 });
	});

	it('uses the target of the goal active each day', () => {
		const s = nutritionStats(
			'2026-11-03',
			'2026-11-09',
			[day('2026-11-03', 2000), day('2026-11-08', 2000)],
			[goal('2026-10-01', 2000), goal('2026-11-07', 1600)]
		);
		expect(s.days.map((d) => d.target_kcal)).toEqual([2000, 2000, 2000, 2000, 1600, 1600, 1600]);
		expect(s.within_target_pct).toBe(50);
		expect(s.targets?.calories_kcal).toBe(1600);
	});

	it('nothing logged → nulls, never zeros', () => {
		const s = nutritionStats('2026-11-03', '2026-11-09', [], []);
		expect(s).toMatchObject({
			days_logged: 0,
			avg_kcal: null,
			avg_protein_g: null,
			within_target_pct: null,
			targets: null
		});
		expect(s.days.every((d) => d.kcal === null && d.target_kcal === null)).toBe(true);
	});
});

describe('bodyTrend', () => {
	const rows = [
		{
			local_date: '2026-10-20',
			measured_at: '2026-10-20T07:00:00Z',
			weight_kg: 84,
			waist_cm: null
		},
		{ local_date: '2026-11-03', measured_at: '2026-11-03T07:00:00Z', weight_kg: 82, waist_cm: 90 },
		{
			local_date: '2026-11-06',
			measured_at: '2026-11-06T07:00:00Z',
			weight_kg: 81.6,
			waist_cm: null
		},
		{
			local_date: '2026-11-06',
			measured_at: '2026-11-06T20:00:00Z',
			weight_kg: 81.2,
			waist_cm: null
		},
		{ local_date: '2026-11-08', measured_at: '2026-11-08T07:00:00Z', weight_kg: 81, waist_cm: 89 }
	];

	it('one point per measured day (the latest), change and progress within the range', () => {
		const t = bodyTrend('2026-11-03', '2026-11-09', rows, 'weight_kg', 78);
		expect(t.points).toEqual([
			{ date: '2026-11-03', value: 82 },
			{ date: '2026-11-06', value: 81.2 },
			{ date: '2026-11-08', value: 81 }
		]);
		expect(t).toMatchObject({ current: 81, current_date: '2026-11-08', change: -1, target: 78 });
		expect(t.progress_pct).toBe(25); // 1 of 4 kg toward 78
	});

	it('keeps the latest older value as current but no change without two points in range', () => {
		const t = bodyTrend('2026-11-09', '2026-11-09', rows, 'weight_kg', null);
		expect(t).toMatchObject({ points: [], current: 81, change: null, progress_pct: null });
		const waist = bodyTrend('2026-11-03', '2026-11-09', rows, 'waist_cm', null);
		expect(waist).toMatchObject({ current: 89, change: -1, progress_pct: null });
	});

	it('clamps progress when moving away from the target', () => {
		const up = [
			{ local_date: '2026-11-03', measured_at: 'a', weight_kg: 80, waist_cm: null },
			{ local_date: '2026-11-05', measured_at: 'b', weight_kg: 81, waist_cm: null }
		];
		expect(bodyTrend('2026-11-03', '2026-11-09', up, 'weight_kg', 75).progress_pct).toBe(0);
	});
});

describe('buildStatistics', () => {
	it('combines nutrition, activity and body for the range', () => {
		const history = toHistory(
			[
				{
					id: 'w',
					title: 'Legs',
					local_date: '2026-11-04',
					started_at: null,
					created_at: '2026-11-04T10:00:00Z',
					duration_seconds: 3600,
					estimated_kcal_burned: 250,
					exercise_count: 4,
					set_count: 12
				}
			],
			[
				{
					id: 'r',
					activity_type: 'running',
					title: null,
					local_date: '2026-11-06',
					started_at: null,
					created_at: '2026-11-06T07:00:00Z',
					duration_seconds: 1800,
					distance_meters: 5000,
					steps: null,
					estimated_kcal_burned: null
				},
				{
					id: 'w2',
					activity_type: 'walking',
					title: null,
					local_date: '2026-11-07',
					started_at: null,
					created_at: '2026-11-07T07:00:00Z',
					duration_seconds: 2400,
					distance_meters: 3000,
					steps: 5000,
					estimated_kcal_burned: 120
				}
			]
		);
		const s = buildStatistics({
			range: '7d',
			end: '2026-11-09',
			nutrition: [day('2026-11-04', 1900)],
			goals: [goal('2026-10-01', 2000, { target_weight_kg: 75 })],
			history,
			body: []
		});
		expect(s).toMatchObject({ from: '2026-11-03', to: '2026-11-09', days_total: 7 });
		expect(s.activity).toMatchObject({
			sessions: 3,
			strength_workouts: 1,
			active_seconds: 7800,
			run_distance_meters: 5000,
			steps: 5000,
			active_kcal: 370
		});
		expect(s.activity.days.map((d) => d.seconds)).toEqual([
			null,
			3600,
			null,
			1800,
			2400,
			null,
			null
		]);
		expect(s.body.weight).toMatchObject({ points: [], current: null, target: 75, change: null });
	});
});
