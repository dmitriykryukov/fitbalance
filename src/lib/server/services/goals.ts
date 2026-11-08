import { ageOn } from '#lib/dates.js';
import { suggestTargets, type FitnessGoal, type Suggestion } from '#lib/goals.js';
import type { GoalsInput } from '#lib/schemas/profile.js';
import type { Tables } from '#lib/types/database.js';
import { unwrap, unwrapFound } from '../db.js';
import type { SupabaseServerClient } from '../supabase.js';
import { latestMeasurement } from './measurements.js';
import { getProfile, profileToday } from './profile.js';

export type Goal = Tables<'user_goals'>;

/** Goal version active on `date`: the latest one with `effective_from ≤ date`. */
export async function getActiveGoal(
	sb: SupabaseServerClient,
	userId: string,
	date: string
): Promise<Goal | null> {
	return unwrap(
		await sb
			.from('user_goals')
			.select('*')
			.eq('user_id', userId)
			.lte('effective_from', date)
			.order('effective_from', { ascending: false })
			.limit(1)
			.maybeSingle()
	);
}

/**
 * Saves goals as the version effective from `today`. Saving twice on the same
 * day replaces that day's version; earlier days keep their targets.
 */
export async function saveGoals(
	sb: SupabaseServerClient,
	userId: string,
	today: string,
	input: GoalsInput
): Promise<Goal> {
	return unwrapFound(
		await sb
			.from('user_goals')
			.upsert(
				{ ...input, user_id: userId, effective_from: today },
				{ onConflict: 'user_id,effective_from' }
			)
			.select('*')
			.maybeSingle()
	);
}

export type SuggestionResult =
	| { suggestion: Suggestion; fitness_goal: FitnessGoal; estimate: true; missing: [] }
	| { suggestion: null; fitness_goal: FitnessGoal; estimate: true; missing: string[] };

/** Suggested targets from profile + latest weight. Lists what is missing instead of guessing. */
export async function getSuggestion(
	sb: SupabaseServerClient,
	userId: string,
	options: { fitness_goal?: FitnessGoal; weekly_activity_minutes?: number } = {}
): Promise<SuggestionResult> {
	const profile = await getProfile(sb, userId);
	const today = profileToday(profile);
	const [goal, weight] = await Promise.all([
		getActiveGoal(sb, userId, today),
		latestMeasurement(sb, userId, 'weight_kg')
	]);

	const fitnessGoal = options.fitness_goal ?? (goal?.fitness_goal as FitnessGoal) ?? 'maintain';
	const weeklyMinutes = options.weekly_activity_minutes ?? goal?.weekly_activity_minutes ?? null;

	const missing: string[] = [];
	if (!profile.date_of_birth) missing.push('date_of_birth');
	if (profile.height_cm === null) missing.push('height_cm');
	if (!weight?.weight_kg) missing.push('weight_kg');
	if (missing.length > 0 || !profile.date_of_birth || profile.height_cm === null || !weight) {
		return { suggestion: null, fitness_goal: fitnessGoal, estimate: true, missing };
	}

	return {
		suggestion: suggestTargets({
			sex: (profile.sex as 'female' | 'male' | null) ?? null,
			ageYears: ageOn(profile.date_of_birth, today),
			heightCm: profile.height_cm,
			weightKg: weight.weight_kg!,
			fitnessGoal,
			weeklyActivityMinutes: weeklyMinutes
		}),
		fitness_goal: fitnessGoal,
		estimate: true,
		missing: []
	};
}
