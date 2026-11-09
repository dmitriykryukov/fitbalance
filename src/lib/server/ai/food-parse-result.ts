import { energyMismatch, itemTotals, sumTotals, type Per100g } from '#lib/nutrition.js';
import type {
	FoodParseItem,
	FoodParseResult,
	FoodParseV1,
	FoodParseWarning,
	MyFoodMatch
} from '#lib/schemas/food-parse.js';

/** How My foods names are compared: trimmed and case-insensitive (also for Cyrillic). */
export function foodKey(name: string): string {
	return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/**
 * Adds the app's checks to the model's output: energy warnings, the matching
 * My foods entry, and preview totals with the database's rounding. Items
 * without grams get no preview and are left out of `preview_total`.
 */
export function buildFoodParseResult(
	parsed: FoodParseV1,
	matches: ReadonlyMap<string, MyFoodMatch>
): FoodParseResult {
	const items: FoodParseItem[] = parsed.items.map((item) => {
		const per100: Per100g = item.nutrition_per_100g;
		const warnings: FoodParseWarning[] = energyMismatch(per100) ? ['energy_mismatch'] : [];
		return {
			...item,
			warnings,
			my_food_match: matches.get(foodKey(item.name)) ?? null,
			preview: item.grams === null ? null : itemTotals(per100, item.grams)
		};
	});
	return {
		schema_version: '1',
		items,
		clarifying_questions: parsed.clarifying_questions,
		notes: parsed.notes,
		preview_total: sumTotals(items.flatMap((item) => (item.preview ? [item.preview] : [])))
	};
}
