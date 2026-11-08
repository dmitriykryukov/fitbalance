import { describe, expect, it } from 'vitest';
import { GoalsInput, MeasurementCreate, ProfilePatch } from './profile.js';

describe('ProfilePatch', () => {
	it('rejects a user_id smuggled into the body', () => {
		expect(ProfilePatch.safeParse({ display_name: 'A', user_id: 'x' }).success).toBe(false);
	});

	it('rejects empty patches, bad time zones and onboarded:false', () => {
		expect(ProfilePatch.safeParse({}).success).toBe(false);
		expect(ProfilePatch.safeParse({ timezone: 'Mars/Base' }).success).toBe(false);
		expect(ProfilePatch.safeParse({ onboarded: false }).success).toBe(false);
	});

	it('de-duplicates activity preferences', () => {
		const r = ProfilePatch.parse({ activity_preferences: ['gym', 'gym', 'running'] });
		expect(r.activity_preferences).toEqual(['gym', 'running']);
	});
});

describe('GoalsInput', () => {
	it('fills omitted targets with null (full replacement)', () => {
		expect(GoalsInput.parse({ calories_kcal: 2000 })).toMatchObject({
			calories_kcal: 2000,
			protein_g: null,
			fitness_goal: null
		});
	});

	it('enforces database ranges', () => {
		expect(GoalsInput.safeParse({ calories_kcal: 300 }).success).toBe(false);
		expect(GoalsInput.safeParse({ calories_kcal: 2000.5 }).success).toBe(false);
	});
});

describe('MeasurementCreate', () => {
	it('needs weight or waist', () => {
		expect(MeasurementCreate.safeParse({ local_date: '2026-11-07' }).success).toBe(false);
		expect(MeasurementCreate.safeParse({ local_date: '2026-11-07', waist_cm: 80 }).success).toBe(
			true
		);
	});

	it('rejects dates before 2000', () => {
		expect(MeasurementCreate.safeParse({ local_date: '1999-12-31', weight_kg: 70 }).success).toBe(
			false
		);
	});
});
