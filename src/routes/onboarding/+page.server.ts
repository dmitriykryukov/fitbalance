import { redirect } from '@sveltejs/kit';
import { latestMeasurement } from '#lib/server/services/measurements.js';
import { profileToday } from '#lib/server/services/profile.js';
import { requireProfile } from '#lib/server/session.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const profile = await requireProfile({ locals });
	if (profile.onboarded_at) redirect(303, '/app');

	const weight = await latestMeasurement(locals.supabase, profile.id, 'weight_kg');
	return { profile, today: profileToday(profile), latestWeightKg: weight?.weight_kg ?? null };
};
