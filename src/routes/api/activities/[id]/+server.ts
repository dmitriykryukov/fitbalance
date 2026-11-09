import { ActivityPatch } from '#lib/schemas/activity.js';
import { authed, noContent, ok, parseBody, routeId } from '#lib/server/api.js';
import { deleteActivity, getActivity, updateActivity } from '#lib/server/services/activities.js';
import { assertNotFuture } from '#lib/server/services/measurements.js';
import { getProfile, profileToday } from '#lib/server/services/profile.js';
import type { RequestHandler } from './$types';

type Event = Parameters<RequestHandler>[0];

export const GET: RequestHandler = authed<Event>(async ({ locals, user, params }) => {
	return ok({ activity: await getActivity(locals.supabase, user.id, routeId(params.id)) });
});

export const PATCH: RequestHandler = authed<Event>(async ({ locals, user, request, params }) => {
	const id = routeId(params.id);
	const patch = await parseBody(request, ActivityPatch);
	if (patch.local_date) {
		assertNotFuture(patch.local_date, profileToday(await getProfile(locals.supabase, user.id)));
	}
	return ok({ activity: await updateActivity(locals.supabase, user.id, id, patch) });
});

export const DELETE: RequestHandler = authed<Event>(async ({ locals, user, params }) => {
	await deleteActivity(locals.supabase, user.id, routeId(params.id));
	return noContent();
});
