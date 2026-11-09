import { strengthDraftFromSaved } from '#lib/activity-form.js';
import { routeId } from '#lib/server/api.js';
import { latestWeightKg } from '#lib/server/services/activities.js';
import { profileToday } from '#lib/server/services/profile.js';
import { getWorkout } from '#lib/server/services/workouts.js';
import { orNotFound } from '#lib/server/session.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent, params }) => {
	const { profile } = await parent();
	const [workout, weightKg] = await Promise.all([
		orNotFound(() => getWorkout(locals.supabase, profile.id, routeId(params.id))),
		latestWeightKg(locals.supabase, profile.id)
	]);
	return {
		workoutId: workout.id,
		draft: strengthDraftFromSaved(workout, profile.timezone),
		weightKg,
		today: profileToday(profile)
	};
};
