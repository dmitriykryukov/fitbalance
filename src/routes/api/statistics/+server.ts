import { StatisticsQuery } from '#lib/schemas/activity.js';
import { authed, ok, parseQuery } from '#lib/server/api.js';
import { assertNotFuture } from '#lib/server/services/measurements.js';
import { getProfile, profileToday } from '#lib/server/services/profile.js';
import { getStatistics } from '#lib/server/services/statistics.js';
import type { RequestHandler } from './$types';

/** Nutrition, activity and body statistics for the 7/30/90 days ending on `end`. */
export const GET: RequestHandler = authed(async ({ locals, user, url }) => {
	const { range, end } = parseQuery(url, StatisticsQuery);
	const today = profileToday(await getProfile(locals.supabase, user.id));
	assertNotFuture(end, today);
	return ok(await getStatistics(locals.supabase, user.id, range, end ?? today));
});
