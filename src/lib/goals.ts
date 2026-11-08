export const FITNESS_GOALS = ['lose_fat', 'maintain', 'build_muscle'] as const;
export type FitnessGoal = (typeof FITNESS_GOALS)[number];

export const SEXES = ['female', 'male'] as const;
export type Sex = (typeof SEXES)[number];

export const ACTIVITY_PREFERENCES = ['gym', 'running', 'walking', 'cycling', 'other'] as const;
export type ActivityPreference = (typeof ACTIVITY_PREFERENCES)[number];

export type SuggestionInput = {
	/** Unknown sex uses the midpoint of the two Mifflin–St Jeor constants. */
	sex: Sex | null;
	ageYears: number;
	heightCm: number;
	weightKg: number;
	fitnessGoal: FitnessGoal;
	weeklyActivityMinutes: number | null;
};

export type Suggestion = {
	calories_kcal: number;
	protein_g: number;
	carbs_g: number;
	fat_g: number;
	bmr_kcal: number;
	maintenance_kcal: number;
	activity_factor: number;
};

/** Resting energy (kcal/day), Mifflin–St Jeor. */
export function bmrMifflinStJeor(
	input: Pick<SuggestionInput, 'sex' | 'ageYears' | 'heightCm' | 'weightKg'>
): number {
	const sexConstant = input.sex === 'male' ? 5 : input.sex === 'female' ? -161 : -78;
	return 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears + sexConstant;
}

/** Activity multiplier from planned weekly exercise minutes (light by default). */
export function activityFactor(weeklyMinutes: number | null): number {
	if (weeklyMinutes === null) return 1.375;
	if (weeklyMinutes < 60) return 1.2;
	if (weeklyMinutes < 150) return 1.375;
	if (weeklyMinutes < 300) return 1.55;
	return 1.725;
}

const GOAL_CALORIE_FACTOR: Record<FitnessGoal, number> = {
	lose_fat: 0.8,
	maintain: 1,
	build_muscle: 1.1
};

const PROTEIN_G_PER_KG: Record<FitnessGoal, number> = {
	lose_fat: 2.0,
	maintain: 1.6,
	build_muscle: 1.8
};

/** Lowest calorie suggestion for fat loss without supervision. */
const CALORIE_FLOOR: Record<Sex | 'unknown', number> = { female: 1200, male: 1500, unknown: 1350 };

const round = (value: number, step: number) => Math.round(value / step) * step;

/**
 * Suggested daily targets: BMR × activity factor, adjusted for the goal.
 * Protein by body weight (capped at 35 % of calories), fat 27 % of calories,
 * carbohydrates fill the rest. A starting point, labelled as an estimate.
 */
export function suggestTargets(input: SuggestionInput): Suggestion {
	const bmr = bmrMifflinStJeor(input);
	const factor = activityFactor(input.weeklyActivityMinutes);
	const maintenance = bmr * factor;

	let calories = maintenance * GOAL_CALORIE_FACTOR[input.fitnessGoal];
	if (input.fitnessGoal === 'lose_fat') {
		calories = Math.max(calories, CALORIE_FLOOR[input.sex ?? 'unknown']);
	}
	calories = Math.min(10000, Math.max(500, round(calories, 10)));

	const protein = round(
		Math.min(input.weightKg * PROTEIN_G_PER_KG[input.fitnessGoal], (calories * 0.35) / 4),
		5
	);
	const fat = round((calories * 0.27) / 9, 5);
	const carbs = Math.max(0, round((calories - protein * 4 - fat * 9) / 4, 5));

	return {
		calories_kcal: calories,
		protein_g: protein,
		carbs_g: carbs,
		fat_g: fat,
		bmr_kcal: Math.round(bmr),
		maintenance_kcal: Math.round(maintenance),
		activity_factor: factor
	};
}
