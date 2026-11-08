import { parseDecimal, numberToInput, type FieldErrors } from '#lib/forms.js';
import { FITNESS_GOALS, type FitnessGoal } from '#lib/goals.js';
import { m } from '#lib/paraglide/messages.js';
import type { Tables } from '#lib/types/database.js';

type Profile = Tables<'profiles'>;
type Goal = Tables<'user_goals'>;

export type SexChoice = 'female' | 'male' | 'unspecified';

/** Personal details as typed in the form (numbers stay strings until saved). */
export type PersonalDetails = {
	display_name: string;
	date_of_birth: string;
	sex: SexChoice;
	height_cm: string;
	weight_kg: string;
	timezone: string;
};

export function detailsFromProfile(
	profile: Profile,
	weightKg: number | null,
	detectedTimeZone?: string
): PersonalDetails {
	return {
		display_name: profile.display_name ?? '',
		date_of_birth: profile.date_of_birth ?? '',
		sex: (profile.sex as SexChoice | null) ?? 'unspecified',
		height_cm: numberToInput(profile.height_cm),
		weight_kg: numberToInput(weightKg),
		// New profiles start at UTC; prefer the device's zone until the user picks one.
		timezone:
			profile.timezone === 'UTC' && !profile.onboarded_at && detectedTimeZone
				? detectedTimeZone
				: profile.timezone
	};
}

function inRange(value: number | null | undefined, min: number, max: number) {
	return value === null || (value !== undefined && value >= min && value <= max);
}

/** Validates the form and builds the PATCH body (weight is saved separately). */
export function detailsToPatch(d: PersonalDetails, today: string) {
	const errors: FieldErrors = {};
	const height = parseDecimal(d.height_cm);
	const weight = parseDecimal(d.weight_kg);

	if (!d.display_name.trim()) errors.display_name = m.field_required();
	if (d.date_of_birth && (d.date_of_birth <= '1900-01-01' || d.date_of_birth > today)) {
		errors.date_of_birth = m.field_invalid();
	}
	if (!inRange(height, 50, 272)) errors.height_cm = m.field_range({ min: 50, max: 272 });
	if (!inRange(weight, 20, 400)) errors.weight_kg = m.field_range({ min: 20, max: 400 });

	return {
		errors,
		weightKg: weight ?? null,
		patch: {
			display_name: d.display_name.trim(),
			date_of_birth: d.date_of_birth || null,
			sex: d.sex === 'unspecified' ? null : d.sex,
			height_cm: height ?? null,
			timezone: d.timezone
		}
	};
}

/** Goal targets as typed in the form. */
export type GoalsDraft = {
	fitness_goal: FitnessGoal;
	calories_kcal: string;
	protein_g: string;
	carbs_g: string;
	fat_g: string;
	target_weight_kg: string;
	target_waist_cm: string;
	weekly_activity_minutes: string;
};

export function draftFromGoal(goal: Goal | null): GoalsDraft {
	const fitness = goal?.fitness_goal as FitnessGoal | null | undefined;
	return {
		fitness_goal: fitness && FITNESS_GOALS.includes(fitness) ? fitness : 'maintain',
		calories_kcal: numberToInput(goal?.calories_kcal),
		protein_g: numberToInput(goal?.protein_g),
		carbs_g: numberToInput(goal?.carbs_g),
		fat_g: numberToInput(goal?.fat_g),
		target_weight_kg: numberToInput(goal?.target_weight_kg),
		target_waist_cm: numberToInput(goal?.target_waist_cm),
		weekly_activity_minutes: numberToInput(goal?.weekly_activity_minutes)
	};
}

const GOAL_LIMITS = {
	calories_kcal: [500, 10000, true],
	protein_g: [0, 1000, false],
	carbs_g: [0, 1000, false],
	fat_g: [0, 1000, false],
	target_weight_kg: [20, 400, false],
	target_waist_cm: [30, 300, false],
	weekly_activity_minutes: [0, 10080, true]
} as const;

/** Validates the draft and builds the PUT /api/goals body. */
export function draftToInput(d: GoalsDraft) {
	const errors: FieldErrors = {};
	const input: Record<string, number | null | string> = { fitness_goal: d.fitness_goal };
	for (const [key, [min, max, integer]] of Object.entries(GOAL_LIMITS)) {
		const value = parseDecimal(d[key as keyof typeof GOAL_LIMITS]);
		if (!inRange(value, min, max) || (integer && value != null && !Number.isInteger(value))) {
			errors[key] = m.field_range({ min, max });
		}
		input[key] = value ?? null;
	}
	return { errors, input };
}
