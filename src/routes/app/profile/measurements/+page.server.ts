import { listMeasurements } from '#lib/server/services/measurements.js';
import { profileToday } from '#lib/server/services/profile.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent, depends }) => {
	depends('app:measurements');
	const { profile } = await parent();
	return {
		today: profileToday(profile),
		measurements: await listMeasurements(locals.supabase, profile.id)
	};
};
