/** Earliest diary date the API accepts. */
export const MIN_LOCAL_DATE = '2000-01-01';

/** True when `timeZone` is an IANA name the runtime understands (e.g. "Europe/Berlin"). */
export function isValidTimeZone(timeZone: string): boolean {
	if (!timeZone) return false;
	try {
		new Intl.DateTimeFormat('en', { timeZone });
		return true;
	} catch {
		return false;
	}
}

/** The calendar date (YYYY-MM-DD) at `at` in `timeZone`. */
export function localDate(timeZone: string, at: Date = new Date()): string {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(at);
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
	return `${get('year')}-${get('month')}-${get('day')}`;
}

function toUtc(date: string): Date {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d));
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
	const d = toUtc(date);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
	return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

/** Age in whole years on `onDate`. */
export function ageOn(dateOfBirth: string, onDate: string): number {
	const [by, bm, bd] = dateOfBirth.split('-').map(Number);
	const [y, m, d] = onDate.split('-').map(Number);
	let age = y - by;
	if (m < bm || (m === bm && d < bd)) age -= 1;
	return age;
}
