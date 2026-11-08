import { z } from 'zod';
import { isValidTimeZone, MIN_LOCAL_DATE } from '#lib/dates.js';
import { ACTIVITY_PREFERENCES, FITNESS_GOALS, SEXES } from '#lib/goals.js';

const isoDate = z.iso.date();
const nullableNumber = (min: number, max: number) => z.number().min(min).max(max).nullable();
const nullableInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable();

export const ProfilePatch = z
	.strictObject({
		display_name: z.string().trim().min(1).max(80).nullable().optional(),
		date_of_birth: isoDate
			.refine((d) => d > '1900-01-01' && d <= new Date().toISOString().slice(0, 10), {
				message: 'Date of birth is out of range'
			})
			.nullable()
			.optional(),
		sex: z.enum(SEXES).nullable().optional(),
		height_cm: nullableNumber(50, 272).optional(),
		timezone: z.string().refine(isValidTimeZone, { message: 'Unknown time zone' }).optional(),
		locale: z.enum(['en', 'ru']).optional(),
		activity_preferences: z
			.array(z.enum(ACTIVITY_PREFERENCES))
			.max(ACTIVITY_PREFERENCES.length)
			.transform((list) => [...new Set(list)])
			.optional(),
		/** `true` marks first-time setup as finished. */
		onboarded: z.literal(true).optional()
	})
	.refine((patch) => Object.keys(patch).length > 0, { message: 'Nothing to update' });
export type ProfilePatch = z.output<typeof ProfilePatch>;

/** Full replacement of the goal version effective from the user's today. */
export const GoalsInput = z.strictObject({
	fitness_goal: z.enum(FITNESS_GOALS).nullable().default(null),
	calories_kcal: nullableInt(500, 10000).default(null),
	protein_g: nullableNumber(0, 1000).default(null),
	carbs_g: nullableNumber(0, 1000).default(null),
	fat_g: nullableNumber(0, 1000).default(null),
	target_weight_kg: nullableNumber(20, 400).default(null),
	target_waist_cm: nullableNumber(30, 300).default(null),
	weekly_activity_minutes: nullableInt(0, 10080).default(null)
});
export type GoalsInput = z.output<typeof GoalsInput>;

export const GoalsQuery = z.strictObject({ date: isoDate.optional() });

export const SuggestionQuery = z.strictObject({
	fitness_goal: z.enum(FITNESS_GOALS).optional(),
	weekly_activity_minutes: z.coerce.number().int().min(0).max(10080).optional()
});

const measurementFields = {
	local_date: isoDate.refine((d) => d >= MIN_LOCAL_DATE, { message: 'Date is too early' }),
	measured_at: z.iso.datetime({ offset: true }),
	weight_kg: nullableNumber(20, 400),
	waist_cm: nullableNumber(30, 300),
	notes: z.string().trim().max(500).nullable()
};

export const MeasurementCreate = z
	.strictObject({
		local_date: measurementFields.local_date,
		measured_at: measurementFields.measured_at.optional(),
		weight_kg: measurementFields.weight_kg.optional(),
		waist_cm: measurementFields.waist_cm.optional(),
		notes: measurementFields.notes.optional()
	})
	.refine((m) => m.weight_kg != null || m.waist_cm != null, {
		message: 'Enter weight or waist',
		path: ['weight_kg']
	});
export type MeasurementCreate = z.output<typeof MeasurementCreate>;

export const MeasurementPatch = z
	.strictObject({
		local_date: measurementFields.local_date.optional(),
		measured_at: measurementFields.measured_at.optional(),
		weight_kg: measurementFields.weight_kg.optional(),
		waist_cm: measurementFields.waist_cm.optional(),
		notes: measurementFields.notes.optional()
	})
	.refine((patch) => Object.keys(patch).length > 0, { message: 'Nothing to update' });
export type MeasurementPatch = z.output<typeof MeasurementPatch>;

export const MeasurementsQuery = z.strictObject({
	from: isoDate.optional(),
	to: isoDate.optional()
});

export const IdParam = z.uuid();
