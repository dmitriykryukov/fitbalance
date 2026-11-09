/**
 * The Coach context pack (AI_SPEC.md → AI Coach → Context pack): one compact
 * JSON object built by the server from the signed-in user's own records.
 * The model never gets a user ID, a name, an email or free-text notes, and
 * never queries the database itself.
 *
 * `buildCoachContext` is pure (tested); `loadCoachContext` runs the queries.
 */
import { toHistory, type HistoryEntry } from '#lib/activity-summary.js';
import { addDays, ageOn, localTime } from '#lib/dates.js';
import {
	bodyTrend,
	goalOn,
	nutritionStats,
	type BodyRow,
	type GoalVersion,
	type NutritionRow
} from '#lib/statistics.js';
import { unwrap } from '../db.js';
import { listActivities } from '../services/activities.js';
import type { Profile } from '../services/profile.js';
import type { SupabaseServerClient } from '../supabase.js';

export type CoachGoal = GoalVersion & {
	fitness_goal: string | null;
	weekly_activity_minutes: number | null;
};

export type CoachMeal = {
	local_date: string;
	meal_type: string;
	items: { estimate_source: string }[];
};

export type CoachWorkout = {
	title: string;
	local_date: string;
	duration_seconds: number | null;
	sets: {
		exercise_order: number;
		exercise_name: string;
		reps: number | null;
		weight_kg: number | null;
		duration_seconds: number | null;
		distance_meters: number | null;
	}[];
};

/** Everything the pack is built from (already limited to the user's rows). */
export type CoachRaw = {
	today: string;
	/** "HH:MM" in the user's time zone, so the model knows today is still in progress. */
	local_time: string;
	profile: Pick<Profile, 'date_of_birth' | 'sex' | 'height_cm'>;
	/** Goal versions with `effective_from ≤ today`. */
	goals: CoachGoal[];
	/** `daily_nutrition` rows of the last 30 days. */
	nutrition: NutritionRow[];
	/** Meals of the last 30 days with their items' estimate sources. */
	meals: CoachMeal[];
	/** Cardio/other activities and strength workouts of the last 14 days, newest first. */
	history: HistoryEntry[];
	workouts: CoachWorkout[];
	/** Body measurements up to today, newest first (at most a few dozen). */
	measurements: BodyRow[];
	/** Days (ever) with records, for "no records" flags beyond the windows. */
	has_any: { meals: boolean; activities: boolean; workouts: boolean; measurements: boolean };
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const minutes = (seconds: number | null) => (seconds === null ? null : Math.round(seconds / 60));
const km = (meters: number | null) => (meters === null ? null : Math.round(meters / 10) / 100);

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekday = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];

function goalSummary(goal: CoachGoal | null) {
	if (!goal) return null;
	return {
		effective_from: goal.effective_from,
		fitness_goal: goal.fitness_goal,
		calories_kcal: goal.calories_kcal,
		protein_g: goal.protein_g,
		carbs_g: goal.carbs_g,
		fat_g: goal.fat_g,
		target_weight_kg: goal.target_weight_kg,
		target_waist_cm: goal.target_waist_cm,
		weekly_activity_minutes: goal.weekly_activity_minutes
	};
}

/** Best set of an exercise: heaviest weight, then most reps; else longest/farthest. */
function bestSet(sets: CoachWorkout['sets']): string | null {
	const weighted = sets.filter((s) => s.weight_kg !== null && s.reps !== null);
	if (weighted.length) {
		const best = weighted.reduce((a, b) =>
			b.weight_kg! > a.weight_kg! || (b.weight_kg === a.weight_kg && b.reps! > a.reps!) ? b : a
		);
		return `${best.weight_kg} kg x ${best.reps}`;
	}
	const reps = sets.filter((s) => s.reps !== null);
	if (reps.length) return `${Math.max(...reps.map((s) => s.reps!))} reps (bodyweight)`;
	const timed = sets.filter((s) => s.duration_seconds !== null);
	if (timed.length) return `${Math.max(...timed.map((s) => s.duration_seconds!))} s`;
	const distance = sets.filter((s) => s.distance_meters !== null);
	if (distance.length) return `${Math.max(...distance.map((s) => s.distance_meters!))} m`;
	return null;
}

