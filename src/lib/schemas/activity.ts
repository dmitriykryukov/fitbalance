import { z } from 'zod';
import { ACTIVITY_TYPES, MUSCLE_GROUPS } from '#lib/activity.js';
import { MIN_LOCAL_DATE } from '#lib/dates.js';

const isoDate = z.iso.date();
const localDate = isoDate.refine((d) => d >= MIN_LOCAL_DATE, { message: 'Date is too early' });
const startedAt = z.iso.datetime({ offset: true }).nullable().default(null);
const duration = z.number().int().min(1).max(86_400);
const distance = z.number().int().min(0).max(1_000_000);
/** A number is the user's own value (e.g. from a watch); null lets the server estimate it. */
const activeKcal = z.number().int().min(0).max(20_000).nullable().default(null);
const text = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.transform((s) => (s === '' ? null : s))
		.nullable()
		.default(null);

/** Walking, running, cycling and other activities (POST, and the base for PATCH). */
const ActivityFields = z.strictObject({
	activity_type: z.enum(ACTIVITY_TYPES),
	title: text(80),
	local_date: localDate,
	started_at: startedAt,
	duration_seconds: duration,
	distance_meters: distance.nullable().default(null),
	steps: z.number().int().min(0).max(200_000).nullable().default(null),
	active_kcal: activeKcal,
	notes: text(1000)
});

const titleForOther = (a: { activity_type?: string; title?: string | null }) =>
	a.activity_type !== 'other' || !!a.title;

export const ActivityInput = ActivityFields.refine(titleForOther, {
	message: 'A title is required for other activities',
	path: ['title']
});
export type ActivityInput = z.output<typeof ActivityInput>;

/**
 * PATCH: any subset. Omitting `active_kcal` keeps a user-entered value and
 * re-estimates an estimated one when duration, distance or type change;
 * `null` asks for a fresh estimate.
 */
export const ActivityPatch = z
	.strictObject({
		activity_type: z.enum(ACTIVITY_TYPES).optional(),
		title: z
			.string()
			.trim()
			.max(80)
			.transform((s) => (s === '' ? null : s))
			.nullable()
			.optional(),
		local_date: localDate.optional(),
		started_at: z.iso.datetime({ offset: true }).nullable().optional(),
		duration_seconds: duration.optional(),
		distance_meters: distance.nullable().optional(),
		steps: z.number().int().min(0).max(200_000).nullable().optional(),
		active_kcal: z.number().int().min(0).max(20_000).nullable().optional(),
		notes: z
			.string()
			.trim()
			.max(1000)
			.transform((s) => (s === '' ? null : s))
			.nullable()
			.optional()
	})
	.refine((patch) => Object.keys(patch).length > 0, { message: 'Nothing to update' });
export type ActivityPatch = z.output<typeof ActivityPatch>;

export const WorkoutSetInput = z
	.strictObject({
		reps: z.number().int().min(0).max(1000).nullable().default(null),
		weight_kg: z.number().min(0).max(1000).nullable().default(null),
		duration_seconds: duration.nullable().default(null),
		distance_meters: distance.nullable().default(null),
		notes: text(500)
	})
	.refine((s) => s.reps !== null || s.duration_seconds !== null || s.distance_meters !== null, {
		message: 'A set needs reps, a duration or a distance'
	});

export const WorkoutExerciseInput = z.strictObject({
	name: z.string().trim().min(1).max(80),
	exercise_id: z.uuid().nullable().default(null),
	muscle_group: z.enum(MUSCLE_GROUPS).nullable().default(null),
	equipment: text(40),
	sets: z.array(WorkoutSetInput).min(1).max(50)
});

/** Create (POST) and full replacement (PUT) of a strength workout. */
export const WorkoutInput = z.strictObject({
	title: z.string().trim().min(1).max(80),
	local_date: localDate,
	started_at: startedAt,
	duration_seconds: duration.nullable().default(null),
	active_kcal: activeKcal,
	notes: text(1000),
	exercises: z.array(WorkoutExerciseInput).min(1).max(30)
});
export type WorkoutInput = z.output<typeof WorkoutInput>;

/** `?from=&to=` (inclusive local dates, at most 366 days). */
export const RangeQuery = z
	.strictObject({ from: isoDate, to: isoDate })
	.refine((r) => r.from <= r.to, { message: 'from must not be after to', path: ['from'] })
	.refine((r) => (Date.parse(r.to) - Date.parse(r.from)) / 86_400_000 <= 365, {
		message: 'At most 366 days',
		path: ['to']
	});

export const ExercisesQuery = z.strictObject({
	query: z.string().trim().max(80).optional()
});
