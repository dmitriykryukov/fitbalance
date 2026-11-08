/**
 * Nutrition maths shared by the browser and the server.
 *
 * The database is the source of truth: `meal_items` calculates its totals in
 * generated columns as `round(per_100g × grams / 100, 1)` on numeric(…, 1)
 * inputs. These helpers reproduce that exactly (inputs rounded to one decimal
 * like numeric(…, 1), products in integer tenths, half rounded away from zero)
 * so previews in the UI match what is saved to the last decimal.
 */

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const ESTIMATE_SOURCES = ['ai_estimate', 'ai_edited', 'my_food', 'user_entered'] as const;
export type EstimateSource = (typeof ESTIMATE_SOURCES)[number];

/** Nutrition per 100 g, as stored on food_items and meal_items. */
export type Per100g = {
	kcal: number;
	protein_g: number;
	carbs_g: number;
	fat_g: number;
	/** Unknown fibre stays null, never 0. */
	fibre_g: number | null;
};

export type Totals = Per100g;

export const EMPTY_TOTALS: Totals = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: null };

/** x → integer tenths, rounding half away from zero (Postgres numeric(…, 1) cast). */
function tenths(x: number): number {
	// toPrecision removes binary noise such as 0.15 * 10 = 1.4999999999999998.
	const scaled = Number((Math.abs(x) * 10).toPrecision(12));
	return Math.sign(x) * Math.round(scaled);
}

/** Rounds to one decimal the way Postgres does for numeric values. */
export function round1(x: number): number {
	return tenths(x) / 10;
}

/** Totals for `grams` of a food, identical to the meal_items generated columns. */
export function itemTotals(per100: Per100g, grams: number): Totals {
	const g = tenths(grams);
	// per100 (tenths) × grams (tenths) / 100 → value × 10_000; round to tenths.
	const one = (value: number) => {
		const product = tenths(value) * g;
		return (Math.sign(product) * Math.floor((Math.abs(product) + 500) / 1000)) / 10;
	};
	return {
		kcal: one(per100.kcal),
		protein_g: one(per100.protein_g),
		carbs_g: one(per100.carbs_g),
		fat_g: one(per100.fat_g),
		fibre_g: per100.fibre_g === null ? null : one(per100.fibre_g)
	};
}

/** Sums totals in integer tenths (no float drift). Fibre is null when no part has it. */
export function sumTotals(parts: readonly Totals[]): Totals {
	let kcal = 0;
	let protein = 0;
	let carbs = 0;
	let fat = 0;
	let fibre: number | null = null;
	for (const t of parts) {
		kcal += tenths(t.kcal);
		protein += tenths(t.protein_g);
		carbs += tenths(t.carbs_g);
		fat += tenths(t.fat_g);
		if (t.fibre_g !== null) fibre = (fibre ?? 0) + tenths(t.fibre_g);
	}
	return {
		kcal: kcal / 10,
		protein_g: protein / 10,
		carbs_g: carbs / 10,
		fat_g: fat / 10,
		fibre_g: fibre === null ? null : fibre / 10
	};
}

/**
 * New grams when the quantity changes, keeping grams per unit
 * (`grams / quantity`). Used by quantity steppers (2 eggs = 100 g → 3 eggs = 150 g).
 */
export function scaleGrams(grams: number, quantity: number, nextQuantity: number): number {
	if (quantity <= 0) return grams;
	return round1((grams / quantity) * nextQuantity);
}

/** Energy from macros (4/4/9 kcal per gram); used to sanity-check entered values. */
export function kcalFromMacros(protein_g: number, carbs_g: number, fat_g: number): number {
	return protein_g * 4 + carbs_g * 4 + fat_g * 9;
}

/** A sensible default meal type for the local hour (0–23). */
export function mealTypeForHour(hour: number): MealType {
	if (hour >= 4 && hour < 11) return 'breakfast';
	if (hour >= 11 && hour < 16) return 'lunch';
	if (hour >= 16 && hour < 22) return 'dinner';
	return 'snack';
}

export type MacroStatus = 'on_track' | 'under' | 'over';

/**
 * Day status from the macros that have targets: "over" when any is above
 * 110 %, "on track" when all are within 90–110 %, otherwise "under".
 * Null when there are no targets or nothing is logged.
 */
export function macroStatus(
	macros: readonly { value: number; target: number | null }[]
): MacroStatus | null {
	const withTargets = macros.filter(
		(x): x is { value: number; target: number } => x.target !== null && x.target > 0
	);
	if (withTargets.length === 0) return null;
	const ratios = withTargets.map((x) => x.value / x.target);
	if (ratios.some((r) => r > 1.1)) return 'over';
	if (ratios.every((r) => r >= 0.9)) return 'on_track';
	return 'under';
}
