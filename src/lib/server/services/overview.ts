import { addDays, ageOn } from '#lib/dates.js';
import type { SupabaseServerClient } from '../supabase.js';
import { getActiveGoal, type Goal } from './goals.js';
import { latestMeasurement, listMeasurements, weeklyWeightChange } from './measurements.js';
import { profileToday, type Profile } from './profile.js';

export type ProfileOverview = {
	profile: Profile;
	goal: Goal | null;
	today: string;
	age: number | null;
	latest_weight_kg: number | null;
	latest_waist_cm: number | null;
	weekly_weight_change_kg: number | null;
};

/** Everything the Profile & goals screen shows, in one round of queries. */
export async function getProfileOverview(
	sb: SupabaseServerClient,
	profile: Profile
): Promise<ProfileOverview> {
	const userId = profile.id;
	const today = profileToday(profile);
	const [goal, recent, weight, waist] = await Promise.all([
		getActiveGoal(sb, userId, today),
		listMeasurements(sb, userId, { from: addDays(today, -60) }),
		latestMeasurement(sb, userId, 'weight_kg'),
		latestMeasurement(sb, userId, 'waist_cm')
	]);

	return {
		profile,
		goal,
		today,
		age: profile.date_of_birth ? ageOn(profile.date_of_birth, today) : null,
		latest_weight_kg: weight?.weight_kg ?? null,
		latest_waist_cm: waist?.waist_cm ?? null,
		weekly_weight_change_kg: weeklyWeightChange(recent)
	};
}
