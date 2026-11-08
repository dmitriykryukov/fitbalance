import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { localDate } from '../../src/lib/dates.js';
import { itemTotals, sumTotals } from '../../src/lib/nutrition.js';
import * as dashboard from '../../src/routes/api/dashboard/+server.js';
import * as food from '../../src/routes/api/foods/[id]/+server.js';
import * as foods from '../../src/routes/api/foods/+server.js';
import * as goals from '../../src/routes/api/goals/+server.js';
import * as meal from '../../src/routes/api/meals/[id]/+server.js';
import * as meals from '../../src/routes/api/meals/+server.js';
import { call, createTestUser, deleteTestUser, type TestUser } from './helpers.js';

// Goals take effect from the user's today (profile time zone defaults to UTC).
const DAY = localDate('UTC');
const oatsPer100 = { kcal: 71, protein_g: 2.5, carbs_g: 12, fat_g: 1.5, fibre_g: 1.7 };
const berriesPer100 = { kcal: 57, protein_g: 0.7, carbs_g: 14.5, fat_g: 0.3, fibre_g: null };

let a: TestUser;
let b: TestUser;
let oatsId: string;
let bFoodId: string;
let mealId: string;

const breakfast = (items: unknown[], extra: Record<string, unknown> = {}) => ({
	local_date: DAY,
	logged_at: `${DAY}T08:15:00+01:00`,
	meal_type: 'breakfast',
	items,
	...extra
});
const oatsItem = (grams: number) => ({
	name: 'Oatmeal',
	quantity: 1,
	unit: 'bowl',
	grams,
	nutrition_per_100g: oatsPer100,
	estimate_source: 'my_food',
	food_item_id: oatsId
});
const berriesItem = {
	name: 'Blueberries',
	grams: 80,
	nutrition_per_100g: berriesPer100,
	estimate_source: 'user_entered',
	save_to_my_foods: true
};

async function foodsOf(user: TestUser, query = '') {
	const res = await call(foods.GET, user, { url: `/api/foods?query=${encodeURIComponent(query)}` });
	return res.body.data.foods as {
		id: string;
		name: string;
		use_count: number;
		kcal_per_100g: number;
	}[];
}

async function mealsOn(user: TestUser, date = DAY) {
	const res = await call(meals.GET, user, { url: `/api/meals?date=${date}` });
	return res.body.data.meals as { id: string }[];
}

beforeAll(async () => {
	[a, b] = await Promise.all([createTestUser('na'), createTestUser('nb')]);

	const created = await call(foods.POST, a, {
		body: {
			name: 'Oatmeal',
			kcal_per_100g: 71,
			protein_per_100g: 2.5,
			carbs_per_100g: 12,
			fat_per_100g: 1.5,
			fibre_per_100g: 1.7,
			serving_description: '1 bowl',
			serving_grams: 250
		}
	});
	expect(created.status).toBe(201);
	oatsId = created.body.data.food.id;

	const other = await call(foods.POST, b, {
		body: {
			name: 'Гречка',
			kcal_per_100g: 110,
			protein_per_100g: 4.2,
			carbs_per_100g: 21.3,
			fat_per_100g: 1.1
		}
	});
	expect(other.status).toBe(201);
	bFoodId = other.body.data.food.id;

	const goal = await call(goals.PUT, a, { body: { calories_kcal: 2000, protein_g: 120 } });
	expect(goal.status).toBe(200);
});

afterAll(async () => {
	await Promise.all([deleteTestUser(a), deleteTestUser(b)]);
});

describe('without a session', () => {
	it('answers 401', async () => {
		for (const handler of [meals.GET, foods.GET, dashboard.GET]) {
			expect((await call(handler, null)).status).toBe(401);
		}
		expect((await call(meal.GET, null, { params: { id: crypto.randomUUID() } })).status).toBe(401);
	});
});

