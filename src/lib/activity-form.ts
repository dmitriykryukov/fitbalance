import type { z } from 'zod';
import {
	durationToInput,
	estimateActiveKcal,
	parseDuration,
	type ActivityType,
	type MuscleGroup
} from './activity.js';
import { localTime, zonedIso } from './dates.js';
import { numberToInput, parseDecimal, type FieldErrors } from './forms.js';
import { m } from './paraglide/messages.js';
import type { ActivityInput, WorkoutInput } from './schemas/activity.js';

type ActivityBody = z.input<typeof ActivityInput>;
type WorkoutBody = z.input<typeof WorkoutInput>;

let counter = 0;
const nextKey = (prefix: string) => `${prefix}-${++counter}`;

/** Fields shared by both editors. Numbers stay text while the user types. */
type CommonDraft = {
	local_date: string;
	/** "HH:MM" in the profile time zone, or "" for no start time. */
	time: string;
	/** Minutes ("45") or h:mm:ss / mm:ss. */
	duration: string;
	/** Active kcal typed by the user; used only when `kcalEdited`. */
	kcal: string;
	/** False: the server estimates active kcal (MET × latest weight). */
	kcalEdited: boolean;
	notes: string;
};

export type CardioDraft = CommonDraft & {
	activity_type: ActivityType;
	title: string;
	/** Kilometres. */
	distance: string;
	steps: string;
};

export type SetDraft = { key: string; kg: string; reps: string };

export type ExerciseDraft = {
	key: string;
	name: string;
	exercise_id: string | null;
	muscle_group: MuscleGroup | null;
	equipment: string | null;
	sets: SetDraft[];
};

export type StrengthDraft = CommonDraft & { title: string; exercises: ExerciseDraft[] };

export function emptyCardioDraft(type: ActivityType, date: string, time: string): CardioDraft {
	return {
		activity_type: type,
		title: '',
		local_date: date,
		time,
		duration: '',
		distance: '',
		steps: '',
		kcal: '',
		kcalEdited: false,
		notes: ''
	};
}

export function emptyStrengthDraft(date: string, time: string, title: string): StrengthDraft {
	return {
		title,
		local_date: date,
		time,
		duration: '',
		kcal: '',
		kcalEdited: false,
		notes: '',
		exercises: []
	};
}

export function newSet(previous?: SetDraft): SetDraft {
	return { key: nextKey('set'), kg: previous?.kg ?? '', reps: previous?.reps ?? '' };
}

export function newExercise(suggestion: {
	name: string;
	id: string | null;
	muscle_group: MuscleGroup | null;
	equipment: string | null;
}): ExerciseDraft {
	return {
		key: nextKey('ex'),
		name: suggestion.name,
		exercise_id: suggestion.id,
		muscle_group: suggestion.muscle_group,
		equipment: suggestion.equipment,
		sets: [newSet()]
	};
}

const startTime = (startedAt: string | null, timeZone: string) =>
	startedAt ? localTime(timeZone, new Date(startedAt)) : '';

const savedKcal = (row: { estimated_kcal_burned: number | null; kcal_source: string | null }) => ({
	kcal: row.kcal_source === 'user' ? numberToInput(row.estimated_kcal_burned) : '',
	kcalEdited: row.kcal_source === 'user'
});

export function cardioDraftFromSaved(
	row: {
		activity_type: string;
		title: string | null;
		local_date: string;
		started_at: string | null;
		duration_seconds: number;
		distance_meters: number | null;
		steps: number | null;
		estimated_kcal_burned: number | null;
		kcal_source: string | null;
		notes: string | null;
	},
	timeZone: string
): CardioDraft {
	return {
		activity_type: row.activity_type as ActivityType,
		title: row.title ?? '',
		local_date: row.local_date,
		time: startTime(row.started_at, timeZone),
		duration: durationToInput(row.duration_seconds),
		distance: row.distance_meters === null ? '' : String(row.distance_meters / 1000),
		steps: numberToInput(row.steps),
		...savedKcal(row),
		notes: row.notes ?? ''
	};
}

export function strengthDraftFromSaved(
	workout: {
		title: string;
		local_date: string;
		started_at: string | null;
		duration_seconds: number | null;
		estimated_kcal_burned: number | null;
		kcal_source: string | null;
		notes: string | null;
		exercises: {
			name: string;
			exercise_id: string | null;
			muscle_group: MuscleGroup | null;
			equipment: string | null;
			sets: { reps: number | null; weight_kg: number | null }[];
		}[];
	},
	timeZone: string
): StrengthDraft {
	return {
		title: workout.title,
		local_date: workout.local_date,
		time: startTime(workout.started_at, timeZone),
		duration: durationToInput(workout.duration_seconds),
		...savedKcal(workout),
		notes: workout.notes ?? '',
		exercises: workout.exercises.map((exercise) => ({
			key: nextKey('ex'),
			name: exercise.name,
			exercise_id: exercise.exercise_id,
			muscle_group: exercise.muscle_group,
			equipment: exercise.equipment,
			sets: exercise.sets.map((set) => ({
				key: nextKey('set'),
				kg: numberToInput(set.weight_kg),
				reps: numberToInput(set.reps)
			}))
		}))
	};
}

