import { RangeQuery, WorkoutInput } from '#lib/schemas/activity.js';
import { authed, ok, parseBody, parseQuery } from '#lib/server/api.js';
import { assertNotFuture } from '#lib/server/services/measurements.js';
import { getProfile, profileToday } from '#lib/server/services/profile.js';
import { listWorkouts, saveWorkout } from '#lib/server/services/workouts.js';
import type { RequestHandler } from './$types';

/** Strength workouts in `?from=&to=` with exercise and set counts. */
export const GET: RequestHandler = authed(async ({ locals, user, url }) => {
	const range = parseQuery(url, RangeQuery);
	return ok({ workouts: await listWorkouts(locals.supabase, user.id, range) });
});

/** Creates a workout with its exercises and sets in one transaction. */
export const POST: RequestHandler = authed(async ({ locals, user, request }) => {
	const input = await parseBody(request, WorkoutInput);
	assertNotFuture(input.local_date, profileToday(await getProfile(locals.supabase, user.id)));
	return ok({ workout: await saveWorkout(locals.supabase, user.id, input) }, 201);
});
