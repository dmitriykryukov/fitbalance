import { getActiveGoal } from '#lib/server/services/goals.js';
import { profileToday } from '#lib/server/services/profile.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { profile } = await parent();
	const today = profileToday(profile);
	return { goal: await getActiveGoal(locals.supabase, profile.id, today), today };
};
