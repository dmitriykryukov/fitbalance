import { authed, noContent, ok, parseBody, routeId } from '#lib/server/api.js';
import { MealInput } from '#lib/schemas/nutrition.js';
import { deleteMeal, getMeal, saveMeal } from '#lib/server/services/meals.js';
import { assertNotFuture } from '#lib/server/services/measurements.js';
import { getProfile, profileToday } from '#lib/server/services/profile.js';
import type { RequestHandler } from './$types';

type Event = Parameters<RequestHandler>[0];

export const GET: RequestHandler = authed<Event>(async ({ locals, user, params }) => {
	return ok({ meal: await getMeal(locals.supabase, user.id, routeId(params.id)) });
});

/** Replaces the meal's fields and all of its items in one transaction. */
export const PUT: RequestHandler = authed<Event>(async ({ locals, user, request, params }) => {
	const id = routeId(params.id);
	const input = await parseBody(request, MealInput);
	assertNotFuture(input.local_date, profileToday(await getProfile(locals.supabase, user.id)));
	return ok({ meal: await saveMeal(locals.supabase, user.id, input, id) });
});

export const DELETE: RequestHandler = authed<Event>(async ({ locals, user, params }) => {
	await deleteMeal(locals.supabase, user.id, routeId(params.id));
	return noContent();
});
