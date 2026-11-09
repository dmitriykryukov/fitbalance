import { FoodParseRequest } from '#lib/schemas/food-parse.js';
import { authed, ok, parseBody } from '#lib/server/api.js';
import { parseFoodDescription } from '#lib/server/ai/food-parser.service.js';
import { getProfile } from '#lib/server/services/profile.js';
import type { RequestHandler } from './$types';

/** Parses a meal description into editable estimates. Saves nothing. */
export const POST: RequestHandler = authed(async ({ locals, user, request }) => {
	const input = await parseBody(request, FoodParseRequest);
	const profile = await getProfile(locals.supabase, user.id);
	const locale = profile.locale === 'ru' ? 'ru' : 'en';
	return ok(await parseFoodDescription(locals.supabase, user.id, input, locale));
});