describe('creating a meal', () => {
	it('saves the meal and items; the database calculates totals', async () => {
		const res = await call(meals.POST, a, { body: breakfast([oatsItem(250), berriesItem]) });
		expect(res.status).toBe(201);
		const saved = res.body.data.meal;
		mealId = saved.id;

		expect(saved.items.map((i: { name: string }) => i.name)).toEqual(['Oatmeal', 'Blueberries']);
		const expected = sumTotals([itemTotals(oatsPer100, 250), itemTotals(berriesPer100, 80)]);
		expect(saved.totals).toEqual(expected);
		expect(saved.items[0]).toMatchObject({ kcal: 177.5, protein_g: 6.3, food_item_id: oatsId });
		expect(saved.items[1].fibre_g).toBeNull();
		expect(saved.has_ai_estimates).toBe(false);
	});

	it('updates My foods: counts the use and saves new foods', async () => {
		const list = await foodsOf(a);
		const oats = list.find((f) => f.name === 'Oatmeal');
		const berries = list.find((f) => f.name === 'Blueberries');
		expect(oats?.use_count).toBe(1);
		expect(berries).toMatchObject({ use_count: 1, kcal_per_100g: 57 });
		expect((await foodsOf(a, 'blue')).map((f) => f.name)).toEqual(['Blueberries']);
	});

	it('finds Cyrillic names case-insensitively', async () => {
		expect((await foodsOf(b, 'гРеч')).map((f) => f.name)).toEqual(['Гречка']);
		expect(await foodsOf(b, '100%_*"')).toEqual([]);
	});

	it('rejects client totals, unknown fields, bad item counts and future dates', async () => {
		const withTotals = await call(meals.POST, a, {
			body: breakfast([{ ...berriesItem, kcal: 10 }])
		});
		expect(withTotals.status).toBe(422);
		expect(withTotals.body.error.fields).toHaveProperty('items.0');

		const smuggled = await call(meals.POST, a, {
			body: breakfast([berriesItem], { user_id: b.id })
		});
		expect(smuggled.status).toBe(422);

		expect((await call(meals.POST, a, { body: breakfast([]) })).status).toBe(422);
		const tooMany = Array.from({ length: 31 }, () => berriesItem);
		expect((await call(meals.POST, a, { body: breakfast(tooMany) })).status).toBe(422);

		const future = await call(meals.POST, a, {
			body: breakfast([berriesItem], { local_date: '2099-01-01', logged_at: null })
		});
		expect(future.status).toBe(422);
	});

	it("is atomic: an item pointing at another user's food saves nothing", async () => {
		const before = await mealsOn(a);
		const res = await call(meals.POST, a, {
			body: breakfast([berriesItem, { ...oatsItem(100), food_item_id: bFoodId }])
		});
		expect(res.status).toBe(422);
		expect(await mealsOn(a)).toHaveLength(before.length);
		// The first item's My foods upsert was rolled back too.
		expect((await foodsOf(a, 'blue'))[0].use_count).toBe(1);
	});

	it('never lets AI estimates overwrite values the user typed', async () => {
		const res = await call(meals.POST, a, {
			body: {
				local_date: DAY,
				meal_type: 'snack',
				input_method: 'ai',
				ai_description: 'a bowl of oatmeal',
				items: [
					{
						name: ' oatmeal ',
						grams: 200,
						nutrition_per_100g: { ...oatsPer100, kcal: 120 },
						estimate_source: 'ai_estimate',
						confidence: 0.7
					}
				]
			}
		});
		expect(res.status).toBe(201);
		expect(res.body.data.meal.items[0].food_item_id).toBe(oatsId);
		expect(res.body.data.meal.has_ai_estimates).toBe(true);
		const oats = (await foodsOf(a, 'oat'))[0];
		expect(oats).toMatchObject({ kcal_per_100g: 71, use_count: 2 });
	});
});

