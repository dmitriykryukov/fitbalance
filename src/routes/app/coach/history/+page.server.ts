import { listConversations } from '#lib/server/ai/coach.service.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { profile } = await parent();
	return { conversations: await listConversations(locals.supabase, profile.id) };
};