function workoutSummary(w: CoachWorkout) {
	const byOrder = new Map<number, CoachWorkout['sets']>();
	for (const set of [...w.sets].sort((a, b) => a.exercise_order - b.exercise_order)) {
		byOrder.set(set.exercise_order, [...(byOrder.get(set.exercise_order) ?? []), set]);
	}
	return {
		date: w.local_date,
		title: w.title,
		duration_min: minutes(w.duration_seconds),
		exercises: [...byOrder.values()].map((sets) => ({
			name: sets[0].exercise_name,
			sets: sets.length,
			best_set: bestSet(sets)
		}))
	};
}

function sessionSummary(e: HistoryEntry) {
	return {
		date: e.local_date,
		type: e.type,
		duration_min: minutes(e.duration_seconds),
		distance_km: km(e.distance_meters),
		steps: e.steps,
		active_kcal: e.kcal === null ? null : Math.round(e.kcal)
	};
}

/** Activity minutes (cardio + strength) on days `from..to`; null when nothing is logged. */
function minutesBetween(history: HistoryEntry[], from: string, to: string): number | null {
	const inRange = history.filter((e) => e.local_date >= from && e.local_date <= to);
	if (!inRange.length) return null;
	return Math.round(inRange.reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0) / 60);
}

function measurementTrend(raw: CoachRaw, field: 'weight_kg' | 'waist_cm', target: number | null) {
	const trend = bodyTrend(addDays(raw.today, -29), raw.today, raw.measurements, field, target);
	const first = trend.points[0];
	const last = trend.points.at(-1);
	return {
		latest: trend.current,
		latest_date: trend.current_date,
		target,
		change_30d:
			trend.change === null
				? null
				: { from_date: first!.date, to_date: last!.date, change: trend.change }
	};
}

/** Days in `from..to` with any record (a meal, activity, workout or measurement). */
export function loggedDays(raw: CoachRaw, from: string, to: string): number {
	const days = new Set<string>();
	for (const r of raw.nutrition) days.add(r.local_date);
	for (const e of raw.history) days.add(e.local_date);
	for (const r of raw.measurements) days.add(r.local_date);
	return [...days].filter((d) => d >= from && d <= to).length;
}

