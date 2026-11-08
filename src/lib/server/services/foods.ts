import { m } from '#lib/paraglide/messages.js';
import type { FoodInput, FoodPatch } from '#lib/schemas/nutrition.js';
import type { Tables } from '#lib/types/database.js';
import { ApiError } from '../api.js';
import { unwrap, unwrapFound } from '../db.js';
import type { SupabaseServerClient } from '../supabase.js';

export type Food = Tables<'food_items'>;

/**
 * `%text%` for an ilike filter inside PostgREST's `or=(…)`. Wildcards (`%`,
 * `_`, `*`), quotes and backslashes are dropped rather than escaped through
 * two layers of quoting; the value is quoted so `,` `.` `(` `)` stay literal.
 */
function likePattern(query: string): string {
	const plain = query.replace(/[\\%_*"]/g, ' ').trim();
	return `"%${plain}%"`;
}

/**
 * My foods. An empty query returns recently and frequently used foods;
 * otherwise a case-insensitive match on name or brand, most used first.
 */
export async function searchFoods(
	sb: SupabaseServerClient,
	userId: string,
	{ query = '', limit = 20 }: { query?: string; limit?: number } = {}
): Promise<Food[]> {
	let q = sb.from('food_items').select('*').eq('user_id', userId);
	const text = query.trim();
	if (text) {
		const pattern = likePattern(text);
		q = q.or(`name.ilike.${pattern},brand.ilike.${pattern}`);
	}
	const rows = unwrap(
		await q
			.order(text ? 'use_count' : 'last_used_at', { ascending: false, nullsFirst: false })
			.order(text ? 'last_used_at' : 'use_count', { ascending: false, nullsFirst: false })
			.order('name')
			.limit(limit)
	);
	return rows ?? [];
}

type Result<T> = { data: T | null; error: { code?: string; message: string } | null };

/** Name + brand must be unique per user; say so on the name field. */
function checkDuplicate<T>(result: Result<T>): Result<T> {
	if (result.error?.code === '23505') {
		const message = m.food_error_duplicate();
		throw new ApiError('VALIDATION_ERROR', message, { name: message });
	}
	return result;
}

export async function getFood(sb: SupabaseServerClient, userId: string, id: string): Promise<Food> {
	return unwrapFound(
		await sb.from('food_items').select('*').eq('id', id).eq('user_id', userId).maybeSingle()
	);
}

export async function createFood(
	sb: SupabaseServerClient,
	userId: string,
	input: FoodInput
): Promise<Food> {
	return unwrapFound(
		checkDuplicate(
			await sb
				.from('food_items')
				.insert({ ...input, user_id: userId, source: 'user' })
				.select('*')
				.maybeSingle()
		)
	);
}

/** Past meals keep their own nutrition snapshot, so edits only affect future use. */
export async function updateFood(
	sb: SupabaseServerClient,
	userId: string,
	id: string,
	patch: FoodPatch
): Promise<Food> {
	return unwrapFound(
		checkDuplicate(
			await sb
				.from('food_items')
				.update({ ...patch, source: 'user' })
				.eq('id', id)
				.eq('user_id', userId)
				.select('*')
				.maybeSingle()
		)
	);
}

/** Meal items that used the food keep their snapshot; only the link is cleared. */
export async function deleteFood(sb: SupabaseServerClient, userId: string, id: string) {
	unwrapFound(
		await sb
			.from('food_items')
			.delete()
			.eq('id', id)
			.eq('user_id', userId)
			.select('id')
			.maybeSingle()
	);
}
