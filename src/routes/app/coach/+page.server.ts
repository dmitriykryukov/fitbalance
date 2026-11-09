import { redirect } from '@sveltejs/kit';
import { coachSummary } from '#lib/coach.js';
import { ApiError } from '#lib/server/api.js';
import { buildInsightContext, loadCoachRaw } from '#lib/server/ai/coach-context.js';
import { getConversation, listConversations } from '#lib/server/ai/coach.service.js';
import { getDailyInsight } from '#lib/server/ai/daily-insight.service.js';
import { profileToday } from '#lib/server/services/profile.js';
import type { PageServerLoad } from './$types';

/**
 * `?c=<id>` opens a conversation, `?new` starts an empty one; otherwise the
 * most recent conversation is shown. The daily insight is streamed: the page
 * renders at once and the card appears when it is ready (or never).
 */
export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { profile } = await parent();
	const sb = locals.supabase;
	const today = profileToday(profile);
	const id = url.searchParams.get('c');

	const rawPromise = loadCoachRaw(sb, profile.id, profile, today);
	let conversation = null;
	if (id) {
		try {
			conversation = await getConversation(sb, profile.id, id);
		} catch (error) {
			if (error instanceof ApiError && error.code === 'NOT_FOUND') redirect(303, '/app/coach?new');
			// A malformed id is not a UUID: Postgres rejects it as invalid input.
			if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
				redirect(303, '/app/coach?new');
			}
			throw error;
		}
	} else if (!url.searchParams.has('new')) {
		const [latest] = await listConversations(sb, profile.id, 1);
		if (latest) conversation = await getConversation(sb, profile.id, latest.id);
	}

	const raw = await rawPromise;
	return {
		conversation,
		...coachSummary(buildInsightContext(raw)),
		insight: getDailyInsight(sb, profile.id, profile, today, today, raw)
			.then((r) => r.insight)
			.catch((error: unknown) => {
				console.error('[ai] daily insight', error);
				return null;
			})
	};
};
