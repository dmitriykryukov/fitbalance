import { describe, expect, it } from 'vitest';
import { coachSummary, type CoachSummaryInput } from './coach.js';

const base: CoachSummaryInput = {
	today: { nutrition: 'not_logged' },
	goals: null,
	nutrition_7d: Array.from({ length: 7 }, (_, i) => ({
		date: `2026-11-0${i + 3}`,
		status: 'not_logged' as const
	})),
	activity_7d: { sessions: [], minutes: null },
	weight: { change_30d: null }
};

describe('coachSummary', () => {
	it('shows unknown values as null and only the workouts card without data', () => {
		const { stats, highlights } = coachSummary(base);
		expect(stats).toEqual({
			kcal_today: null,
			kcal_goal: null,
			protein_today: null,
			protein_goal: null,
			training_minutes_7d: null,
			training_goal_minutes: null
		});
		expect(highlights).toEqual([{ kind: 'workouts', sessions: 0, minutes: null }]);
	});

	it('rates protein over logged days against the target', () => {
		const logged = (date: string, protein: number) => ({ date, kcal: 1900, protein_g: protein });
		const input: CoachSummaryInput = {
			...base,
			today: { nutrition: { kcal: 1200, protein_g: 70 } },
			goals: { calories_kcal: 2000, protein_g: 120, weekly_activity_minutes: 150 },
			nutrition_7d: [
				logged('2026-11-08', 100),
				{ date: '2026-11-07', status: 'not_logged' },
				logged('2026-11-06', 110)
			],
			activity_7d: { sessions: [{}, {}], minutes: 95 },
			weight: { change_30d: { from_date: '2026-10-15', change: -0.4 } }
		};
		const { stats, highlights } = coachSummary(input);
		expect(stats).toMatchObject({
			kcal_today: 1200,
			kcal_goal: 2000,
			protein_today: 70,
			training_minutes_7d: 95
		});
		expect(highlights).toEqual([
			{ kind: 'protein', status: 'low', avg_g: 105, target_g: 120, days: 2 },
			{ kind: 'workouts', sessions: 2, minutes: 95 },
			{ kind: 'weight', change_kg: -0.4, from_date: '2026-10-15' }
		]);

		const onTrack = coachSummary({ ...input, nutrition_7d: [logged('2026-11-08', 108)] });
		expect(onTrack.highlights[0]).toMatchObject({ status: 'on_track' }); // 108 ≥ 90 % of 120

		const noTarget = coachSummary({ ...input, goals: null });
		expect(noTarget.highlights[0]).toMatchObject({ status: 'no_target', target_g: null });
	});
});
