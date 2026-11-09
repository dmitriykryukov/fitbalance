import { localHour } from '#lib/dates.js';
import { getDailyInsight } from '#lib/server/ai/daily-insight.service.js';
import { getDashboard } from '#lib/server/services/dashboard.js';
import { profileToday } from '#lib/server/services/profile.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent, depends }) => {
	depends('app:nutrition');
	const { profile } = await parent();
	const today = profileToday(profile);
	return {
		dashboard: await getDashboard(locals.supabase, profile.id, today),
		hour: localHour(profile.timezone),
		// Streamed: the page renders at once; the card appears when ready (or never).
		insight: getDailyInsight(locals.supabase, profile.id, profile, today)
			.then((r) => r.insight)
			.catch((error: unknown) => {
				console.error('[ai] daily insight', error);
				return null;
			})
	};
};
