import { z } from 'zod';
import { MIN_LOCAL_DATE } from '#lib/dates.js';
import { ESTIMATE_SOURCES, MEAL_TYPES } from '#lib/nutrition.js';

const isoDate = z.iso.date();
const localDate = isoDate.refine((d) => d >= MIN_LOCAL_DATE, { message: 'Date is too early' });
/** Matches numeric(…, 1) columns: values with more decimals are rounded by the database. */
const amount = (min: number, max: number) => z.number().min(min).max(max);
const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.transform((s) => (s === '' ? null : s))
		.nullable()
		.optional();

/** Nutrition per 100 g (same limits as the database). */
export const Per100gInput = z.strictObject({
	kcal: amount(0, 900),
	protein_g: amount(0, 100),
	carbs_g: amount(0, 100),
	fat_g: amount(0, 100),
	fibre_g: amount(0, 100).nullable().default(null)
});

export const MealItemInput = z.strictObject({
	name: z.string().trim().min(1).max(120),
	quantity: z.number().gt(0).max(999_999).nullable().default(null),
	unit: z.string().trim().min(1).max(20).nullable().default(null),
	grams: z.number().gt(0).max(5000),
	nutrition_per_100g: Per100gInput,
	estimate_source: z.enum(ESTIMATE_SOURCES),
	confidence: z.number().min(0).max(1).nullable().default(null),
	notes: optionalText(500),
	food_item_id: z.uuid().nullable().default(null),
	/** Default: true for AI items, false otherwise (API_SPEC). */
	save_to_my_foods: z.boolean().optional()
});
export type MealItemInput = z.output<typeof MealItemInput>;

/** Create (POST) and full replacement (PUT) share one shape. Totals are never accepted. */
export const MealInput = z.strictObject({
	local_date: localDate,
	logged_at: z.iso.datetime({ offset: true }).nullable().optional(),
	meal_type: z.enum(MEAL_TYPES),
	input_method: z.enum(['manual', 'ai']).default('manual'),
	ai_description: optionalText(2000),
	notes: optionalText(1000),
	items: z.array(MealItemInput).min(1).max(30)
});
export type MealInput = z.output<typeof MealInput>;

export const DateQuery = z.strictObject({ date: isoDate.optional() });

export const FoodInput = z.strictObject({
	name: z.string().trim().min(1).max(120),
	brand: optionalText(80),
	kcal_per_100g: amount(0, 900),
	protein_per_100g: amount(0, 100),
	carbs_per_100g: amount(0, 100),
	fat_per_100g: amount(0, 100),
	fibre_per_100g: amount(0, 100).nullable().optional(),
	serving_description: optionalText(60),
	serving_grams: z.number().gt(0).max(5000).nullable().optional()
});
export type FoodInput = z.output<typeof FoodInput>;

export const FoodPatch = FoodInput.partial().refine((patch) => Object.keys(patch).length > 0, {
	message: 'Nothing to update'
});
export type FoodPatch = z.output<typeof FoodPatch>;

export const FoodsQuery = z.strictObject({
	query: z.string().trim().max(120).optional(),
	limit: z.coerce.number().int().min(1).max(50).optional()
});