/** Parts shared by the Coach pack and the smaller insight pack. */
function sections(raw: CoachRaw) {
	const { today } = raw;
	const from7 = addDays(today, -6);
	const from14 = addDays(today, -13);
	const from30 = addDays(today, -29);

	const goal = goalOn(raw.goals, today);
	const n30 = nutritionStats(from30, today, raw.nutrition, raw.goals);
	const days7 = n30.days.filter((d) => d.date >= from7);

	const todayRow = n30.days.at(-1)!;
	const todayMeals = raw.meals.filter((m) => m.local_date === today);
	const items30 = raw.meals.flatMap((m) => m.items);
	const aiItems = items30.filter(
		(i) => i.estimate_source === 'ai_estimate' || i.estimate_source === 'ai_edited'
	).length;

	const history14 = raw.history.filter((e) => e.local_date >= from14 && e.local_date <= today);
	const history7 = history14.filter((e) => e.local_date >= from7);
	const workouts14 = raw.workouts.filter((w) => w.local_date >= from14 && w.local_date <= today);

	const noRecords: string[] = [];
	if (!raw.has_any.meals) noRecords.push('nutrition');
	if (!raw.has_any.activities) noRecords.push('cardio_activities');
	if (!raw.has_any.workouts) noRecords.push('strength_workouts');
	if (!raw.has_any.measurements) noRecords.push('body_measurements');
	if (!goal) noRecords.push('goals');

	const profile = {
		age_years: raw.profile.date_of_birth ? ageOn(raw.profile.date_of_birth, today) : null,
		sex: raw.profile.sex,
		height_cm: raw.profile.height_cm
	};

	const todaySection = {
		date: today,
		weekday: weekday(today),
		local_time: raw.local_time,
		nutrition:
			todayRow.kcal === null
				? ('not_logged' as const)
				: {
						kcal: Math.round(todayRow.kcal),
						protein_g: round1(todayRow.protein_g ?? 0),
						carbs_g: round1(todayRow.carbs_g ?? 0),
						fat_g: round1(todayRow.fat_g ?? 0),
						meals_logged: [...new Set(todayMeals.map((m) => m.meal_type))],
						includes_ai_estimates: todayMeals.some((m) =>
							m.items.some(
								(i) => i.estimate_source === 'ai_estimate' || i.estimate_source === 'ai_edited'
							)
						)
					},
		activities: history14.filter((e) => e.local_date === today).map(sessionSummary)
	};

	const nutrition7d = days7.map((d) =>
		d.kcal === null
			? { date: d.date, status: 'not_logged' as const }
			: {
					date: d.date,
					kcal: Math.round(d.kcal),
					protein_g: round1(d.protein_g ?? 0),
					carbs_g: round1(d.carbs_g ?? 0),
					fat_g: round1(d.fat_g ?? 0),
					target_kcal: d.target_kcal
				}
	);

	const weight = measurementTrend(raw, 'weight_kg', goal?.target_weight_kg ?? null);
	const daysLogged7 = days7.filter((d) => d.kcal !== null).length;

	const completeness = {
		nutrition_days_logged_7d: daysLogged7,
		nutrition_days_logged_30d: n30.days_logged,
		ai_estimated_item_share_30d: items30.length ? round1(aiItems / items30.length) : null,
		no_records: noRecords
	};

	return {
		today,
		from7,
		from14,
		goal,
		n30,
		profile,
		todaySection,
		nutrition7d,
		weight,
		completeness,
		history7,
		history14,
		workouts14
	};
}

/** The smaller pack for the daily insight: today, the last 7 days and the active goal. */
export function buildInsightContext(raw: CoachRaw) {
	const s = sections(raw);
	return {
		today: s.todaySection,
		profile: s.profile,
		goals: goalSummary(s.goal),
		nutrition_7d: s.nutrition7d,
		activity_7d: {
			sessions: s.history7.map(sessionSummary),
			minutes: minutesBetween(raw.history, s.from7, s.today),
			weekly_goal_minutes: s.goal?.weekly_activity_minutes ?? null
		},
		weight: s.weight,
		completeness: s.completeness
	};
}

/** The full Coach pack (AI_SPEC.md → Context pack). */
export function buildCoachContext(raw: CoachRaw) {
	const s = sections(raw);
	const { today, from7, from14, goal, n30, history14, workouts14 } = s;
	const measured = raw.measurements
		.filter((r) => r.local_date <= today)
		.slice(0, 10)
		.map((r) => ({ date: r.local_date, weight_kg: r.weight_kg, waist_cm: r.waist_cm }));

	return {
		today: s.todaySection,
		profile: s.profile,
		goals: goalSummary(goal),
		nutrition_7d: s.nutrition7d,
		nutrition_30d: {
			days_total: 30,
			days_logged: n30.days_logged,
			averages_over_logged_days: n30.days_logged
				? {
						kcal: n30.avg_kcal,
						protein_g: n30.avg_protein_g,
						carbs_g: n30.avg_carbs_g,
						fat_g: n30.avg_fat_g
					}
				: null,
			within_10pct_of_target_pct: n30.within_target_pct,
			days_with_target: n30.days_with_target
		},
		activity_14d: {
			sessions: history14.filter((e) => e.kind === 'activity').map(sessionSummary),
			minutes_last_7d: minutesBetween(raw.history, from7, today),
			minutes_previous_7d: minutesBetween(raw.history, from14, addDays(from7, -1)),
			weekly_goal_minutes: goal?.weekly_activity_minutes ?? null
		},
		workouts_14d: workouts14.map(workoutSummary),
		measurements: {
			recent: measured,
			weight: s.weight,
			waist: measurementTrend(raw, 'waist_cm', goal?.target_waist_cm ?? null)
		},
		completeness: s.completeness
	};
}

