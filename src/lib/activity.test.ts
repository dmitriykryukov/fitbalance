import { describe, expect, it } from 'vitest';
import {
	durationToInput,
	estimateActiveKcal,
	formatDuration,
	metFor,
	paceSecondsPerKm,
	parseDuration,
	speedKmh
} from './activity.js';
import { builtInSuggestions } from './exercises.js';

describe('pace and speed', () => {
	it('computes pace in seconds per km', () => {
		// 7.2 km in 44:00 → 6:07 min/km
		expect(paceSecondsPerKm(7200, 2640)).toBe(367);
		expect(formatDuration(367)).toBe('6:07');
		expect(paceSecondsPerKm(null, 2640)).toBeNull();
		expect(paceSecondsPerKm(0, 2640)).toBeNull();
	});

	it('rounds speed like the database column (2 decimals)', () => {
		expect(speedKmh(7200, 2640)).toBe(9.82);
		expect(speedKmh(20_000, 3600)).toBe(20);
		expect(speedKmh(null, 3600)).toBeNull();
	});
});

describe('durations', () => {
	it('reads minutes, m:ss and h:mm:ss', () => {
		expect(parseDuration('45')).toBe(2700);
		expect(parseDuration('45,5')).toBe(2730);
		expect(parseDuration('44:30')).toBe(2670);
		expect(parseDuration('1:05:00')).toBe(3900);
		expect(parseDuration('')).toBeUndefined();
		expect(parseDuration('0')).toBeNull();
		expect(parseDuration('10:75')).toBeNull();
		expect(parseDuration('abc')).toBeNull();
	});

	it('formats for display and for inputs', () => {
		expect(formatDuration(3725)).toBe('1:02:05');
		expect(durationToInput(2700)).toBe('45');
		expect(durationToInput(2670)).toBe('44:30');
		expect(durationToInput(null)).toBe('');
	});
});

describe('active kcal (MET × kg × h)', () => {
	it('picks MET by speed', () => {
		expect(metFor('running', 9.82)).toBe(9.8);
		expect(metFor('running', null)).toBe(9.8);
		expect(metFor('walking', 5)).toBe(3.5);
		expect(metFor('cycling', 20)).toBe(8);
		expect(metFor('strength', null)).toBe(3.5);
	});

	it('estimates whole kcal from weight and duration', () => {
		// 9.8 × 70 kg × 44/60 h = 503.07
		expect(
			estimateActiveKcal({
				type: 'running',
				durationSeconds: 2640,
				distanceMeters: 7200,
				weightKg: 70
			})
		).toBe(503);
		// 3.5 × 80 kg × 0.75 h = 210
		expect(estimateActiveKcal({ type: 'strength', durationSeconds: 2700, weightKg: 80 })).toBe(210);
	});

	it('never guesses a weight or a duration', () => {
		expect(
			estimateActiveKcal({ type: 'walking', durationSeconds: 1800, weightKg: null })
		).toBeNull();
		expect(
			estimateActiveKcal({ type: 'strength', durationSeconds: null, weightKg: 80 })
		).toBeNull();
	});
});

describe('built-in exercises', () => {
	it('searches both languages and answers in the UI language', () => {
		const ru = builtInSuggestions('ru', 'bench');
		expect(ru[0]).toMatchObject({
			id: null,
			name: 'Жим лёжа',
			muscle_group: 'chest',
			equipment: 'Штанга'
		});
		expect(builtInSuggestions('en', 'присед')[0].name).toBe('Back squat');
		expect(builtInSuggestions('en').length).toBeGreaterThan(30);
	});
});
