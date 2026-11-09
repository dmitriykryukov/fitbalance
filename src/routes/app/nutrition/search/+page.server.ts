import { newMealDraft } from '#lib/server/new-meal.js';
import { searchFoods } from '#lib/server/services/foods.js';
import type { PageServerLoad } from './$types';

/** New meal: `?type=breakfast|lunch|dinner|snack&date=YYYY-MM-DD` (both optional). */
export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { profile } = await parent();
	return {
		...newMealDraft(profile, url),
		recentFoods: await searchFoods(locals.supabase, profile.id, { limit: 20 })
	};
};
