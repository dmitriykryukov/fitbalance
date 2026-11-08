import { authed, noContent, ok, parseBody, routeId } from '#lib/server/api.js';
import { FoodPatch } from '#lib/schemas/nutrition.js';
import { deleteFood, updateFood } from '#lib/server/services/foods.js';
import type { RequestHandler } from './$types';

type Event = Parameters<RequestHandler>[0];

/** Past meals keep their own nutrition snapshot. */
export const PATCH: RequestHandler = authed<Event>(async ({ locals, user, request, params }) => {
	const id = routeId(params.id);
	const patch = await parseBody(request, FoodPatch);
	return ok({ food: await updateFood(locals.supabase, user.id, id, patch) });
});

export const DELETE: RequestHandler = authed<Event>(async ({ locals, user, params }) => {
	await deleteFood(locals.supabase, user.id, routeId(params.id));
	return noContent();
});
