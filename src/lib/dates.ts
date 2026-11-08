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

/** Minutes east of UTC for `timeZone` at instant `at` (e.g. Europe/Berlin in winter → 60). */
export function timeZoneOffsetMinutes(timeZone: string, at: Date): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).formatToParts(at);
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
	const asUtc = Date.UTC(
		get('year'),
		get('month') - 1,
		get('day'),
		get('hour'),
		get('minute'),
		get('second')
	);
	return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

/** "HH:MM" wall-clock time of `at` in `timeZone`. */
export function localTime(timeZone: string, at: Date = new Date()): string {
	return new Intl.DateTimeFormat('en-GB', {
		timeZone,
		hourCycle: 'h23',
		hour: '2-digit',
		minute: '2-digit'
	}).format(at);
}

/** Local hour (0–23) of `at` in `timeZone`. */
export function localHour(timeZone: string, at: Date = new Date()): number {
	return Number(localTime(timeZone, at).slice(0, 2));
}

/**
 * Wall-clock date + "HH:MM" in `timeZone` → ISO 8601 timestamp with that
 * zone's offset ("2026-11-07T08:15:00+01:00"). A time skipped by a DST jump
 * resolves to the instant after the jump.
 */
export function zonedIso(date: string, time: string, timeZone: string): string {
	const [y, mo, d] = date.split('-').map(Number);
	const [h, mi] = time.split(':').map(Number);
	const wall = Date.UTC(y, mo - 1, d, h, mi);
	let offset = timeZoneOffsetMinutes(timeZone, new Date(wall));
	offset = timeZoneOffsetMinutes(timeZone, new Date(wall - offset * 60_000));
	const instant = new Date(wall - offset * 60_000);

	const local = new Date(instant.getTime() + offset * 60_000).toISOString().slice(0, 19);
	const sign = offset < 0 ? '-' : '+';
	const abs = Math.abs(offset);
	const hh = String(Math.floor(abs / 60)).padStart(2, '0');
	const mm = String(abs % 60).padStart(2, '0');
	return `${local}${sign}${hh}:${mm}`;
}
