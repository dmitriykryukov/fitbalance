import { WorkoutInput } from '#lib/schemas/activity.js';
import { authed, noContent, ok, parseBody, routeId } from '#lib/server/api.js';
import { assertNotFuture } from '#lib/server/services/measurements.js';
import { getProfile, profileToday } from '#lib/server/services/profile.js';
import { deleteWorkout, getWorkout, saveWorkout } from '#lib/server/services/workouts.js';
import type { RequestHandler } from './$types';

type Event = Parameters<RequestHandler>[0];

export const GET: RequestHandler = authed<Event>(async ({ locals, user, params }) => {
	return ok({ workout: await getWorkout(locals.supabase, user.id, routeId(params.id)) });
});

/** Replaces the workout's fields and all of its sets in one transaction. */
export const PUT: RequestHandler = authed<Event>(async ({ locals, user, request, params }) => {
	const id = routeId(params.id);
	const input = await parseBody(request, WorkoutInput);
	assertNotFuture(input.local_date, profileToday(await getProfile(locals.supabase, user.id)));
	return ok({ workout: await saveWorkout(locals.supabase, user.id, input, id) });
});

export const DELETE: RequestHandler = authed<Event>(async ({ locals, user, params }) => {
	await deleteWorkout(locals.supabase, user.id, routeId(params.id));
	return noContent();
});
