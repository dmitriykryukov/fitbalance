import { localTime } from '#lib/dates.js';
import { itemFromSaved, type MealDraft } from '#lib/meal-form.js';
import { routeId } from '#lib/server/api.js';
import { searchFoods } from '#lib/server/services/foods.js';
import { getMeal } from '#lib/server/services/meals.js';
import { profileToday } from '#lib/server/services/profile.js';
import { orNotFound } from '#lib/server/session.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent, params }) => {
	const { profile } = await parent();
	const [meal, recentFoods] = await Promise.all([
		orNotFound(() => getMeal(locals.supabase, profile.id, routeId(params.id))),
		searchFoods(locals.supabase, profile.id, { limit: 20 })
	]);

	const draft: MealDraft = {
		meal_type: meal.meal_type,
		local_date: meal.local_date,
		time: localTime(profile.timezone, new Date(meal.logged_at)),
		notes: meal.notes ?? '',
		input_method: meal.input_method as MealDraft['input_method'],
		ai_description: meal.ai_description,
		items: meal.items.map(itemFromSaved)
	};

	return { mealId: meal.id, draft, recentFoods, today: profileToday(profile) };
};
