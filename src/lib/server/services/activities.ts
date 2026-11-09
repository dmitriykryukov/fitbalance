import { estimateActiveKcal, paceSecondsPerKm, type LogType } from '#lib/activity.js';
import type { ActivityInput, ActivityPatch } from '#lib/schemas/activity.js';
import type { Tables, TablesInsert } from '#lib/types/database.js';
import { unwrap, unwrapFound } from '../db.js';
import type { SupabaseServerClient } from '../supabase.js';
import { latestMeasurement } from './measurements.js';

type ActivityRow = Tables<'activities'>;

export type Activity = ActivityRow & {
	/** Seconds per km when a distance is logged (computed here; speed is a database column). */
	pace_seconds_per_km: number | null;
};

export type ActiveKcal = {
	estimated_kcal_burned: number | null;
	kcal_source: 'estimated' | 'user' | null;
};

export function withPace(row: ActivityRow): Activity {
	return {
		...row,
		pace_seconds_per_km: paceSecondsPerKm(row.distance_meters, row.duration_seconds)
	};
}

/** The latest recorded body weight, or null (no estimate is made without one). */
export async function latestWeightKg(sb: SupabaseServerClient, userId: string) {
	return (await latestMeasurement(sb, userId, 'weight_kg'))?.weight_kg ?? null;
}

/**
 * Active kcal for a save: a number from the user is kept as `user`;
 * otherwise MET × latest weight × hours as `estimated`, or nothing when no
 * weight (or duration) is known. Both columns are set together.
 */
export function activeKcalFor(
	userValue: number | null,
	estimate: { type: LogType; durationSeconds: number | null; distanceMeters?: number | null },
	weightKg: number | null
): ActiveKcal {
	if (userValue !== null) return { estimated_kcal_burned: userValue, kcal_source: 'user' };
	const kcal = estimateActiveKcal({ ...estimate, weightKg });
	return kcal === null
		? { estimated_kcal_burned: null, kcal_source: null }
		: { estimated_kcal_burned: kcal, kcal_source: 'estimated' };
}

export async function listActivities(
	sb: SupabaseServerClient,
	userId: string,
	range: { from: string; to: string }
): Promise<Activity[]> {
	const rows = unwrap(
		await sb
			.from('activities')
			.select('*')
			.eq('user_id', userId)
			.gte('local_date', range.from)
			.lte('local_date', range.to)
			.order('local_date', { ascending: false })
			.order('started_at', { ascending: false, nullsFirst: false })
			.limit(1000)
	);
	return (rows ?? []).map(withPace);
}

export async function getActivity(
	sb: SupabaseServerClient,
	userId: string,
	id: string
): Promise<Activity> {
	return withPace(
		unwrapFound(
			await sb.from('activities').select('*').eq('id', id).eq('user_id', userId).maybeSingle()
		)
	);
}

export async function createActivity(
	sb: SupabaseServerClient,
	userId: string,
	input: ActivityInput
): Promise<Activity> {
	const { active_kcal, ...fields } = input;
	const kcal = activeKcalFor(
		active_kcal,
		{
			type: input.activity_type,
			durationSeconds: input.duration_seconds,
			distanceMeters: input.distance_meters
		},
		await latestWeightKg(sb, userId)
	);
	const row: TablesInsert<'activities'> = { ...fields, ...kcal, user_id: userId };
	return withPace(unwrapFound(await sb.from('activities').insert(row).select('*').maybeSingle()));
}

/**
 * Applies a partial update. Active kcal: a number is the user's; `null`
 * asks for a fresh estimate; omitted keeps a user-entered value and
 * re-estimates an estimated one from the updated type, duration and distance.
 */
export async function updateActivity(
	sb: SupabaseServerClient,
	userId: string,
	id: string,
	patch: ActivityPatch
): Promise<Activity> {
	const current = await getActivity(sb, userId, id);
	const { active_kcal, ...fields } = patch;
	const next = { ...current, ...fields };

	let kcal: ActiveKcal;
	if (active_kcal === undefined && current.kcal_source === 'user') {
		kcal = { estimated_kcal_burned: current.estimated_kcal_burned, kcal_source: 'user' };
	} else {
		kcal = activeKcalFor(
			active_kcal ?? null,
			{
				type: next.activity_type as LogType,
				durationSeconds: next.duration_seconds,
				distanceMeters: next.distance_meters
			},
			await latestWeightKg(sb, userId)
		);
	}

	return withPace(
		unwrapFound(
			await sb
				.from('activities')
				.update({ ...fields, ...kcal })
				.eq('id', id)
				.eq('user_id', userId)
				.select('*')
				.maybeSingle()
		)
	);
}

export async function deleteActivity(sb: SupabaseServerClient, userId: string, id: string) {
	unwrapFound(
		await sb
			.from('activities')
			.delete()
			.eq('id', id)
			.eq('user_id', userId)
			.select('id')
			.maybeSingle()
	);
}
