import { ExercisesQuery } from '#lib/schemas/activity.js';
import { authed, ok, parseQuery } from '#lib/server/api.js';
import { suggestExercises } from '#lib/server/services/exercises.js';
import { getProfile } from '#lib/server/services/profile.js';
import type { RequestHandler } from './$types';

/** The user's exercises, then built-in suggestions in the profile language. */
export const GET: RequestHandler = authed(async ({ locals, user, url }) => {
	const { query } = parseQuery(url, ExercisesQuery);
	const profile = await getProfile(locals.supabase, user.id);
	const locale = profile.locale === 'ru' ? 'ru' : 'en';
	return ok({ exercises: await suggestExercises(locals.supabase, user.id, locale, query) });
});