describe('Today dashboard', () => {
	it('matches the daily_nutrition view; unlogged meal types are not 0 kcal', async () => {
		const res = await call(dashboard.GET, a, { url: `/api/dashboard?date=${DAY}` });
		expect(res.status).toBe(200);
		const data = res.body.data;

		const view = await a.client.from('daily_nutrition').select('*').eq('local_date', DAY).single();
		expect(data.nutrition).toMatchObject({
			logged: true,
			kcal: view.data!.kcal,
			protein_g: view.data!.protein_g,
			has_ai_estimates: true
		});
		expect(data.nutrition.kcal_left).toBe(2000 - Math.round(view.data!.kcal!));

		const byType = Object.fromEntries(
			data.meals.map((x: { meal_type: string }) => [x.meal_type, x])
		);
		expect(byType.breakfast).toMatchObject({
			logged: true,
			item_names: ['Oatmeal', 'Blueberries']
		});
		expect(byType.lunch).toEqual({ meal_type: 'lunch', logged: false });
		expect(byType.dinner).toEqual({ meal_type: 'dinner', logged: false });
		expect(data.activity).toMatchObject({ gym_minutes: null, steps: null, latest: null });
	});

	it('a day without meals is "not logged", not zero data', async () => {
		const res = await call(dashboard.GET, a, { url: '/api/dashboard?date=2026-10-01' });
		expect(res.body.data.nutrition).toMatchObject({ logged: false, kcal: 0 });
	});
});

describe('replacing and deleting', () => {
	it('PUT replaces fields and items in one go', async () => {
		const res = await call(meal.PUT, a, {
			params: { id: mealId },
			body: breakfast([oatsItem(125)], { meal_type: 'lunch', notes: 'half portion' })
		});
		expect(res.status).toBe(200);
		expect(res.body.data.meal).toMatchObject({ meal_type: 'lunch', notes: 'half portion' });
		expect(res.body.data.meal.items).toHaveLength(1);
		expect(res.body.data.meal.totals.kcal).toBe(itemTotals(oatsPer100, 125).kcal);
	});

	it("B cannot see, replace or delete A's meal or food (404)", async () => {
		expect(await mealsOn(b)).toEqual([]);
		expect((await call(meal.GET, b, { params: { id: mealId } })).status).toBe(404);
		const put = await call(meal.PUT, b, {
			params: { id: mealId },
			body: breakfast([berriesItem])
		});
		expect(put.status).toBe(404);
		expect((await call(meal.DELETE, b, { params: { id: mealId } })).status).toBe(404);
		expect((await call(meal.GET, a, { params: { id: 'not-a-uuid' } })).status).toBe(404);

		expect(
			(await call(food.PATCH, b, { params: { id: oatsId }, body: { kcal_per_100g: 1 } })).status
		).toBe(404);
		expect((await call(food.DELETE, b, { params: { id: oatsId } })).status).toBe(404);
		expect((await foodsOf(b)).map((f) => f.name)).toEqual(['Гречка']);
		// A's meal is unchanged.
		expect((await call(meal.GET, a, { params: { id: mealId } })).body.data.meal.notes).toBe(
			'half portion'
		);
	});

	it('deleting a food keeps the meal snapshot', async () => {
		expect((await call(food.DELETE, a, { params: { id: oatsId } })).status).toBe(204);
		const kept = (await call(meal.GET, a, { params: { id: mealId } })).body.data.meal;
		expect(kept.items[0]).toMatchObject({ name: 'Oatmeal', food_item_id: null, kcal_per_100g: 71 });
	});

	it('deleting a meal removes its items', async () => {
		expect((await call(meal.DELETE, a, { params: { id: mealId } })).status).toBe(204);
		expect((await call(meal.GET, a, { params: { id: mealId } })).status).toBe(404);
		const items = await a.client.from('meal_items').select('id').eq('meal_id', mealId);
		expect(items.data).toEqual([]);
	});
});
