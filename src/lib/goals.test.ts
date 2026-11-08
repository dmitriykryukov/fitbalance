import { describe, expect, it } from 'vitest';
import { activityFactor, bmrMifflinStJeor, suggestTargets } from './goals.js';

const base = { ageYears: 30, heightCm: 165, weightKg: 65 } as const;

describe('bmrMifflinStJeor', () => {
	it('matches the published formula for each sex', () => {
		expect(bmrMifflinStJeor({ ...base, sex: 'female' })).toBeCloseTo(1370.25);
		expect(bmrMifflinStJeor({ ...base, sex: 'male' })).toBeCloseTo(1536.25);
		expect(bmrMifflinStJeor({ ...base, sex: null })).toBeCloseTo(1453.25);
	});
});

describe('activityFactor', () => {
	it('steps up with weekly minutes and defaults to light', () => {
		expect(activityFactor(null)).toBe(1.375);
		expect(activityFactor(0)).toBe(1.2);
		expect(activityFactor(150)).toBe(1.55);
		expect(activityFactor(300)).toBe(1.725);
	});
});

describe('suggestTargets', () => {
	const input = {
		...base,
		sex: 'female' as const,
		fitnessGoal: 'maintain' as const,
		weeklyActivityMinutes: null
	};

	it('rounds maintenance calories and splits macros that add up', () => {
		const s = suggestTargets(input);
		expect(s.maintenance_kcal).toBe(1884);
		expect(s.calories_kcal).toBe(1880);
		expect(s.protein_g).toBe(105); // 1.6 g/kg × 65 kg = 104 → 105
		expect(s.fat_g).toBe(55); // 27 % of 1880 / 9 = 56.4 → 55
		const kcalFromMacros = s.protein_g * 4 + s.carbs_g * 4 + s.fat_g * 9;
		expect(Math.abs(kcalFromMacros - s.calories_kcal)).toBeLessThanOrEqual(30);
	});

	it('applies a 20 % deficit for fat loss but never below the floor', () => {
		expect(suggestTargets({ ...input, fitnessGoal: 'lose_fat' }).calories_kcal).toBe(1510);
		const small = { ...input, heightCm: 150, weightKg: 45, ageYears: 70 };
		expect(suggestTargets({ ...small, fitnessGoal: 'lose_fat' }).calories_kcal).toBe(1200);
	});

	it('adds a surplus and more protein for muscle gain', () => {
		const s = suggestTargets({ ...input, fitnessGoal: 'build_muscle' });
		expect(s.calories_kcal).toBe(2070);
		expect(s.protein_g).toBe(115); // 1.8 × 65 = 117 → 115
	});

	it('caps protein at 35 % of calories for heavy users', () => {
		const s = suggestTargets({ ...input, weightKg: 200, fitnessGoal: 'lose_fat' });
		expect(s.protein_g * 4).toBeLessThanOrEqual(s.calories_kcal * 0.35 + 10);
		expect(s.carbs_g).toBeGreaterThanOrEqual(0);
	});
});
