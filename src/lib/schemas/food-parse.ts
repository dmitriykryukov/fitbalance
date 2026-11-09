import { z } from 'zod';
import { MEAL_TYPES, type Per100g, type Totals } from '#lib/nutrition.js';

/**
 * Food parser output, schema v1 (AI_SPEC.md). This one schema is sent to
 * Claude as the structured-output format and is also the app's own check of
 * what comes back: the API enforces the JSON shape, while number ranges and
 * lengths are only hints to the model, so out-of-range output fails here and
 * becomes AI_INVALID_RESPONSE.
 */
const Per100 = z.object({
	kcal: z.number().min(0).max(900),
	protein_g: z.number().min(0).max(100),
	carbs_g: z.number().min(0).max(100),
	fat_g: z.number().min(0).max(100),
	fibre_g: z.number().min(0).max(100).nullable()
});

const note = z.string().max(300);

export const FoodParseItemV1 = z.object({
	name: z.string().trim().min(1).max(120).describe('In the language the user wrote in'),
	quantity: z.number().gt(0).max(999_999).nullable().describe('As described by the user'),
	unit: z.string().trim().max(20).nullable().describe('piece, slice, cup, ml, g, … or null'),
	grams: z
		.number()
		.gt(0)
		.max(5000)
		.nullable()
		.describe('Estimated weight eaten; liquids converted to grams; null if no reasonable estimate'),
	preparation: z.string().trim().max(60).nullable(),
	is_assumption: z
		.boolean()
		.describe('True for likely items the user did not mention (oil, butter, sugar, dressing)'),
	nutrition_per_100g: Per100,
	confidence: z.number().min(0).max(1),
	uncertainties: z.array(note).max(4)
});

export const FoodParseV1 = z.object({
	schema_version: z.enum(['1']),
	items: z.array(FoodParseItemV1).max(30),
	clarifying_questions: z.array(note).max(3),
	notes: z.array(note).max(3)
});
export type FoodParseV1 = z.output<typeof FoodParseV1>;
export type FoodParseItemV1 = z.output<typeof FoodParseItemV1>;

/** Request body of POST /api/ai/food-parse. */
export const FoodParseRequest = z.strictObject({
	description: z.string().trim().min(1).max(1000),
	meal_type: z.enum(MEAL_TYPES).optional(),
	/** Answers to the previous result's clarifying questions ("Answer and re-analyze"). */
	clarifications: z
		.array(
			z.strictObject({
				question: z.string().trim().min(1).max(300),
				answer: z.string().trim().min(1).max(300)
			})
		)
		.max(3)
		.optional()
});
export type FoodParseRequest = z.output<typeof FoodParseRequest>;

/** Energy from macros disagrees with kcal by more than ±25 % (or ±20 kcal). */
export type FoodParseWarning = 'energy_mismatch';

/** A saved My foods entry with the same name, offered as "Use my saved values". */
export type MyFoodMatch = {
	id: string;
	name: string;
	brand: string | null;
	nutrition_per_100g: Per100g;
};

/** One item of the API response: the model's item plus checks and a preview. */
export type FoodParseItem = FoodParseItemV1 & {
	warnings: FoodParseWarning[];
	my_food_match: MyFoodMatch | null;
	/** Totals for `grams` (same rounding as the database), or null when grams is unknown. */
	preview: Totals | null;
};

export type FoodParseResult = {
	schema_version: '1';
	items: FoodParseItem[];
	clarifying_questions: string[];
	notes: string[];
	/** Sum of the items that have grams. */
	preview_total: Totals;
};
