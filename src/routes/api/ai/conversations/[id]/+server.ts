import { authed, noContent, ok, routeId } from '#lib/server/api.js';
import { deleteConversation, getConversation } from '#lib/server/ai/coach.service.js';
import type { RequestHandler } from './$types';

type Event = Parameters<RequestHandler>[0];

export const GET: RequestHandler = authed<Event>(async ({ locals, user, params }) => {
	return ok({ conversation: await getConversation(locals.supabase, user.id, routeId(params.id)) });
});

/** Deletes the conversation and its messages. */
export const DELETE: RequestHandler = authed<Event>(async ({ locals, user, params }) => {
	await deleteConversation(locals.supabase, user.id, routeId(params.id));
	return noContent();
});
