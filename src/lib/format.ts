import { getLocale } from '#lib/paraglide/runtime.js';

const intlLocale = (locale: string) => (locale === 'ru' ? 'ru-RU' : 'en-CA');

/** 1250 → "1,250" (en) / "1 250" (ru). */
export function formatNumber(
	value: number,
	maximumFractionDigits = 0,
	locale = getLocale()
): string {
	return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits }).format(value);
}

/** "2026-11-07" → "Saturday, November 7" / "суббота, 7 ноября". Treats the date as a calendar day. */
export function formatLongDate(localDate: string, locale = getLocale()): string {
	const [y, mo, d] = localDate.split('-').map(Number);
	return new Intl.DateTimeFormat(intlLocale(locale), {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		timeZone: 'UTC'
	}).format(new Date(Date.UTC(y, mo - 1, d)));
}
