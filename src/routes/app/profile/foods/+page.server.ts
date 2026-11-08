import { searchFoods } from '#lib/server/services/foods.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent, depends }) => {
	depends('app:foods');
	const { profile } = await parent();
	return { foods: await searchFoods(locals.supabase, profile.id, { limit: 50 }) };
};
