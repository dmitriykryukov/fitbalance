import { authed, ok, parseQuery } from '#lib/server/api.js';
import { SuggestionQuery } from '#lib/schemas/profile.js';
import { getSuggestion } from '#lib/server/services/goals.js';
import type { RequestHandler } from './$types';

/** Mifflin–St Jeor estimate; `missing` lists profile fields needed first. */
export const GET: RequestHandler = authed(async ({ locals, user, url }) => {
	const options = parseQuery(url, SuggestionQuery);
	return ok(await getSuggestion(locals.supabase, user.id, options));
});
