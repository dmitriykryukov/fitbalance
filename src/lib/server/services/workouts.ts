import type { MuscleGroup } from '#lib/activity.js';
import { m } from '#lib/paraglide/messages.js';
import type { WorkoutInput } from '#lib/schemas/activity.js';
import type { Json, Tables } from '#lib/types/database.js';
import { ApiError } from '../api.js';
import { unwrap, unwrapFound } from '../db.js';
import type { SupabaseServerClient } from '../supabase.js';
import { activeKcalFor, latestWeightKg } from './activities.js';

type WorkoutRow = Tables<'workouts'>;
export type WorkoutSet = Tables<'workout_sets'>;

/** One exercise of a workout with its sets, in workout order. */
export type WorkoutExercise = {
	exercise_order: number;
	name: string;
	exercise_id: string | null;
	muscle_group: MuscleGroup | null;
	equipment: string | null;
	sets: WorkoutSet[];
};

export type Workout = WorkoutRow & {
	exercises: WorkoutExercise[];
	set_count: number;
	/** Σ reps × kg over sets that have both. */
	volume_kg: number;
};

export type WorkoutSummary = WorkoutRow & {
	exercise_count: number;
	set_count: number;
	volume_kg: number;
};

type SetWithExercise = WorkoutSet & {
	exercise: { muscle_group: string | null; equipment: string | null } | null;
};

const WORKOUT_SELECT =
	'*, sets:workout_sets(*, exercise:exercises!workout_sets_exercise_id_user_id_fkey(muscle_group, equipment))';

function volume(sets: Pick<WorkoutSet, 'reps' | 'weight_kg'>[]): number {
	const total = sets.reduce((sum, s) => sum + (s.reps ?? 0) * (s.weight_kg ?? 0), 0);
	return Math.round(total * 10) / 10;
}

function toWorkout(row: WorkoutRow & { sets: SetWithExercise[] }): Workout {
	const sets = [...row.sets].sort(
		(a, b) => a.exercise_order - b.exercise_order || a.set_number - b.set_number
	);
	const exercises: WorkoutExercise[] = [];
	for (const { exercise, ...set } of sets) {
		let current = exercises.at(-1);
		if (!current || current.exercise_order !== set.exercise_order) {
			current = {
				exercise_order: set.exercise_order,
				name: set.exercise_name,
				exercise_id: set.exercise_id,
				muscle_group: (exercise?.muscle_group as MuscleGroup | null) ?? null,
				equipment: exercise?.equipment ?? null,
				sets: []
			};
			exercises.push(current);
		}
		current.sets.push(set);
	}
	const { sets: _sets, ...workout } = row;
	void _sets;
	return { ...workout, exercises, set_count: sets.length, volume_kg: volume(sets) };
}

export async function listWorkouts(
	sb: SupabaseServerClient,
	userId: string,
	range: { from: string; to: string }
): Promise<WorkoutSummary[]> {
	const rows = unwrap(
		await sb
			.from('workouts')
			.select('*, sets:workout_sets(exercise_order, reps, weight_kg)')
			.eq('user_id', userId)
			.gte('local_date', range.from)
			.lte('local_date', range.to)
			.order('local_date', { ascending: false })
			.order('started_at', { ascending: false, nullsFirst: false })
			.limit(1000)
	);
	return (rows ?? []).map(({ sets, ...workout }) => ({
		...workout,
		exercise_count: new Set(sets.map((s) => s.exercise_order)).size,
		set_count: sets.length,
		volume_kg: volume(sets)
	}));
}

export async function getWorkout(
	sb: SupabaseServerClient,
	userId: string,
	id: string
): Promise<Workout> {
	const row = unwrapFound(
		await sb
			.from('workouts')
			.select(WORKOUT_SELECT)
			.eq('id', id)
			.eq('user_id', userId)
			.maybeSingle()
	);
	return toWorkout(row as unknown as WorkoutRow & { sets: SetWithExercise[] });
}

export function workoutPayload(
	input: WorkoutInput,
	id: string | null,
	kcal: { estimated_kcal_burned: number | null; kcal_source: string | null }
): Json {
	return {
		id,
		title: input.title,
		local_date: input.local_date,
		started_at: input.started_at,
		duration_seconds: input.duration_seconds,
		...kcal,
		notes: input.notes,
		exercises: input.exercises.map((exercise) => ({
			name: exercise.name,
			exercise_id: exercise.exercise_id,
			muscle_group: exercise.muscle_group,
			equipment: exercise.equipment,
			sets: exercise.sets.map((set) => ({
				reps: set.reps,
				weight_kg: set.weight_kg,
				duration_seconds: set.duration_seconds,
				distance_meters: set.distance_meters,
				notes: set.notes
			}))
		}))
	};
}

/**
 * Creates (id null) or replaces a workout and its sets in one transaction via
 * the `save_workout` database function; new exercise names join the user's
 * exercise list.
 */
export async function saveWorkout(
	sb: SupabaseServerClient,
	userId: string,
	input: WorkoutInput,
	id: string | null = null
): Promise<Workout> {
	const kcal = activeKcalFor(
		input.active_kcal,
		{ type: 'strength', durationSeconds: input.duration_seconds },
		await latestWeightKg(sb, userId)
	);
	const { data, error } = await sb.rpc('save_workout', {
		payload: workoutPayload(input, id, kcal)
	});
	if (error?.code === 'P0002') throw new ApiError('NOT_FOUND', m.error_not_found());
	const workoutId = unwrapFound({ data, error });
	return getWorkout(sb, userId, workoutId);
}

export async function deleteWorkout(sb: SupabaseServerClient, userId: string, id: string) {
	unwrapFound(
		await sb.from('workouts').delete().eq('id', id).eq('user_id', userId).select('id').maybeSingle()
	);
}
