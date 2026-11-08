import { redirect } from '@sveltejs/kit';
import { MIN_LOCAL_DATE } from '#lib/dates.js';
import { dayNutrition } from '#lib/server/services/dashboard.js';
import { getActiveGoal } from '#lib/server/services/goals.js';
import { listMeals } from '#lib/server/services/meals.js';
import { profileToday } from '#lib/server/services/profile.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent, url, depends }) => {
	depends('app:nutrition');
	const { profile } = await parent();
	const today = profileToday(profile);

	const requested = url.searchParams.get('date');
	if (requested !== null) {
		const valid = /^\d{4}-\d{2}-\d{2}$/.test(requested) && !Number.isNaN(Date.parse(requested));
		// Bad, future or very old dates fall back to today.
		if (!valid || requested > today || requested < MIN_LOCAL_DATE) {
			redirect(307, url.pathname);
		}
	}
	const date = requested ?? today;

	const goal = await getActiveGoal(locals.supabase, profile.id, date);
	const [nutrition, meals] = await Promise.all([
		dayNutrition(locals.supabase, profile.id, date, goal),
		listMeals(locals.supabase, profile.id, date)
	]);
	return { date, today, goal, nutrition, meals };
};
