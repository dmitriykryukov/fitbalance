import type { MuscleGroup } from './activity.js';

export type BuiltInExercise = {
	en: string;
	ru: string;
	muscle_group: MuscleGroup;
	equipment: { en: string; ru: string } | null;
};

const BARBELL = { en: 'Barbell', ru: 'Штанга' };
const DUMBBELLS = { en: 'Dumbbells', ru: 'Гантели' };
const MACHINE = { en: 'Machine', ru: 'Тренажёр' };
const CABLE = { en: 'Cable', ru: 'Блок' };
const BODYWEIGHT = { en: 'Bodyweight', ru: 'Свой вес' };
const KETTLEBELL = { en: 'Kettlebell', ru: 'Гиря' };

/**
 * Built-in exercise suggestions (EN/RU). Not stored: an exercise is added to
 * the user's own list (`exercises`) the first time it is used in a workout.
 */
export const BUILT_IN_EXERCISES: BuiltInExercise[] = [
	{ en: 'Bench press', ru: 'Жим лёжа', muscle_group: 'chest', equipment: BARBELL },
	{
		en: 'Incline dumbbell press',
		ru: 'Жим гантелей на наклонной',
		muscle_group: 'chest',
		equipment: DUMBBELLS
	},
	{ en: 'Dumbbell fly', ru: 'Разводка гантелей', muscle_group: 'chest', equipment: DUMBBELLS },
	{ en: 'Push-up', ru: 'Отжимания', muscle_group: 'chest', equipment: BODYWEIGHT },
	{ en: 'Chest press machine', ru: 'Жим в тренажёре', muscle_group: 'chest', equipment: MACHINE },
	{ en: 'Dips', ru: 'Отжимания на брусьях', muscle_group: 'chest', equipment: BODYWEIGHT },
	{ en: 'Pull-up', ru: 'Подтягивания', muscle_group: 'back', equipment: BODYWEIGHT },
	{ en: 'Lat pulldown', ru: 'Тяга верхнего блока', muscle_group: 'back', equipment: CABLE },
	{ en: 'Barbell row', ru: 'Тяга штанги в наклоне', muscle_group: 'back', equipment: BARBELL },
	{ en: 'Dumbbell row', ru: 'Тяга гантели в наклоне', muscle_group: 'back', equipment: DUMBBELLS },
	{ en: 'Seated cable row', ru: 'Тяга нижнего блока', muscle_group: 'back', equipment: CABLE },
	{ en: 'Deadlift', ru: 'Становая тяга', muscle_group: 'back', equipment: BARBELL },
	{ en: 'Overhead press', ru: 'Жим штанги стоя', muscle_group: 'shoulders', equipment: BARBELL },
	{
		en: 'Dumbbell shoulder press',
		ru: 'Жим гантелей сидя',
		muscle_group: 'shoulders',
		equipment: DUMBBELLS
	},
	{
		en: 'Lateral raise',
		ru: 'Махи гантелями в стороны',
		muscle_group: 'shoulders',
		equipment: DUMBBELLS
	},
	{ en: 'Face pull', ru: 'Тяга каната к лицу', muscle_group: 'shoulders', equipment: CABLE },
	{ en: 'Biceps curl', ru: 'Подъём на бицепс', muscle_group: 'arms', equipment: DUMBBELLS },
	{ en: 'Hammer curl', ru: 'Молотки', muscle_group: 'arms', equipment: DUMBBELLS },
	{
		en: 'Triceps pushdown',
		ru: 'Разгибание на трицепс в блоке',
		muscle_group: 'arms',
		equipment: CABLE
	},
	{ en: 'Skull crusher', ru: 'Французский жим', muscle_group: 'arms', equipment: BARBELL },
	{ en: 'Back squat', ru: 'Приседания со штангой', muscle_group: 'legs', equipment: BARBELL },
	{ en: 'Goblet squat', ru: 'Гоблет-присед', muscle_group: 'legs', equipment: KETTLEBELL },
	{ en: 'Leg press', ru: 'Жим ногами', muscle_group: 'legs', equipment: MACHINE },
	{ en: 'Lunges', ru: 'Выпады', muscle_group: 'legs', equipment: DUMBBELLS },
	{ en: 'Leg extension', ru: 'Разгибание ног', muscle_group: 'legs', equipment: MACHINE },
	{ en: 'Leg curl', ru: 'Сгибание ног', muscle_group: 'legs', equipment: MACHINE },
	{ en: 'Romanian deadlift', ru: 'Румынская тяга', muscle_group: 'legs', equipment: BARBELL },
	{ en: 'Calf raise', ru: 'Подъём на носки', muscle_group: 'legs', equipment: MACHINE },
	{ en: 'Hip thrust', ru: 'Ягодичный мост со штангой', muscle_group: 'glutes', equipment: BARBELL },
	{ en: 'Glute bridge', ru: 'Ягодичный мост', muscle_group: 'glutes', equipment: BODYWEIGHT },
	{ en: 'Cable kickback', ru: 'Отведение ноги в блоке', muscle_group: 'glutes', equipment: CABLE },
	{ en: 'Plank', ru: 'Планка', muscle_group: 'core', equipment: BODYWEIGHT },
	{ en: 'Crunches', ru: 'Скручивания', muscle_group: 'core', equipment: BODYWEIGHT },
	{ en: 'Hanging leg raise', ru: 'Подъём ног в висе', muscle_group: 'core', equipment: BODYWEIGHT },
	{ en: 'Russian twist', ru: 'Русский твист', muscle_group: 'core', equipment: BODYWEIGHT },
	{ en: 'Kettlebell swing', ru: 'Махи гирей', muscle_group: 'full_body', equipment: KETTLEBELL },
	{ en: 'Burpees', ru: 'Бёрпи', muscle_group: 'full_body', equipment: BODYWEIGHT },
	{
		en: 'Clean and press',
		ru: 'Взятие на грудь и жим',
		muscle_group: 'full_body',
		equipment: BARBELL
	},
	{ en: 'Rowing machine', ru: 'Гребной тренажёр', muscle_group: 'full_body', equipment: MACHINE }
];

export type ExerciseSuggestion = {
	/** Set for the user's own exercises; null for built-in suggestions. */
	id: string | null;
	name: string;
	muscle_group: MuscleGroup | null;
	equipment: string | null;
};

/** Built-in suggestions in `locale` whose name (in either language) contains `query`. */
export function builtInSuggestions(locale: 'en' | 'ru', query = ''): ExerciseSuggestion[] {
	const q = query.trim().toLocaleLowerCase();
	return BUILT_IN_EXERCISES.filter(
		(x) => !q || x.en.toLocaleLowerCase().includes(q) || x.ru.toLocaleLowerCase().includes(q)
	).map((x) => ({
		id: null,
		name: x[locale],
		muscle_group: x.muscle_group,
		equipment: x.equipment?.[locale] ?? null
	}));
}
