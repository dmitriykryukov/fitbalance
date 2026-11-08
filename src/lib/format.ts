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

/** Wall-clock time of `iso` in `timeZone`: "8:10 AM" (en) / "08:10" (ru). */
export function formatTime(iso: string, timeZone: string, locale = getLocale()): string {
	return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
		hour: 'numeric',
		minute: '2-digit',
		timeZone
	}).format(new Date(iso));
}

/** "2026-11-05" → "Thu, Nov 5" / "чт, 5 нояб." */
export function formatShortDate(localDate: string, locale = getLocale()): string {
	const [y, mo, d] = localDate.split('-').map(Number);
	return new Intl.DateTimeFormat(intlLocale(locale), {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	}).format(new Date(Date.UTC(y, mo - 1, d)));
}
