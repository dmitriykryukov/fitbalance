import { zonedIso } from '#lib/dates.js';
import { m } from '#lib/paraglide/messages.js';
import { parseDecimal, type FieldErrors } from '#lib/forms.js';
import {
	itemTotals,
	sumTotals,
	type EstimateSource,
	type MealType,
	type Per100g,
	type Totals
} from '#lib/nutrition.js';
import type { MealInput, MealItemInput } from '#lib/schemas/nutrition.js';
import type { Tables } from '#lib/types/database.js';

type FoodRow = Tables<'food_items'>;
type MealItemRow = Tables<'meal_items'>;

/** One food in a meal being edited. Grams stay text while the user types. */
export type DraftItem = {
	key: string;
	name: string;
	quantity: number | null;
	unit: string | null;
	grams: string;
	per100: Per100g;
	estimate_source: EstimateSource;
	confidence: number | null;
	notes: string | null;
	food_item_id: string | null;
};

export type MealDraft = {
	meal_type: MealType;
	local_date: string;
	/** "HH:MM" in the profile time zone. */
	time: string;
	notes: string;
	input_method: 'manual' | 'ai';
	ai_description: string | null;
	items: DraftItem[];
};

let counter = 0;
const nextKey = () => `item-${++counter}`;

export function per100FromFood(food: FoodRow): Per100g {
	return {
		kcal: food.kcal_per_100g,
		protein_g: food.protein_per_100g,
		carbs_g: food.carbs_per_100g,
		fat_g: food.fat_per_100g,
		fibre_g: food.fibre_per_100g
	};
}

/** A My foods entry added to a meal with `grams`. */
export function itemFromFood(food: FoodRow, grams: number): DraftItem {
	const servings =
		food.serving_grams && food.serving_description
			? Math.round((grams / food.serving_grams) * 100) / 100
			: null;
	return {
		key: nextKey(),
		name: food.name,
		quantity: servings,
		unit: servings === null ? null : food.serving_description!.slice(0, 20),
		grams: String(grams),
		per100: per100FromFood(food),
		estimate_source: 'my_food',
		confidence: null,
		notes: null,
		food_item_id: food.id
	};
}

export function itemFromSaved(item: MealItemRow): DraftItem {
	return {
		key: nextKey(),
		name: item.name,
		quantity: item.quantity,
		unit: item.unit,
		grams: String(item.grams),
		per100: {
			kcal: item.kcal_per_100g,
			protein_g: item.protein_per_100g,
			carbs_g: item.carbs_per_100g,
			fat_g: item.fat_per_100g,
			fibre_g: item.fibre_per_100g
		},
		estimate_source: item.estimate_source as EstimateSource,
		confidence: item.confidence,
		notes: item.notes,
		food_item_id: item.food_item_id
	};
}

/** Grams typed so far, or 0 while the field is empty or invalid (for previews). */
export function draftGrams(item: DraftItem): number {
	const grams = parseDecimal(item.grams);
	return typeof grams === 'number' && grams > 0 ? grams : 0;
}

export function draftItemTotals(item: DraftItem): Totals {
	return itemTotals(item.per100, draftGrams(item));
}

export function draftTotals(items: readonly DraftItem[]): Totals {
	return sumTotals(items.map(draftItemTotals));
}

/**
 * Validates the draft and builds the API request. Errors are keyed
 * `items.<key>` for grams, `items` when the meal is empty, `date`/`time`.
 */
export function draftToInput(
	draft: MealDraft,
	timeZone: string
): { input: MealInput | null; errors: FieldErrors } {
	const errors: FieldErrors = {};
	if (draft.items.length === 0) errors.items = m.meal_error_no_items();
	if (draft.items.length > 30) errors.items = m.meal_error_too_many();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.local_date)) errors.date = m.field_required();
	if (!/^\d{2}:\d{2}$/.test(draft.time)) errors.time = m.field_required();

	const items: MealItemInput[] = [];
	for (const item of draft.items) {
		const grams = parseDecimal(item.grams);
		if (typeof grams !== 'number' || grams <= 0 || grams > 5000) {
			errors[`items.${item.key}`] = m.field_range({ min: '1', max: '5000' });
			continue;
		}
		items.push({
			name: item.name,
			quantity: item.quantity,
			unit: item.unit,
			grams,
			nutrition_per_100g: item.per100,
			estimate_source: item.estimate_source,
			confidence: item.confidence,
			notes: item.notes,
			food_item_id: item.food_item_id
		});
	}

	if (Object.keys(errors).length > 0) return { input: null, errors };
	return {
		input: {
			local_date: draft.local_date,
			logged_at: zonedIso(draft.local_date, draft.time, timeZone),
			meal_type: draft.meal_type,
			input_method: draft.input_method,
			ai_description: draft.ai_description,
			notes: draft.notes.trim() || null,
			items
		},
		errors
	};
}
