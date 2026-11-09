import { authed, ok } from '#lib/server/api.js';
import { listConversations } from '#lib/server/ai/coach.service.js';
import type { RequestHandler } from './$types';

/** The user's Coach conversations, newest activity first. */
export const GET: RequestHandler = authed(async ({ locals, user }) => {
	return ok({ conversations: await listConversations(locals.supabase, user.id) });
});
