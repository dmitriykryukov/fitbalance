import { authed, ok, parseQuery } from '#lib/server/api.js';
import { DateQuery } from '#lib/schemas/nutrition.js';
import { getDashboard } from '#lib/server/services/dashboard.js';
import { getProfile, profileToday } from '#lib/server/services/profile.js';
import type { RequestHandler } from './$types';

/** Everything the Today screen needs for `?date=` (default: the user's today). */
export const GET: RequestHandler = authed(async ({ locals, user, url }) => {
	const { date } = parseQuery(url, DateQuery);
	const day = date ?? profileToday(await getProfile(locals.supabase, user.id));
	return ok(await getDashboard(locals.supabase, user.id, day));
});
