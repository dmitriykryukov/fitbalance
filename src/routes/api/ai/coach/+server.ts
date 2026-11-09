import { CoachRequest } from '#lib/schemas/coach.js';
import { authed, ok, parseBody } from '#lib/server/api.js';
import { sendCoachMessage } from '#lib/server/ai/coach.service.js';
import { getProfile, profileToday } from '#lib/server/services/profile.js';
import type { RequestHandler } from './$types';

/** Sends a Coach message; stores the question and the reply only if the AI call succeeds. */
export const POST: RequestHandler = authed(async ({ locals, user, request }) => {
	const input = await parseBody(request, CoachRequest);
	const profile = await getProfile(locals.supabase, user.id);
	return ok(
		await sendCoachMessage(locals.supabase, user.id, input, profile, profileToday(profile))
	);
});
