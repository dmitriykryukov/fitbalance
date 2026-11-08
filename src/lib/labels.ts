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
