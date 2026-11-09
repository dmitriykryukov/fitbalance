import { STAT_RANGES, type StatRange } from '#lib/statistics.js';
import { profileToday } from '#lib/server/services/profile.js';
import { getStatistics } from '#lib/server/services/statistics.js';
import type { PageServerLoad } from './$types';

/** `?range=7d|30d|90d` (default 7d), always ending today in the profile time zone. */
export const load: PageServerLoad = async ({ locals, parent, url, depends }) => {
	depends('app:statistics');
	const { profile } = await parent();
	const param = url.searchParams.get('range');
	const range: StatRange = STAT_RANGES.includes(param as StatRange) ? (param as StatRange) : '7d';
	return { stats: await getStatistics(locals.supabase, profile.id, range, profileToday(profile)) };
};
