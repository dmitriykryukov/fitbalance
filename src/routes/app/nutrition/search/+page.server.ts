import { localHour, localTime, MIN_LOCAL_DATE } from '#lib/dates.js';
import { MEAL_TYPES, mealTypeForHour, type MealType } from '#lib/nutrition.js';
import { searchFoods } from '#lib/server/services/foods.js';
import { profileToday } from '#lib/server/services/profile.js';
import type { MealDraft } from '#lib/meal-form.js';
import type { PageServerLoad } from './$types';

/** New meal: `?type=breakfast|lunch|dinner|snack&date=YYYY-MM-DD` (both optional). */
export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { profile } = await parent();
	const today = profileToday(profile);

	const dateParam = url.searchParams.get('date') ?? '';
	const date =
		/^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam <= today && dateParam >= MIN_LOCAL_DATE
			? dateParam
			: today;
	const typeParam = url.searchParams.get('type') as MealType | null;
	const type =
		typeParam && MEAL_TYPES.includes(typeParam)
			? typeParam
			: mealTypeForHour(localHour(profile.timezone));

	const draft: MealDraft = {
		meal_type: type,
		local_date: date,
		time: date === today ? localTime(profile.timezone) : '12:00',
		notes: '',
		input_method: 'manual',
		ai_description: null,
		items: []
	};

	return {
		draft,
		today,
		recentFoods: await searchFoods(locals.supabase, profile.id, { limit: 20 })
	};
};
