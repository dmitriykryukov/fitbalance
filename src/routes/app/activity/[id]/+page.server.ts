import { cardioDraftFromSaved } from '#lib/activity-form.js';
import { routeId } from '#lib/server/api.js';
import { getActivity, latestWeightKg } from '#lib/server/services/activities.js';
import { profileToday } from '#lib/server/services/profile.js';
import { orNotFound } from '#lib/server/session.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent, params }) => {
	const { profile } = await parent();
	const [activity, weightKg] = await Promise.all([
		orNotFound(() => getActivity(locals.supabase, profile.id, routeId(params.id))),
		latestWeightKg(locals.supabase, profile.id)
	]);
	return {
		activityId: activity.id,
		draft: cardioDraftFromSaved(activity, profile.timezone),
		weightKg,
		today: profileToday(profile)
	};
};
