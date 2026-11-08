import { authed, ok, parseBody, parseQuery } from '#lib/server/api.js';
import { DateQuery, MealInput } from '#lib/schemas/nutrition.js';
import { listMeals, saveMeal } from '#lib/server/services/meals.js';
import { assertNotFuture } from '#lib/server/services/measurements.js';
import { getProfile, profileToday } from '#lib/server/services/profile.js';
import type { RequestHandler } from './$types';

/** Meals with items for `?date=` (default: the user's today). */
export const GET: RequestHandler = authed(async ({ locals, user, url }) => {
	const { date } = parseQuery(url, DateQuery);
	const day = date ?? profileToday(await getProfile(locals.supabase, user.id));
	return ok({ date: day, meals: await listMeals(locals.supabase, user.id, day) });
});

/** Creates a meal and its items in one transaction; totals come from the database. */
export const POST: RequestHandler = authed(async ({ locals, user, request }) => {
	const input = await parseBody(request, MealInput);
	assertNotFuture(input.local_date, profileToday(await getProfile(locals.supabase, user.id)));
	return ok({ meal: await saveMeal(locals.supabase, user.id, input) }, 201);
});
