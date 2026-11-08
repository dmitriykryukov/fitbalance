import { m } from '#lib/paraglide/messages.js';
import { sumTotals, type MealType, type Totals } from '#lib/nutrition.js';
import type { MealInput } from '#lib/schemas/nutrition.js';
import type { Json, Tables } from '#lib/types/database.js';
import { ApiError } from '../api.js';
import { unwrap, unwrapFound } from '../db.js';
import type { SupabaseServerClient } from '../supabase.js';

type MealRow = Tables<'meals'>;
export type MealItem = Tables<'meal_items'>;
export type Meal = Omit<MealRow, 'meal_type'> & {
	meal_type: MealType;
	items: MealItem[];
	/** Sum of the database-calculated item totals. */
	totals: Totals;
	/** True when any item is an AI estimate (edited or not). */
	has_ai_estimates: boolean;
};

const MEAL_SELECT = '*, items:meal_items(*)';

type MealWithItems = MealRow & { items: MealItem[] };

function toMeal(row: MealWithItems): Meal {
	const items = [...row.items].sort((a, b) => a.position - b.position);
	return {
		...row,
		meal_type: row.meal_type as MealType,
		items,
		totals: sumTotals(items.map(itemTotalsOf)),
		has_ai_estimates: items.some(
			(i) => i.estimate_source === 'ai_estimate' || i.estimate_source === 'ai_edited'
		)
	};
}

/** Generated columns are typed nullable by the generator but are always set. */
export function itemTotalsOf(item: MealItem): Totals {
	return {
		kcal: item.kcal ?? 0,
		protein_g: item.protein_g ?? 0,
		carbs_g: item.carbs_g ?? 0,
		fat_g: item.fat_g ?? 0,
		fibre_g: item.fibre_g
	};
}

/** Meals on a diary date, in the order they were eaten. */
export async function listMeals(
	sb: SupabaseServerClient,
	userId: string,
	date: string
): Promise<Meal[]> {
	const rows = unwrap(
		await sb
			.from('meals')
			.select(MEAL_SELECT)
			.eq('user_id', userId)
			.eq('local_date', date)
			.order('logged_at')
			.order('created_at')
	);
	return (rows ?? []).map((row) => toMeal(row as MealWithItems));
}

export async function getMeal(sb: SupabaseServerClient, userId: string, id: string): Promise<Meal> {
	const row = unwrapFound(
		await sb.from('meals').select(MEAL_SELECT).eq('id', id).eq('user_id', userId).maybeSingle()
	);
	return toMeal(row as MealWithItems);
}

/** API request → `save_meal` payload (column names, defaults filled in). */
export function mealPayload(input: MealInput, id: string | null): Json {
	return {
		id,
		local_date: input.local_date,
		logged_at: input.logged_at ?? null,
		meal_type: input.meal_type,
		input_method: input.input_method,
		ai_description: input.ai_description ?? null,
		notes: input.notes ?? null,
		items: input.items.map((item) => ({
			name: item.name,
			quantity: item.quantity,
			unit: item.unit,
			grams: item.grams,
			kcal_per_100g: item.nutrition_per_100g.kcal,
			protein_per_100g: item.nutrition_per_100g.protein_g,
			carbs_per_100g: item.nutrition_per_100g.carbs_g,
			fat_per_100g: item.nutrition_per_100g.fat_g,
			fibre_per_100g: item.nutrition_per_100g.fibre_g,
			estimate_source: item.estimate_source,
			confidence: item.confidence,
			notes: item.notes ?? null,
			food_item_id: item.food_item_id,
			save_to_my_foods:
				item.save_to_my_foods ??
				(item.estimate_source === 'ai_estimate' || item.estimate_source === 'ai_edited')
		}))
	};
}

/**
 * Creates (id null) or replaces a meal and its items in one transaction via
 * the `save_meal` database function, then returns it with database totals.
 */
export async function saveMeal(
	sb: SupabaseServerClient,
	userId: string,
	input: MealInput,
	id: string | null = null
): Promise<Meal> {
	const { data, error } = await sb.rpc('save_meal', { payload: mealPayload(input, id) });
	if (error?.code === 'P0002') throw new ApiError('NOT_FOUND', m.error_not_found());
	const mealId = unwrapFound({ data, error });
	return getMeal(sb, userId, mealId);
}

export async function deleteMeal(sb: SupabaseServerClient, userId: string, id: string) {
	unwrapFound(
		await sb.from('meals').delete().eq('id', id).eq('user_id', userId).select('id').maybeSingle()
	);
}

export type DailyNutrition = Tables<'daily_nutrition'>;

/** The `daily_nutrition` row for a date, or null when nothing was logged (never zeros). */
export async function getDailyNutrition(
	sb: SupabaseServerClient,
	userId: string,
	date: string
): Promise<DailyNutrition | null> {
	return unwrap(
		await sb
			.from('daily_nutrition')
			.select('*')
			.eq('user_id', userId)
			.eq('local_date', date)
			.maybeSingle()
	);
}
