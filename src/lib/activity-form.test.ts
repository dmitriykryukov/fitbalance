import { describe, expect, it } from 'vitest';
import {
	cardioToInput,
	emptyCardioDraft,
	emptyStrengthDraft,
	newExercise,
	parseDistanceKm,
	previewKcal,
	strengthDraftFromSaved,
	strengthToInput
} from './activity-form.js';
import { ActivityInput, WorkoutInput } from './schemas/activity.js';

const TZ = 'Europe/Berlin';

describe('cardioToInput', () => {
	it('builds a valid run with metres, seconds and a zoned start time', () => {
		const draft = {
			...emptyCardioDraft('running', '2026-11-09', '07:30'),
			duration: '44:00',
			distance: '7,2'
		};
		const { input, errors } = cardioToInput(draft, TZ);
		expect(errors).toEqual({});
		expect(input).toMatchObject({
			activity_type: 'running',
			duration_seconds: 2640,
			distance_meters: 7200,
			started_at: '2026-11-09T07:30:00+01:00',
			active_kcal: null,
			steps: null
		});
		expect(ActivityInput.safeParse(input).success).toBe(true);
	});

	it('needs a duration, and a title for other activities', () => {
		const { input, errors } = cardioToInput(emptyCardioDraft('other', '2026-11-09', ''), TZ);
		expect(input).toBeNull();
		expect(Object.keys(errors).sort()).toEqual(['duration', 'title']);
	});

	it('sends the typed kcal only when the user edited it', () => {
		const base = {
			...emptyCardioDraft('walking', '2026-11-09', ''),
			duration: '30',
			steps: '4000'
		};
		expect(cardioToInput({ ...base, kcal: '150' }, TZ).input?.active_kcal).toBeNull();
		expect(cardioToInput({ ...base, kcal: '150', kcalEdited: true }, TZ).input?.active_kcal).toBe(
			150
		);
		expect(cardioToInput({ ...base, kcal: '1.5', kcalEdited: true }, TZ).errors.kcal).toBeDefined();
	});

	it('rejects unreadable distances and durations', () => {
		const draft = {
			...emptyCardioDraft('cycling', '2026-11-09', ''),
			duration: '1:75',
			distance: 'ten'
		};
		expect(Object.keys(cardioToInput(draft, TZ).errors).sort()).toEqual(['distance', 'duration']);
	});
});

describe('strengthToInput', () => {
	const bench = () =>
		newExercise({ id: null, name: 'Bench press', muscle_group: 'chest', equipment: 'Barbell' });

	it('drops empty set rows and keeps exercise order', () => {
		const ex = bench();
		ex.sets = [
			{ key: 'a', kg: '60', reps: '10' },
			{ key: 'b', kg: '', reps: '' },
			{ key: 'c', kg: '', reps: '12' }
		];
		const draft = {
			...emptyStrengthDraft('2026-11-09', '', 'Push'),
			duration: '45',
			exercises: [ex]
		};
		const { input, errors } = strengthToInput(draft, TZ);
		expect(errors).toEqual({});
		expect(input?.exercises[0].sets).toEqual([
			{ reps: 10, weight_kg: 60 },
			{ reps: 12, weight_kg: null }
		]);
		expect(input?.duration_seconds).toBe(2700);
		expect(WorkoutInput.safeParse(input).success).toBe(true);
	});

	it('flags a workout without exercises, an exercise without sets and bad reps', () => {
		expect(
			strengthToInput(emptyStrengthDraft('2026-11-09', '', 'Push'), TZ).errors.exercises
		).toBeDefined();

		const empty = bench();
		empty.sets = [{ key: 'x', kg: '', reps: '' }];
		const bad = bench();
		bad.sets = [{ key: 'y', kg: '-5', reps: '0' }];
		const { errors } = strengthToInput(
			{ ...emptyStrengthDraft('2026-11-09', '', 'Push'), exercises: [empty, bad] },
			TZ
		);
		expect(errors[empty.key]).toBeDefined();
		expect(errors['y.reps']).toBeDefined();
		expect(errors['y.kg']).toBeDefined();
	});

	it('round-trips a saved workout, keeping a user kcal value', () => {
		const draft = strengthDraftFromSaved(
			{
				title: 'Legs',
				local_date: '2026-11-08',
				started_at: '2026-11-08T17:05:00Z',
				duration_seconds: 3600,
				estimated_kcal_burned: 300,
				kcal_source: 'user',
				notes: null,
				exercises: [
					{
						name: 'Back squat',
						exercise_id: '6f1c1f43-6d0a-4a39-9d55-1f6c2f2f6a10',
						muscle_group: 'legs',
						equipment: 'Barbell',
						sets: [{ reps: 5, weight_kg: 100 }]
					}
				]
			},
			TZ
		);
		expect(draft).toMatchObject({ time: '18:05', duration: '60', kcal: '300', kcalEdited: true });
		const { input } = strengthToInput(draft, TZ);
		expect(input).toMatchObject({ active_kcal: 300, started_at: '2026-11-08T18:05:00+01:00' });
	});
});

describe('previewKcal and parseDistanceKm', () => {
	it('shows the MET estimate until the user types a value', () => {
		const draft = { ...emptyCardioDraft('running', '2026-11-09', ''), duration: '44' };
		const estimate = {
			type: 'running' as const,
			durationSeconds: 2640,
			distanceMeters: 7200,
			weightKg: 72
		};
		expect(previewKcal(draft, estimate)).toEqual({ value: 517, estimated: true });
		expect(previewKcal({ ...draft, kcal: '480', kcalEdited: true }, estimate)).toEqual({
			value: 480,
			estimated: false
		});
		expect(previewKcal(draft, { ...estimate, weightKg: null })).toEqual({
			value: null,
			estimated: true
		});
	});

	it('converts km text to metres', () => {
		expect(parseDistanceKm('5')).toBe(5000);
		expect(parseDistanceKm('7,25')).toBe(7250);
		expect(parseDistanceKm('')).toBeNull();
		expect(parseDistanceKm('abc')).toBeUndefined();
		expect(parseDistanceKm('2000')).toBeUndefined();
	});
});
