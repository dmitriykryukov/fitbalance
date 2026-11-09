import { DailyInsightQuery } from '#lib/schemas/coach.js';
import { authed, ok, parseQuery } from '#lib/server/api.js';
import { getDailyInsight } from '#lib/server/ai/daily-insight.service.js';
import { assertNotFuture } from '#lib/server/services/measurements.js';
import { getProfile, profileToday } from '#lib/server/services/profile.js';
import type { RequestHandler } from './$types';

/**
 * Today's insight, generated on the first request of the day and then reused.
 * `insight` is null (with a `reason`) when there is none; the card is hidden.
 */
export const GET: RequestHandler = authed(async ({ locals, user, url }) => {
	const query = parseQuery(url, DailyInsightQuery);
	const profile = await getProfile(locals.supabase, user.id);
	const today = profileToday(profile);
	assertNotFuture(query.date, today);
	return ok(await getDailyInsight(locals.supabase, user.id, profile, today, query.date ?? today));
});
