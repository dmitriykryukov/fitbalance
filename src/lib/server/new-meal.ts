import { localHour, localTime, MIN_LOCAL_DATE } from '#lib/dates.js';
import type { MealDraft } from '#lib/meal-form.js';
import { MEAL_TYPES, mealTypeForHour, type MealType } from '#lib/nutrition.js';
import { profileToday, type Profile } from './services/profile.js';

/**
 * An empty meal for `?type=breakfast|lunch|dinner|snack&date=YYYY-MM-DD`
 * (both optional). Future, invalid or pre-2000 dates fall back to today;
 * the type defaults to the time of day. Today's meals get the current time,
 * earlier days 12:00.
 */
export function newMealDraft(profile: Profile, url: URL): { draft: MealDraft; today: string } {
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

	return {
		today,
		draft: {
			meal_type: type,
			local_date: date,
			time: date === today ? localTime(profile.timezone) : '12:00',
			notes: '',
			input_method: 'manual',
			ai_description: null,
			items: []
		}
	};
}
