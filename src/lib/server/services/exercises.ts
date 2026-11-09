import type { MuscleGroup } from '#lib/activity.js';
import { builtInSuggestions, type ExerciseSuggestion } from '#lib/exercises.js';
import { unwrap } from '../db.js';
import type { SupabaseServerClient } from '../supabase.js';

/**
 * The user's own exercises matching `query`, then built-in suggestions in
 * the UI language that the user does not already have (by name).
 */
export async function suggestExercises(
	sb: SupabaseServerClient,
	userId: string,
	locale: 'en' | 'ru',
	query = '',
	limit = 30
): Promise<ExerciseSuggestion[]> {
	const text = query.trim();
	let q = sb.from('exercises').select('id, name, muscle_group, equipment').eq('user_id', userId);
	if (text) q = q.ilike('name', `%${text.replace(/[\\%_]/g, ' ')}%`);
	const own = (unwrap(await q.order('updated_at', { ascending: false }).limit(limit)) ?? []).map(
		(row) => ({
			id: row.id,
			name: row.name,
			muscle_group: row.muscle_group as MuscleGroup | null,
			equipment: row.equipment
		})
	);
	const taken = new Set(own.map((x) => x.name.trim().toLocaleLowerCase()));
	const builtIn = builtInSuggestions(locale, text).filter(
		(x) => !taken.has(x.name.toLocaleLowerCase())
	);
	return [...own, ...builtIn].slice(0, limit);
}
