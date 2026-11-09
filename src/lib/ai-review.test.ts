import { describe, expect, it } from 'vitest';
import {
	editDetails,
	needsGrams,
	quantityStep,
	reviewItemFromDraft,
	reviewItemFromParse,
	setGrams,
	stepQuantity,
	useSavedValues
} from './ai-review.js';
import { draftToInput } from './meal-form.js';
import type { FoodParseItem } from './schemas/food-parse.js';

const eggs: FoodParseItem = {
	name: 'Fried eggs',
	quantity: 2,
	unit: 'piece',
	grams: 100,
	preparation: 'fried',
	is_assumption: false,
	nutrition_per_100g: { kcal: 196, protein_g: 13.6, carbs_g: 0.8, fat_g: 15.3, fibre_g: 0 },
	confidence: 0.85,
	uncertainties: ['Medium eggs assumed.'],
	warnings: [],
	my_food_match: {
		id: '00000000-0000-4000-8000-000000000001',
		name: 'fried eggs',
		brand: null,
		nutrition_per_100g: { kcal: 180, protein_g: 13, carbs_g: 1, fat_g: 14, fibre_g: null }
	},
	preview: null
};

describe('quantityStep', () => {
	it('fits the size of the quantity', () => {
		expect(quantityStep(200)).toBe(10);
		expect(quantityStep(2)).toBe(1);
		expect(quantityStep(1)).toBe(0.5);
	});
});

describe('review items', () => {
	it('starts as an AI estimate with grams per unit', () => {
		const item = reviewItemFromParse(eggs);
		expect(item).toMatchObject({
			grams: '100',
			gramsPerUnit: 50,
			step: 1,
			estimate_source: 'ai_estimate',
			notes: 'Medium eggs assumed.'
		});
	});

	it('has no stepper when the AI could not estimate grams', () => {
		const item = reviewItemFromParse({ ...eggs, grams: null });
		expect(item.grams).toBe('');
		expect(item.gramsPerUnit).toBeNull();
		expect(needsGrams(item)).toBe(true);
	});

	it('scales grams with the stepper and marks the item edited', () => {
		let item = reviewItemFromParse(eggs);
		item = stepQuantity(item, 1);
		expect(item).toMatchObject({ quantity: 3, grams: '150', estimate_source: 'ai_edited' });
		item = stepQuantity(stepQuantity(stepQuantity(item, -1), -1), -1);
		expect(item.quantity).toBe(1); // never below one step
	});

	it('keeps the quantity in line with grams typed directly', () => {
		const item = setGrams(reviewItemFromParse(eggs), '125');
		expect(item.quantity).toBe(2.5);
		expect(item.estimate_source).toBe('ai_edited');
	});

	it('uses saved values from My foods, keeping the grams', () => {
		const item = useSavedValues(reviewItemFromParse(eggs));
		expect(item).toMatchObject({
			name: 'fried eggs',
			grams: '100',
			estimate_source: 'my_food',
			food_item_id: eggs.my_food_match!.id
		});
		// Changing the amount of a saved food keeps it a saved food.
		expect(stepQuantity(item, 1).estimate_source).toBe('my_food');
	});

	it('edited details become ai_edited, or user_entered for saved foods', () => {
		const per100 = { kcal: 150, protein_g: 12, carbs_g: 1, fat_g: 11, fibre_g: null };
		expect(editDetails(reviewItemFromParse(eggs), 'Eggs', per100).estimate_source).toBe(
			'ai_edited'
		);
		const saved = editDetails(useSavedValues(reviewItemFromParse(eggs)), 'Eggs', per100);
		expect(saved).toMatchObject({ estimate_source: 'user_entered', food_item_id: null });
	});

	it('My foods added on the review screen keep their link', () => {
		const item = reviewItemFromDraft({
			key: 'x',
			name: 'Oatmeal',
			quantity: 1,
			unit: 'bowl',
			grams: '250',
			per100: eggs.nutrition_per_100g,
			estimate_source: 'my_food',
			confidence: null,
			notes: null,
			food_item_id: eggs.my_food_match!.id
		});
		expect(item).toMatchObject({ gramsPerUnit: 250, estimate_source: 'my_food' });
	});

	it('builds an AI meal request and blocks saving without grams', () => {
		const ok = reviewItemFromParse(eggs);
		const missing = reviewItemFromParse({ ...eggs, grams: null });
		const draft = {
			meal_type: 'breakfast' as const,
			local_date: '2026-11-09',
			time: '08:30',
			notes: '',
			input_method: 'ai' as const,
			ai_description: 'Two fried eggs',
			items: [ok, missing]
		};
		const blocked = draftToInput(draft, 'Europe/Berlin');
		expect(blocked.input).toBeNull();
		expect(blocked.errors).toHaveProperty(`items.${missing.key}`);

		const { input } = draftToInput({ ...draft, items: [ok] }, 'Europe/Berlin');
		expect(input).toMatchObject({
			input_method: 'ai',
			ai_description: 'Two fried eggs',
			items: [{ name: 'Fried eggs', grams: 100, estimate_source: 'ai_estimate', quantity: 2 }]
		});
	});
});
