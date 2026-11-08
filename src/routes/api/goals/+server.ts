import { authed, ok, parseBody, parseQuery } from '#lib/server/api.js';
import { GoalsInput, GoalsQuery } from '#lib/schemas/profile.js';
import { getActiveGoal, saveGoals } from '#lib/server/services/goals.js';
import { getProfile, profileToday } from '#lib/server/services/profile.js';
import type { RequestHandler } from './$types';

/** Goal active on `?date=` (default: the user's today). */
export const GET: RequestHandler = authed(async ({ locals, user, url }) => {
	const query = parseQuery(url, GoalsQuery);
	const date = query.date ?? profileToday(await getProfile(locals.supabase, user.id));
	return ok({ goal: await getActiveGoal(locals.supabase, user.id, date), date });
});

/** Replaces the goal version effective from the user's today. */
export const PUT: RequestHandler = authed(async ({ locals, user, request }) => {
	const input = await parseBody(request, GoalsInput);
	const today = profileToday(await getProfile(locals.supabase, user.id));
	return ok({ goal: await saveGoals(locals.supabase, user.id, today, input) });
});
