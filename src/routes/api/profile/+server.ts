import { authed, ok, parseBody } from '#lib/server/api.js';
import { ProfilePatch } from '#lib/schemas/profile.js';
import { getActiveGoal } from '#lib/server/services/goals.js';
import { getProfile, profileToday, updateProfile } from '#lib/server/services/profile.js';
import type { RequestHandler } from './$types';

/** Profile plus the goal active on the user's today. */
export const GET: RequestHandler = authed(async ({ locals, user }) => {
	const profile = await getProfile(locals.supabase, user.id);
	const today = profileToday(profile);
	const goal = await getActiveGoal(locals.supabase, user.id, today);
	return ok({ profile, goal, today });
});

export const PATCH: RequestHandler = authed(async ({ locals, user, request }) => {
	const patch = await parseBody(request, ProfilePatch);
	return ok({ profile: await updateProfile(locals.supabase, user.id, patch) });
});
