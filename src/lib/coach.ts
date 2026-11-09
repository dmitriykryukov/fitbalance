/**
 * The AI Coach screen's stat strip and highlight cards. Calculated by the
 * app from the same data as the Coach context pack — not by AI.
 */

type Logged = { date: string; kcal: number; protein_g: number };
type NotLogged = { date: string; status: 'not_logged' };

/** The part of the insight context pack this needs (see coach-context.ts). */
export type CoachSummaryInput = {
	today: { nutrition: 'not_logged' | { kcal: number; protein_g: number } };
	goals: {
		calories_kcal: number | null;
		protein_g: number | null;
		weekly_activity_minutes: number | null;
	} | null;
	nutrition_7d: (Logged | NotLogged)[];
	activity_7d: { sessions: unknown[]; minutes: number | null };
	weight: { change_30d: { from_date: string; change: number } | null };
};

export type CoachStats = {
	/** Null when nothing is logged today (shown as "—", never 0). */
	kcal_today: number | null;
	kcal_goal: number | null;
	protein_today: number | null;
	protein_goal: number | null;
	/** Cardio + strength minutes in the last 7 days; null when nothing is logged. */
	training_minutes_7d: number | null;
	training_goal_minutes: number | null;
};

export type Highlight =
	| {
			kind: 'protein';
			/** `on_track`: the 7-day average is at least 90 % of the target. */
			status: 'on_track' | 'low' | 'no_target';
			avg_g: number;
			target_g: number | null;
			days: number;
	  }
	| { kind: 'workouts'; sessions: number; minutes: number | null }
	| { kind: 'weight'; change_kg: number; from_date: string };

/** Share of the protein target that counts as "on track". */
export const PROTEIN_ON_TRACK = 0.9;

export function coachSummary(input: CoachSummaryInput): {
	stats: CoachStats;
	highlights: Highlight[];
} {
	const today = input.today.nutrition === 'not_logged' ? null : input.today.nutrition;
	const goals = input.goals;
	const stats: CoachStats = {
		kcal_today: today ? today.kcal : null,
		kcal_goal: goals?.calories_kcal ?? null,
		protein_today: today ? today.protein_g : null,
		protein_goal: goals?.protein_g ?? null,
		training_minutes_7d: input.activity_7d.minutes,
		training_goal_minutes: goals?.weekly_activity_minutes ?? null
	};

	const highlights: Highlight[] = [];
	const logged = input.nutrition_7d.filter((d): d is Logged => !('status' in d));
	if (logged.length) {
		const avg = Math.round(logged.reduce((sum, d) => sum + d.protein_g, 0) / logged.length);
		const target = goals?.protein_g ?? null;
		highlights.push({
			kind: 'protein',
			status: !target ? 'no_target' : avg >= target * PROTEIN_ON_TRACK ? 'on_track' : 'low',
			avg_g: avg,
			target_g: target,
			days: logged.length
		});
	}
	highlights.push({
		kind: 'workouts',
		sessions: input.activity_7d.sessions.length,
		minutes: input.activity_7d.minutes
	});
	const change = input.weight.change_30d;
	if (change) {
		highlights.push({ kind: 'weight', change_kg: change.change, from_date: change.from_date });
	}
	return { stats, highlights };
}
