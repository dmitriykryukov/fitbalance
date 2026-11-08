import { latestMeasurement } from '#lib/server/services/measurements.js';
import { profileToday } from '#lib/server/services/profile.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { profile } = await parent();
	const weight = await latestMeasurement(locals.supabase, profile.id, 'weight_kg');
	return { today: profileToday(profile), latestWeightKg: weight?.weight_kg ?? null };
};
