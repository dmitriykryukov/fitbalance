import { ActivityInput, RangeQuery } from '#lib/schemas/activity.js';
import { authed, ok, parseBody, parseQuery } from '#lib/server/api.js';
import { createActivity, listActivities } from '#lib/server/services/activities.js';
import { assertNotFuture } from '#lib/server/services/measurements.js';
import { getProfile, profileToday } from '#lib/server/services/profile.js';
import type { RequestHandler } from './$types';

/** Walking, running, cycling and other activities in `?from=&to=` (at most 366 days). */
export const GET: RequestHandler = authed(async ({ locals, user, url }) => {
	const range = parseQuery(url, RangeQuery);
	return ok({ activities: await listActivities(locals.supabase, user.id, range) });
});

/** `active_kcal: null` lets the server estimate it (MET × latest weight × hours). */
export const POST: RequestHandler = authed(async ({ locals, user, request }) => {
	const input = await parseBody(request, ActivityInput);
	assertNotFuture(input.local_date, profileToday(await getProfile(locals.supabase, user.id)));
	return ok({ activity: await createActivity(locals.supabase, user.id, input) }, 201);
});
