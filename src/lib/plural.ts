import { getLocale } from '#lib/paraglide/runtime.js';
import { m } from '#lib/paraglide/messages.js';
import { formatNumber } from './format.js';

type Forms = Record<'one' | 'few' | 'many' | 'other', (args: { count: string }) => string>;

/** Picks the plural form for `count` with Intl.PluralRules ("1 продукт / 2 продукта / 5 продуктов"). */
export function plural(count: number, forms: Forms, locale = getLocale()): string {
	const rule = new Intl.PluralRules(locale).select(count);
	const form = rule === 'one' || rule === 'few' || rule === 'many' ? rule : 'other';
	return forms[form]({ count: formatNumber(count, 1, locale) });
}

export const countItems = (n: number) =>
	plural(n, {
		one: m.count_items_one,
		few: m.count_items_few,
		many: m.count_items_many,
		other: m.count_items_other
	});

export const countExercises = (n: number) =>
	plural(n, {
		one: m.count_exercises_one,
		few: m.count_exercises_few,
		many: m.count_exercises_many,
		other: m.count_exercises_other
	});

export const countSets = (n: number) =>
	plural(n, {
		one: m.count_sets_one,
		few: m.count_sets_few,
		many: m.count_sets_many,
		other: m.count_sets_other
	});
