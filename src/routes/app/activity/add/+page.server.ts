import { LOG_TYPES, type LogType } from '#lib/activity.js';
import { localTime, MIN_LOCAL_DATE } from '#lib/dates.js';
import { latestWeightKg } from '#lib/server/services/activities.js';
import { profileToday } from '#lib/server/services/profile.js';
import type { PageServerLoad } from './$types';

/** `?type=strength|running|walking|cycling|other&date=YYYY-MM-DD` (both optional). */
export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { profile } = await parent();
	const today = profileToday(profile);

	const typeParam = url.searchParams.get('type');
	const type: LogType = LOG_TYPES.includes(typeParam as LogType)
		? (typeParam as LogType)
		: 'strength';

	const dateParam = url.searchParams.get('date');
	const date =
		dateParam &&
		/^\d{4}-\d{2}-\d{2}$/.test(dateParam) &&
		!Number.isNaN(Date.parse(dateParam)) &&
		dateParam <= today &&
		dateParam >= MIN_LOCAL_DATE
			? dateParam
			: today;

	return {
		type,
		date,
		today,
		time: date === today ? localTime(profile.timezone) : '',
		weightKg: await latestWeightKg(locals.supabase, profile.id)
	};
};
