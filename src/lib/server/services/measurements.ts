import { addDays, daysBetween } from '#lib/dates.js';
import { m } from '#lib/paraglide/messages.js';
import type { MeasurementCreate, MeasurementPatch } from '#lib/schemas/profile.js';
import type { Tables } from '#lib/types/database.js';
import { ApiError } from '../api.js';
import { unwrap, unwrapFound } from '../db.js';
import type { SupabaseServerClient } from '../supabase.js';

export type Measurement = Tables<'body_measurements'>;

/** Rejects diary dates more than one day after the user's today. */
export function assertNotFuture(localDate: string | undefined, today: string) {
	if (localDate && localDate > addDays(today, 1)) {
		throw new ApiError('VALIDATION_ERROR', m.error_validation(), {
			local_date: 'Date is in the future'
		});
	}
}

export async function listMeasurements(
	sb: SupabaseServerClient,
	userId: string,
	range: { from?: string; to?: string } = {}
): Promise<Measurement[]> {
	let query = sb.from('body_measurements').select('*').eq('user_id', userId);
	if (range.from) query = query.gte('local_date', range.from);
	if (range.to) query = query.lte('local_date', range.to);
	const rows = unwrap(
		await query
			.order('local_date', { ascending: false })
			.order('measured_at', { ascending: false })
			.limit(500)
	);
	return rows ?? [];
}

/** Newest measurement that has a value for `field`. */
export async function latestMeasurement(
	sb: SupabaseServerClient,
	userId: string,
	field: 'weight_kg' | 'waist_cm'
): Promise<Measurement | null> {
	return unwrap(
		await sb
			.from('body_measurements')
			.select('*')
			.eq('user_id', userId)
			.not(field, 'is', null)
			.order('local_date', { ascending: false })
			.order('measured_at', { ascending: false })
			.limit(1)
			.maybeSingle()
	);
}

/**
 * Weight change over roughly a week: latest weight minus the most recent
 * weight logged 6–14 days before it. Null when there is no such pair, so a
 * gap is never reported as "no change".
 */
export function weeklyWeightChange(newestFirst: Measurement[]): number | null {
	const weights = newestFirst.filter((x) => x.weight_kg !== null);
	const latest = weights[0];
	if (!latest) return null;
	const earlier = weights.find((x) => {
		const gap = daysBetween(x.local_date, latest.local_date);
		return gap >= 6 && gap <= 14;
	});
	if (!earlier) return null;
	return Math.round((latest.weight_kg! - earlier.weight_kg!) * 10) / 10;
}

export async function createMeasurement(
	sb: SupabaseServerClient,
	userId: string,
	input: MeasurementCreate
): Promise<Measurement> {
	return unwrapFound(
		await sb
			.from('body_measurements')
			.insert({ ...input, user_id: userId })
			.select('*')
			.maybeSingle()
	);
}

export async function updateMeasurement(
	sb: SupabaseServerClient,
	userId: string,
	id: string,
	patch: MeasurementPatch
): Promise<Measurement> {
	return unwrapFound(
		await sb
			.from('body_measurements')
			.update(patch)
			.eq('id', id)
			.eq('user_id', userId)
			.select('*')
			.maybeSingle()
	);
}

export async function deleteMeasurement(
	sb: SupabaseServerClient,
	userId: string,
	id: string
): Promise<void> {
	unwrapFound(
		await sb
			.from('body_measurements')
			.delete()
			.eq('id', id)
			.eq('user_id', userId)
			.select('id')
			.maybeSingle()
	);
}
