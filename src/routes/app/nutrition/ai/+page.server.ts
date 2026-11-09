import { newMealDraft } from '#lib/server/new-meal.js';
import { searchFoods } from '#lib/server/services/foods.js';
import type { PageServerLoad } from './$types';

/** Log with AI: `?type=&date=` like the manual add-food page. */
export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { profile } = await parent();
	const { draft, today } = newMealDraft(profile, url);
	return {
		draft: { ...draft, input_method: 'ai' as const },
		today,
		recentFoods: await searchFoods(locals.supabase, profile.id, { limit: 20 })
	};
};