export type CoachContext = ReturnType<typeof buildCoachContext>;

/** Loads the user's rows for the pack. Every query is filtered by `userId` (and RLS). */
export async function loadCoachRaw(
	sb: SupabaseServerClient,
	userId: string,
	profile: Profile,
	today: string,
	at: Date = new Date()
): Promise<CoachRaw> {
	const from14 = addDays(today, -13);
	const from30 = addDays(today, -29);
	const exists = (table: 'meals' | 'activities' | 'workouts' | 'body_measurements') =>
		sb.from(table).select('id').eq('user_id', userId).lte('local_date', today).limit(1);

	const [goals, nutrition, meals, activities, workouts, measurements, ...any] = await Promise.all([
		sb
			.from('user_goals')
			.select(
				'effective_from, fitness_goal, calories_kcal, protein_g, carbs_g, fat_g, target_weight_kg, target_waist_cm, weekly_activity_minutes'
			)
			.eq('user_id', userId)
			.lte('effective_from', today)
			.order('effective_from', { ascending: false })
			.limit(100),
		sb
			.from('daily_nutrition')
			.select('local_date, kcal, protein_g, carbs_g, fat_g')
			.eq('user_id', userId)
			.gte('local_date', from30)
			.lte('local_date', today),
		sb
			.from('meals')
			.select('local_date, meal_type, items:meal_items(estimate_source)')
			.eq('user_id', userId)
			.gte('local_date', from30)
			.lte('local_date', today)
			.limit(500),
		listActivities(sb, userId, { from: from14, to: today }),
		sb
			.from('workouts')
			.select(
				'id, title, local_date, started_at, created_at, duration_seconds, estimated_kcal_burned, sets:workout_sets(exercise_order, exercise_name, reps, weight_kg, duration_seconds, distance_meters)'
			)
			.eq('user_id', userId)
			.gte('local_date', from14)
			.lte('local_date', today)
			.order('local_date', { ascending: false })
			.limit(50),
		sb
			.from('body_measurements')
			.select('local_date, measured_at, weight_kg, waist_cm')
			.eq('user_id', userId)
			.lte('local_date', today)
			.order('local_date', { ascending: false })
			.order('measured_at', { ascending: false })
			.limit(60),
		exists('meals'),
		exists('activities'),
		exists('workouts'),
		exists('body_measurements')
	]);

	const workoutRows = unwrap(workouts) ?? [];
	const [anyMeals, anyActivities, anyWorkouts, anyMeasurements] = any.map(
		(r) => (unwrap(r) ?? []).length > 0
	);

	return {
		today,
		local_time: localTime(profile.timezone, at),
		profile,
		goals: unwrap(goals) ?? [],
		nutrition: (unwrap(nutrition) ?? []).filter(
			(r): r is typeof r & { local_date: string } => r.local_date !== null
		),
		meals: unwrap(meals) ?? [],
		history: toHistory(
			workoutRows.map(({ sets, ...w }) => ({
				...w,
				set_count: sets.length,
				exercise_count: new Set(sets.map((s) => s.exercise_order)).size
			})),
			activities
		),
		workouts: workoutRows,
		measurements: unwrap(measurements) ?? [],
		has_any: {
			meals: anyMeals,
			activities: anyActivities,
			workouts: anyWorkouts,
			measurements: anyMeasurements
		}
	};
}
