import { authed, ok, parseBody, parseQuery } from '#lib/server/api.js';
import { FoodInput, FoodsQuery } from '#lib/schemas/nutrition.js';
import { createFood, searchFoods } from '#lib/server/services/foods.js';
import type { RequestHandler } from './$types';

/** Search My foods; an empty query returns recent and frequent foods. */
export const GET: RequestHandler = authed(async ({ locals, user, url }) => {
	const query = parseQuery(url, FoodsQuery);
	return ok({ foods: await searchFoods(locals.supabase, user.id, query) });
});

export const POST: RequestHandler = authed(async ({ locals, user, request }) => {
	const input = await parseBody(request, FoodInput);
	return ok({ food: await createFood(locals.supabase, user.id, input) }, 201);
});
