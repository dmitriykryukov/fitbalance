import { localDate } from '#lib/dates.js';
import type { ProfilePatch } from '#lib/schemas/profile.js';
import type { Tables, TablesUpdate } from '#lib/types/database.js';
import { unwrapFound } from '../db.js';
import type { SupabaseServerClient } from '../supabase.js';

export type Profile = Tables<'profiles'>;

export async function getProfile(sb: SupabaseServerClient, userId: string): Promise<Profile> {
	return unwrapFound(await sb.from('profiles').select('*').eq('id', userId).maybeSingle());
}

/** The user's diary date right now, in their profile time zone. */
export function profileToday(profile: Pick<Profile, 'timezone'>, at = new Date()): string {
	return localDate(profile.timezone, at);
}

export async function updateProfile(
	sb: SupabaseServerClient,
	userId: string,
	patch: ProfilePatch
): Promise<Profile> {
	const { onboarded, ...fields } = patch;
	const update: TablesUpdate<'profiles'> = { ...fields };

	if (onboarded) {
		const current = await getProfile(sb, userId);
		// Keep the first completion time if setup is finished twice.
		if (!current.onboarded_at) update.onboarded_at = new Date().toISOString();
		else if (Object.keys(update).length === 0) return current;
	}

	return unwrapFound(
		await sb.from('profiles').update(update).eq('id', userId).select('*').maybeSingle()
	);
}
