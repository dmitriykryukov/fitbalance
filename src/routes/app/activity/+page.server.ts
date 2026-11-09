import { summarize, toHistory } from '#lib/activity-summary.js';
import { addDays } from '#lib/dates.js';
import { listActivities } from '#lib/server/services/activities.js';
import { profileToday } from '#lib/server/services/profile.js';
import { listWorkouts } from '#lib/server/services/workouts.js';
import type { PageServerLoad } from './$types';

/** Week = the last 7 days including today; month = the last 30. */
export const load: PageServerLoad = async ({ locals, parent, url, depends }) => {
	depends('app:activity');
	const { profile } = await parent();
	const today = profileToday(profile);
	const range = url.searchParams.get('range') === 'month' ? 'month' : 'week';
	const from = addDays(today, range === 'month' ? -29 : -6);

	const [activities, workouts] = await Promise.all([
		listActivities(locals.supabase, profile.id, { from, to: today }),
		listWorkouts(locals.supabase, profile.id, { from, to: today })
	]);
	const history = toHistory(workouts, activities);
	return { range, today, history, summary: summarize(from, today, history) } as const;
};
