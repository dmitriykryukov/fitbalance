import { numberToInput, parseDecimal } from '#lib/forms.js';
import type { DraftItem } from '#lib/meal-form.js';
import { energyMismatch, round1, type EstimateSource, type Per100g } from '#lib/nutrition.js';
import type { FoodParseItem, MyFoodMatch } from '#lib/schemas/food-parse.js';

/**
 * One food on the Review meal screen. Grams stay text while the user types;
 * `gramsPerUnit` lets the quantity stepper scale grams proportionally.
 */
export type ReviewItem = DraftItem & {
	preparation: string | null;
	is_assumption: boolean;
	uncertainties: string[];
	/** grams ÷ quantity from the AI estimate; null when either was missing. */
	gramsPerUnit: number | null;
	/** Stepper step in the item's own unit. */
	step: number;
	match: MyFoodMatch | null;
};

let counter = 0;
const nextKey = () => `ai-${++counter}`;

/** Stepper step for a quantity: 10 for "200 ml", 1 for "2 eggs", ½ for "1 cup". */
export function quantityStep(quantity: number): number {
	if (quantity >= 50) return 10;
	if (quantity >= 2) return 1;
	return 0.5;
}

/** Notes saved with the item: the AI's assumptions, within the 500-character limit. */
function notesOf(uncertainties: string[]): string | null {
	const text = uncertainties.join(' ').trim();
	return text ? text.slice(0, 500) : null;
}

export function reviewItemFromParse(item: FoodParseItem): ReviewItem {
	const perUnit =
		item.grams !== null && item.quantity !== null && item.quantity > 0 && item.unit
			? item.grams / item.quantity
			: null;
	return {
		key: nextKey(),
		name: item.name,
		quantity: perUnit === null ? null : item.quantity,
		unit: perUnit === null ? null : item.unit,
		grams: item.grams === null ? '' : numberToInput(item.grams),
		per100: item.nutrition_per_100g,
		estimate_source: 'ai_estimate',
		confidence: item.confidence,
		notes: notesOf(item.uncertainties),
		food_item_id: null,
		preparation: item.preparation,
		is_assumption: item.is_assumption,
		uncertainties: item.uncertainties,
		gramsPerUnit: perUnit,
		step: perUnit === null ? 1 : quantityStep(item.quantity!),
		match: item.my_food_match
	};
}

/** A My foods entry added on the review screen ("Add ingredient"). */
export function reviewItemFromDraft(item: DraftItem): ReviewItem {
	const grams = parseDecimal(item.grams);
	const perUnit =
		typeof grams === 'number' && item.quantity && item.unit ? grams / item.quantity : null;
	return {
		...item,
		key: nextKey(),
		preparation: null,
		is_assumption: false,
		uncertainties: [],
		gramsPerUnit: perUnit,
		step: perUnit === null ? 1 : quantityStep(item.quantity!),
		match: null
	};
}

/** Changing the amount: an AI estimate becomes "ai_edited"; saved foods stay "my_food". */
function amountEdited(source: EstimateSource): EstimateSource {
	return source === 'ai_estimate' ? 'ai_edited' : source;
}

/** One stepper press. Grams follow the quantity (grams per unit stays the same). */
export function stepQuantity(item: ReviewItem, direction: 1 | -1): ReviewItem {
	if (item.gramsPerUnit === null || item.quantity === null) return item;
	const next = Math.max(item.step, round2(item.quantity + direction * item.step));
	if (next === item.quantity) return item;
	return {
		...item,
		quantity: next,
		grams: numberToInput(Math.min(5000, round1(item.gramsPerUnit * next))),
		estimate_source: amountEdited(item.estimate_source)
	};
}

/** Grams typed directly: the quantity follows, so the saved quantity stays consistent. */
export function setGrams(item: ReviewItem, grams: string): ReviewItem {
	const value = parseDecimal(grams);
	const quantity =
		item.gramsPerUnit && typeof value === 'number' && value > 0
			? round2(value / item.gramsPerUnit)
			: item.quantity;
	return { ...item, grams, quantity, estimate_source: amountEdited(item.estimate_source) };
}

/** "Use my saved values": name and nutrition from My foods; the grams stay. */
export function useSavedValues(item: ReviewItem): ReviewItem {
	if (!item.match) return item;
	return {
		...item,
		name: item.match.name,
		per100: item.match.nutrition_per_100g,
		estimate_source: 'my_food',
		food_item_id: item.match.id,
		confidence: null
	};
}

/**
 * The user changed the name or the values per 100 g. An AI item becomes
 * "ai_edited"; a saved food becomes the user's own values and is no longer
 * linked to the My foods entry.
 */
export function editDetails(item: ReviewItem, name: string, per100: Per100g): ReviewItem {
	const fromSaved = item.estimate_source === 'my_food' || item.estimate_source === 'user_entered';
	return {
		...item,
		name,
		per100,
		estimate_source: fromSaved ? 'user_entered' : 'ai_edited',
		food_item_id: null
	};
}

export function hasEnergyWarning(item: Pick<ReviewItem, 'per100'>): boolean {
	return energyMismatch(item.per100);
}

/** Grams are missing or out of range: highlighted, and saving is blocked. */
export function needsGrams(item: Pick<ReviewItem, 'grams'>): boolean {
	const grams = parseDecimal(item.grams);
	return typeof grams !== 'number' || grams <= 0 || grams > 5000;
}

function round2(x: number): number {
	return Math.round(x * 100) / 100;
}
