import { describe, expect, it } from 'vitest';
import {
	itemTotals,
	macroStatus,
	mealTypeForHour,
	round1,
	scaleGrams,
	sumTotals,
	type Per100g
} from './nutrition.js';

const eggs: Per100g = { kcal: 196, protein_g: 13.6, carbs_g: 0.8, fat_g: 15.3, fibre_g: 0 };

describe('round1', () => {
	it('rounds half away from zero without float noise', () => {
		expect(round1(0.15)).toBe(0.2);
		expect(round1(1.05)).toBe(1.1);
		expect(round1(2.25)).toBe(2.3);
		expect(round1(1.04999)).toBe(1);
		expect(round1(-1.25)).toBe(-1.3);
	});
});

describe('itemTotals (matches the meal_items generated columns)', () => {
	it('scales per-100 g values by grams', () => {
		expect(itemTotals(eggs, 100)).toEqual(eggs);
		expect(itemTotals(eggs, 50)).toEqual({
			kcal: 98,
			protein_g: 6.8,
			carbs_g: 0.4,
			fat_g: 7.7, // 7.65 → 7.7 (Postgres rounds half away from zero)
			fibre_g: 0
		});
	});

	it('rounds inputs to one decimal first, like numeric(…, 1)', () => {
		// grams 33.35 is stored as 33.4; 13.6 × 33.4 / 100 = 4.5424 → 4.5
		expect(itemTotals(eggs, 33.35).protein_g).toBe(4.5);
		// 0.05 per 100 g is stored as 0.1; 0.1 × 150 / 100 = 0.15 → 0.2
		expect(itemTotals({ ...eggs, carbs_g: 0.05 }, 150).carbs_g).toBe(0.2);
	});

	it('cases where naive floating point would be off', () => {
		// 13.6 × 125 / 100 = 17 exactly (float: 16.999999999999996)
		expect(itemTotals(eggs, 125).protein_g).toBe(17);
		// 1.1 × 15 / 100 = 0.165 → 0.2
		expect(itemTotals({ ...eggs, fat_g: 1.1 }, 15).fat_g).toBe(0.2);
	});

	it('keeps unknown fibre as null', () => {
		expect(itemTotals({ ...eggs, fibre_g: null }, 80).fibre_g).toBeNull();
	});
});

describe('sumTotals', () => {
	it('adds without drift and keeps fibre null when nobody has it', () => {
		const parts = [
			{ kcal: 0.1, protein_g: 0.2, carbs_g: 0.7, fat_g: 0.1, fibre_g: null },
			{ kcal: 0.2, protein_g: 0.1, carbs_g: 0.6, fat_g: 0.2, fibre_g: null }
		];
		expect(sumTotals(parts)).toEqual({
			kcal: 0.3,
			protein_g: 0.3,
			carbs_g: 1.3,
			fat_g: 0.3,
			fibre_g: null
		});
	});

	it('sums fibre over the items that have it', () => {
		const total = sumTotals([
			{ kcal: 10, protein_g: 1, carbs_g: 1, fat_g: 1, fibre_g: 1.5 },
			{ kcal: 10, protein_g: 1, carbs_g: 1, fat_g: 1, fibre_g: null }
		]);
		expect(total.fibre_g).toBe(1.5);
		expect(sumTotals([]).kcal).toBe(0);
	});
});

describe('scaleGrams', () => {
	it('keeps grams per unit', () => {
		expect(scaleGrams(100, 2, 3)).toBe(150);
		expect(scaleGrams(250, 1, 0.5)).toBe(125);
		expect(scaleGrams(100, 3, 1)).toBe(33.3);
		expect(scaleGrams(100, 0, 2)).toBe(100);
	});
});

describe('mealTypeForHour', () => {
	it('maps the time of day to a meal type', () => {
		expect([7, 12, 19, 23, 2].map(mealTypeForHour)).toEqual([
			'breakfast',
			'lunch',
			'dinner',
			'snack',
			'snack'
		]);
	});
});

describe('macroStatus', () => {
	it('is over above 110 %, on track within 90–110 %, otherwise under', () => {
		expect(macroStatus([{ value: 170, target: 150 }])).toBe('over');
		expect(
			macroStatus([
				{ value: 140, target: 150 },
				{ value: 60, target: 65 }
			])
		).toBe('on_track');
		expect(macroStatus([{ value: 60, target: 150 }])).toBe('under');
		expect(macroStatus([{ value: 60, target: null }])).toBeNull();
	});
});