/** Distance field (km) → whole metres; null when empty, undefined when unreadable. */
export function parseDistanceKm(text: string): number | null | undefined {
	const km = parseDecimal(text);
	if (km === null || km === undefined) return km;
	if (km < 0 || km > 1000) return undefined;
	return Math.round(km * 1000);
}

function parseWhole(text: string, max: number): number | null | undefined {
	const n = parseDecimal(text);
	if (n === null || n === undefined) return n;
	return Number.isInteger(n) && n >= 0 && n <= max ? n : undefined;
}

/**
 * Live preview of the active kcal the server will store: the user's number
 * when they typed one, otherwise the MET estimate (null without a weight).
 */
export function previewKcal(
	draft: CommonDraft,
	estimate: Parameters<typeof estimateActiveKcal>[0]
): { value: number | null; estimated: boolean } {
	if (draft.kcalEdited) {
		const typed = parseWhole(draft.kcal, 20_000);
		return { value: typed ?? null, estimated: false };
	}
	return { value: estimateActiveKcal(estimate), estimated: true };
}

/** Shared checks for date, time, duration, kcal and notes. */
function common(
	draft: CommonDraft,
	timeZone: string,
	errors: FieldErrors,
	durationRequired: boolean
) {
	if (!draft.local_date) errors.date = m.field_required();
	const time = draft.time.trim();
	if (time && !/^\d{2}:\d{2}$/.test(time)) errors.time = m.field_invalid();

	const duration = parseDuration(draft.duration);
	if (duration === undefined && durationRequired) errors.duration = m.field_required();
	else if (duration === null || (duration !== undefined && duration > 86_400)) {
		errors.duration = m.duration_invalid();
	}

	let kcal: number | null = null;
	if (draft.kcalEdited && draft.kcal.trim()) {
		const typed = parseWhole(draft.kcal, 20_000);
		if (typed === undefined) errors.kcal = m.field_invalid();
		else kcal = typed;
	}

	return {
		local_date: draft.local_date,
		started_at:
			time && !errors.time && draft.local_date ? zonedIso(draft.local_date, time, timeZone) : null,
		duration_seconds: typeof duration === 'number' ? duration : null,
		active_kcal: kcal,
		notes: draft.notes.trim() || null
	};
}

export function cardioToInput(
	draft: CardioDraft,
	timeZone: string
): { input: ActivityBody | null; errors: FieldErrors } {
	const errors: FieldErrors = {};
	const base = common(draft, timeZone, errors, true);

	const title = draft.title.trim();
	if (draft.activity_type === 'other' && !title) errors.title = m.field_required();

	const distance = parseDistanceKm(draft.distance);
	if (distance === undefined) errors.distance = m.field_invalid();
	const steps =
		draft.activity_type === 'walking' ? parseWhole(draft.steps, 200_000) : (null as number | null);
	if (steps === undefined) errors.steps = m.field_invalid();

	if (Object.keys(errors).length > 0) return { input: null, errors };
	return {
		input: {
			activity_type: draft.activity_type,
			title: title || null,
			...base,
			duration_seconds: base.duration_seconds!,
			distance_meters: distance ?? null,
			steps: steps ?? null
		},
		errors
	};
}

/** The sets that count: rows with neither kg nor reps are ignored. */
export const filledSets = (exercise: ExerciseDraft) =>
	exercise.sets.filter((s) => s.kg.trim() || s.reps.trim());

export function strengthToInput(
	draft: StrengthDraft,
	timeZone: string
): { input: WorkoutBody | null; errors: FieldErrors } {
	const errors: FieldErrors = {};
	const base = common(draft, timeZone, errors, false);

	const title = draft.title.trim();
	if (!title) errors.title = m.field_required();
	if (draft.exercises.length === 0) errors.exercises = m.workout_no_exercises();

	const exercises: WorkoutBody['exercises'] = draft.exercises.map((exercise) => {
		const rows = filledSets(exercise);
		if (rows.length === 0) errors[exercise.key] = m.exercise_no_sets();
		return {
			name: exercise.name,
			exercise_id: exercise.exercise_id,
			muscle_group: exercise.muscle_group,
			equipment: exercise.equipment,
			sets: rows.map((set) => {
				const reps = parseWhole(set.reps, 1000);
				if (reps === undefined || reps === null || reps === 0)
					errors[`${set.key}.reps`] = m.field_invalid();
				const kg = parseDecimal(set.kg);
				if (kg === undefined || (kg !== null && (kg < 0 || kg > 1000))) {
					errors[`${set.key}.kg`] = m.field_invalid();
				}
				return { reps: reps ?? null, weight_kg: typeof kg === 'number' ? kg : null };
			})
		};
	});

	if (Object.keys(errors).length > 0) return { input: null, errors };
	return { input: { title, ...base, exercises }, errors };
}
