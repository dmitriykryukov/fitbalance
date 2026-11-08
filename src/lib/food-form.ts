import { m } from '#lib/paraglide/messages.js';
import { numberToInput, parseDecimal, type FieldErrors } from '#lib/forms.js';
import { kcalFromMacros } from '#lib/nutrition.js';
import type { FoodInput } from '#lib/schemas/nutrition.js';
import type { Tables } from '#lib/types/database.js';

/** The "Create food" / "Edit food" form while the user types. */
export type FoodDraft = {
	name: string;
	brand: string;
	kcal: string;
	protein: string;
	carbs: string;
	fat: string;
	fibre: string;
	serving_description: string;
	serving_grams: string;
};

export const emptyFoodDraft = (name = ''): FoodDraft => ({
	name,
	brand: '',
	kcal: '',
	protein: '',
	carbs: '',
	fat: '',
	fibre: '',
	serving_description: '',
	serving_grams: ''
});

export function foodToDraft(food: Tables<'food_items'>): FoodDraft {
	return {
		name: food.name,
		brand: food.brand ?? '',
		kcal: numberToInput(food.kcal_per_100g),
		protein: numberToInput(food.protein_per_100g),
		carbs: numberToInput(food.carbs_per_100g),
		fat: numberToInput(food.fat_per_100g),
		fibre: numberToInput(food.fibre_per_100g),
		serving_description: food.serving_description ?? '',
		serving_grams: numberToInput(food.serving_grams)
	};
}

/**
 * Validates the form. Returns the API body, or field errors keyed by draft
 * field. `warning` flags energy that does not fit the macros (likely a typo)
 * without blocking the save.
 */
export function foodDraftToInput(draft: FoodDraft): {
	input: FoodInput | null;
	errors: FieldErrors;
	warning: string | null;
} {
	const errors: FieldErrors = {};
	const required = (key: keyof FoodDraft, max: number): number => {
		const value = parseDecimal(draft[key]);
		if (value === null) errors[key] = m.field_required();
		else if (value === undefined || value < 0 || value > max) {
			errors[key] = m.field_range({ min: '0', max: String(max) });
		}
		return typeof value === 'number' ? value : 0;
	};
	const optional = (key: keyof FoodDraft, min: number, max: number): number | null => {
		const value = parseDecimal(draft[key]);
		if (value === undefined || (typeof value === 'number' && (value < min || value > max))) {
			errors[key] = m.field_range({ min: String(min), max: String(max) });
			return null;
		}
		return value;
	};

	const name = draft.name.trim();
	if (!name) errors.name = m.field_required();

	const kcal = required('kcal', 900);
	const protein = required('protein', 100);
	const carbs = required('carbs', 100);
	const fat = required('fat', 100);
	const fibre = optional('fibre', 0, 100);
	const servingGrams = optional('serving_grams', 1, 5000);
	const servingDescription = draft.serving_description.trim();
	if (servingGrams !== null && !servingDescription) errors.serving_description = m.field_required();
	if (servingDescription && servingGrams === null) errors.serving_grams = m.field_required();

	// 100 g of food cannot hold more than 100 g of macronutrients.
	if (Object.keys(errors).length === 0 && protein + carbs + fat > 100.5) {
		errors.macros = m.food_error_over_100();
	}
	if (Object.keys(errors).length > 0) return { input: null, errors, warning: null };

	const fromMacros = kcalFromMacros(protein, carbs, fat);
	const warning =
		Math.abs(fromMacros - kcal) > Math.max(40, kcal * 0.25)
			? m.food_warning_energy({ kcal: String(Math.round(fromMacros)) })
			: null;

	return {
		input: {
			name,
			brand: draft.brand.trim() || null,
			kcal_per_100g: kcal,
			protein_per_100g: protein,
			carbs_per_100g: carbs,
			fat_per_100g: fat,
			fibre_per_100g: fibre,
			serving_description: servingDescription || null,
			serving_grams: servingGrams
		},
		errors,
		warning
	};
}
