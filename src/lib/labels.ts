import { formatDuration, type LogType, type MuscleGroup } from '#lib/activity.js';
import { formatNumber } from '#lib/format.js';
import { m } from '#lib/paraglide/messages.js';
import type { MacroStatus, MealType } from '#lib/nutrition.js';

const MEAL_LABELS: Record<MealType, () => string> = {
	breakfast: m.meal_breakfast,
	lunch: m.meal_lunch,
	dinner: m.meal_dinner,
	snack: m.meal_snack
};

export const mealTypeLabel = (type: MealType) => MEAL_LABELS[type]();

const STATUS_LABELS: Record<MacroStatus, () => string> = {
	on_track: m.status_on_track,
	under: m.status_under,
	over: m.status_over
};

export const macroStatusLabel = (status: MacroStatus) => STATUS_LABELS[status]();

const ACTIVITY_LABELS: Record<string, () => string> = {
	walking: m.activity_type_walking,
	running: m.activity_type_running,
	cycling: m.activity_type_cycling,
	other: m.activity_type_other
};

export const activityTypeLabel = (type: string) =>
	(ACTIVITY_LABELS[type] ?? m.activity_type_other)();

const LOG_TYPE_LABELS: Record<LogType, () => string> = {
	strength: m.log_type_strength,
	running: m.activity_type_running,
	walking: m.activity_type_walking,
	cycling: m.activity_type_cycling,
	other: m.log_type_other
};

/** Tab labels on Add workout: Strength, Run, Walk, Cycling, Other. */
export const logTypeLabel = (type: LogType) => LOG_TYPE_LABELS[type]();

const MUSCLE_LABELS: Record<MuscleGroup, () => string> = {
	chest: m.muscle_chest,
	back: m.muscle_back,
	shoulders: m.muscle_shoulders,
	arms: m.muscle_arms,
	legs: m.muscle_legs,
	glutes: m.muscle_glutes,
	core: m.muscle_core,
	full_body: m.muscle_full_body,
	other: m.muscle_other
};

export const muscleGroupLabel = (group: MuscleGroup) => MUSCLE_LABELS[group]();

/** "Chest · Barbell", "Barbell", or "" when neither is known. */
export const exerciseMeta = (muscle: MuscleGroup | null, equipment: string | null) =>
	[muscle ? muscleGroupLabel(muscle) : null, equipment].filter(Boolean).join(' · ');

/** Active time: "45 min", "1 h 05 min" / "1 ч 05 мин". */
export function formatActiveTime(seconds: number): string {
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return m.minutes_value({ value: formatNumber(minutes) });
	return m.hours_minutes_value({
		hours: formatNumber(Math.floor(minutes / 60)),
		minutes: String(minutes % 60).padStart(2, '0')
	});
}

/** "5:45 /km" */
export const formatPace = (secondsPerKm: number) =>
	m.pace_value({ value: formatDuration(secondsPerKm) });

/** "24.5 km/h" */
export const formatSpeed = (kmh: number) => m.speed_value({ value: formatNumber(kmh, 1) });

/** "7.2 km" */
export const formatKm = (meters: number) =>
	m.distance_km({ value: formatNumber(meters / 1000, 1) });
