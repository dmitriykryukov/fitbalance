import { toHistory } from '#lib/activity-summary.js';
import { buildStatistics, rangeDates, type StatRange, type Statistics } from '#lib/statistics.js';
import { unwrap } from '../db.js';
import type { SupabaseServerClient } from '../supabase.js';
import { listActivities } from './activities.js';
import { listWorkouts } from './workouts.js';

const BODY_FIELDS = 'local_date, measured_at, weight_kg, waist_cm';

/** Latest measurement with `field` on or before `to` (the "current" value, may predate the range). */
async function latestOnOrBefore(
	sb: SupabaseServerClient,
	userId: string,
	field: 'weight_kg' | 'waist_cm',
	to: string
) {
	return unwrap(
		await sb
			.from('body_measurements')
			.select(BODY_FIELDS)
			.eq('user_id', userId)
			.lte('local_date', to)
			.not(field, 'is', null)
			.order('local_date', { ascending: false })
			.order('measured_at', { ascending: false })
			.limit(1)
			.maybeSingle()
	);
}

/**
 * Statistics for the `range` days ending on `end` (inclusive), built only
 * from the user's stored records. Days without logs stay null.
 */
export async function getStatistics(
	sb: SupabaseServerClient,
	userId: string,
	range: StatRange,
	end: string
): Promise<Statistics> {
	const { from, to } = rangeDates(range, end);
	const [nutrition, goals, activities, workouts, body, weight, waist] = await Promise.all([
		sb
			.from('daily_nutrition')
			.select('local_date, kcal, protein_g, carbs_g, fat_g')
			.eq('user_id', userId)
			.gte('local_date', from)
			.lte('local_date', to),
		sb
			.from('user_goals')
			.select(
				'effective_from, calories_kcal, protein_g, carbs_g, fat_g, target_weight_kg, target_waist_cm'
			)
			.eq('user_id', userId)
			.lte('effective_from', to)
			.order('effective_from', { ascending: false })
			.limit(500),
		listActivities(sb, userId, { from, to }),
		listWorkouts(sb, userId, { from, to }),
		sb
			.from('body_measurements')
			.select(BODY_FIELDS)
			.eq('user_id', userId)
			.gte('local_date', from)
			.lte('local_date', to)
			.limit(1000),
		latestOnOrBefore(sb, userId, 'weight_kg', to),
		latestOnOrBefore(sb, userId, 'waist_cm', to)
	]);

	const nutritionRows = (unwrap(nutrition) ?? []).filter(
		(r): r is typeof r & { local_date: string } => r.local_date !== null
	);
	const bodyRows = [...(unwrap(body) ?? []), ...[weight, waist].filter((r) => r !== null)];

	return buildStatistics({
		range,
		end: to,
		nutrition: nutritionRows,
		goals: unwrap(goals) ?? [],
		history: toHistory(workouts, activities),
		body: bodyRows
	});
}
