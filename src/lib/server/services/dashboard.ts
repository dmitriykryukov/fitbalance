import { MEAL_TYPES, type MealType } from '#lib/nutrition.js';
import { unwrap } from '../db.js';
import type { SupabaseServerClient } from '../supabase.js';
import { getActiveGoal, type Goal } from './goals.js';
import { getDailyNutrition, listMeals } from './meals.js';

export type DayNutrition = {
	/** False when no meal is logged for the day (the totals are then 0, not data). */
	logged: boolean;
	kcal: number;
	protein_g: number;
	carbs_g: number;
	fat_g: number;
	fibre_g: number | null;
	/** Goal − food kcal; never adjusted for active kcal. Null without a calorie goal. */
	kcal_left: number | null;
	has_ai_estimates: boolean;
};

export type MealSummary =
	| { meal_type: MealType; logged: false }
	| {
			meal_type: MealType;
			logged: true;
			kcal: number;
			/** Time of the first meal of this type. */
			logged_at: string;
			item_names: string[];
			meal_count: number;
			has_ai_estimates: boolean;
	  };

export type LatestActivity =
	| {
			kind: 'workout';
			id: string;
			title: string;
			local_date: string;
			duration_seconds: number | null;
			sets: number;
			exercises: number;
	  }
	| {
			kind: 'activity';
			id: string;
			activity_type: string;
			title: string | null;
			local_date: string;
			duration_seconds: number;
			distance_meters: number | null;
	  };

export type DayActivity = {
	/** Null when nothing of that kind is logged for the day. */
	gym_minutes: number | null;
	steps: number | null;
	active_kcal: number | null;
	latest: LatestActivity | null;
};

export type Dashboard = {
	date: string;
	goal: Goal | null;
	nutrition: DayNutrition;
	meals: MealSummary[];
	activity: DayActivity;
};

export async function dayNutrition(
	sb: SupabaseServerClient,
	userId: string,
	date: string,
	goal: Goal | null
): Promise<DayNutrition> {
	const row = await getDailyNutrition(sb, userId, date);
	const kcal = row?.kcal ?? 0;
	return {
		logged: row !== null,
		kcal,
		protein_g: row?.protein_g ?? 0,
		carbs_g: row?.carbs_g ?? 0,
		fat_g: row?.fat_g ?? 0,
		fibre_g: row?.fibre_g ?? null,
		// Shown next to the rounded intake, so the two always add up to the goal.
		kcal_left: goal?.calories_kcal == null ? null : goal.calories_kcal - Math.round(kcal),
		has_ai_estimates: row?.has_ai_estimates ?? false
	};
}

const sum = (values: (number | null)[]) => {
	const present = values.filter((v): v is number => v !== null);
	return present.length ? present.reduce((a, b) => a + b, 0) : null;
};

async function dayActivity(
	sb: SupabaseServerClient,
	userId: string,
	date: string
): Promise<DayActivity> {
	const [workouts, activities, lastWorkout, lastActivity] = await Promise.all([
		sb
			.from('workouts')
			.select('duration_seconds, estimated_kcal_burned')
			.eq('user_id', userId)
			.eq('local_date', date),
		sb
			.from('activities')
			.select('activity_type, steps, estimated_kcal_burned')
			.eq('user_id', userId)
			.eq('local_date', date),
		sb
			.from('workouts')
			.select(
				'id, title, local_date, started_at, created_at, duration_seconds, sets:workout_sets(exercise_order)'
			)
			.eq('user_id', userId)
			.lte('local_date', date)
			.order('local_date', { ascending: false })
			.order('started_at', { ascending: false, nullsFirst: false })
			.order('created_at', { ascending: false })
			.limit(1)
			.maybeSingle(),
		sb
			.from('activities')
			.select(
				'id, activity_type, title, local_date, started_at, created_at, duration_seconds, distance_meters'
			)
			.eq('user_id', userId)
			.lte('local_date', date)
			.order('local_date', { ascending: false })
			.order('started_at', { ascending: false, nullsFirst: false })
			.order('created_at', { ascending: false })
			.limit(1)
			.maybeSingle()
	]);

	const w = unwrap(workouts) ?? [];
	const a = unwrap(activities) ?? [];
	const lw = unwrap(lastWorkout);
	const la = unwrap(lastActivity);

	const gymSeconds = sum(w.map((x) => x.duration_seconds));
	const steps = sum(a.filter((x) => x.activity_type === 'walking').map((x) => x.steps));
	const activeKcal = sum([...w, ...a].map((x) => x.estimated_kcal_burned));

	// Newest of the two candidates by date, then start/creation time.
	const key = (x: { local_date: string; started_at: string | null; created_at: string }) =>
		`${x.local_date}|${x.started_at ?? x.created_at}`;
	let latest: LatestActivity | null = null;
	if (lw && (!la || key(lw) >= key(la))) {
		latest = {
			kind: 'workout',
			id: lw.id,
			title: lw.title,
			local_date: lw.local_date,
			duration_seconds: lw.duration_seconds,
			sets: lw.sets.length,
			exercises: new Set(lw.sets.map((s) => s.exercise_order)).size
		};
	} else if (la) {
		latest = {
			kind: 'activity',
			id: la.id,
			activity_type: la.activity_type,
			title: la.title,
			local_date: la.local_date,
			duration_seconds: la.duration_seconds,
			distance_meters: la.distance_meters
		};
	}

	return {
		gym_minutes: gymSeconds === null ? null : Math.round(gymSeconds / 60),
		steps,
		active_kcal: activeKcal === null ? null : Math.round(activeKcal),
		latest
	};
}

/** Everything the Today screen needs for `date`. */
export async function getDashboard(
	sb: SupabaseServerClient,
	userId: string,
	date: string
): Promise<Dashboard> {
	const goal = await getActiveGoal(sb, userId, date);
	const [nutrition, meals, activity] = await Promise.all([
		dayNutrition(sb, userId, date, goal),
		listMeals(sb, userId, date),
		dayActivity(sb, userId, date)
	]);

	const summaries: MealSummary[] = MEAL_TYPES.map((type) => {
		const ofType = meals.filter((meal) => meal.meal_type === type);
		if (ofType.length === 0) return { meal_type: type, logged: false };
		return {
			meal_type: type,
			logged: true,
			kcal: Math.round(ofType.reduce((total, meal) => total + meal.totals.kcal, 0)),
			logged_at: ofType[0].logged_at,
			item_names: ofType.flatMap((meal) => meal.items.map((item) => item.name)),
			meal_count: ofType.length,
			has_ai_estimates: ofType.some((meal) => meal.has_ai_estimates)
		};
	});

	return { date, goal, nutrition, meals: summaries, activity };
}
