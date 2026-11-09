/**
 * Activity maths shared by the UI (live previews) and the server (saved
 * values): pace, speed, durations and MET-based active calories.
 * All inputs are metric: meters, seconds, kilograms.
 */

export const ACTIVITY_TYPES = ['walking', 'running', 'cycling', 'other'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Everything the Add workout screen can log: four activity types plus strength. */
export const LOG_TYPES = ['strength', 'running', 'walking', 'cycling', 'other'] as const;
export type LogType = (typeof LOG_TYPES)[number];

export const MUSCLE_GROUPS = [
	'chest',
	'back',
	'shoulders',
	'arms',
	'legs',
	'glutes',
	'core',
	'full_body',
	'other'
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** Seconds per kilometre, or null without a distance. */
export function paceSecondsPerKm(distanceMeters: number | null, durationSeconds: number) {
	if (!distanceMeters || distanceMeters <= 0 || durationSeconds <= 0) return null;
	return Math.round(durationSeconds / (distanceMeters / 1000));
}

/**
 * Average speed in km/h with the same rounding as the database's generated
 * `average_speed_kmh` column: round(m / s × 3.6, 2).
 */
export function speedKmh(distanceMeters: number | null, durationSeconds: number) {
	if (!distanceMeters || distanceMeters <= 0 || durationSeconds <= 0) return null;
	return Math.round((distanceMeters / durationSeconds) * 3.6 * 100) / 100;
}

/** 367 → "6:07"; 3725 → "1:02:05". */
export function formatDuration(totalSeconds: number): string {
	const s = Math.max(0, Math.round(totalSeconds));
	const hours = Math.floor(s / 3600);
	const minutes = Math.floor((s % 3600) / 60);
	const seconds = s % 60;
	const two = (n: number) => String(n).padStart(2, '0');
	return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${minutes}:${two(seconds)}`;
}

/**
 * What the user typed in a duration field → seconds. "45" or "45.5" are
 * minutes; "44:30" is minutes:seconds; "1:05:00" is hours:minutes:seconds.
 * Returns undefined for empty input and null for anything unreadable.
 */
export function parseDuration(input: string): number | null | undefined {
	const text = input.trim().replace(',', '.');
	if (!text) return undefined;
	if (/^\d+(\.\d+)?$/.test(text)) {
		const seconds = Math.round(Number(text) * 60);
		return seconds > 0 ? seconds : null;
	}
	const parts = text.split(':');
	if (parts.length < 2 || parts.length > 3 || !parts.every((p) => /^\d+$/.test(p))) return null;
	const nums = parts.map(Number);
	const [h, mi, s] = nums.length === 3 ? nums : [0, nums[0], nums[1]];
	if (s >= 60 || (nums.length === 3 && mi >= 60)) return null;
	const seconds = h * 3600 + mi * 60 + s;
	return seconds > 0 ? seconds : null;
}

/** Seconds → the text a duration field starts with ("45" for whole minutes). */
export function durationToInput(seconds: number | null | undefined): string {
	if (!seconds) return '';
	return seconds % 60 === 0 ? String(seconds / 60) : formatDuration(seconds);
}

/**
 * MET values from the Compendium of Physical Activities (2024), chosen by
 * average speed where it is known.
 */
export function metFor(type: LogType, kmh: number | null): number {
	switch (type) {
		case 'walking':
			if (kmh === null) return 3.5;
			if (kmh < 3.2) return 2.0;
			if (kmh < 4.8) return 2.8;
			if (kmh < 5.6) return 3.5;
			if (kmh < 6.4) return 4.3;
			if (kmh < 7.2) return 5.0;
			return 7.0; // very brisk walking
		case 'running':
			if (kmh === null) return 9.8;
			if (kmh < 8) return 7.0; // jogging
			if (kmh < 9.7) return 8.3;
			if (kmh < 10.8) return 9.8;
			if (kmh < 11.3) return 10.5;
			if (kmh < 12.9) return 11.0;
			if (kmh < 14.5) return 11.8;
			if (kmh < 16) return 12.8;
			return 14.5;
		case 'cycling':
			if (kmh === null) return 7.5;
			if (kmh < 16) return 4.0;
			if (kmh < 19) return 6.8;
			if (kmh < 22.5) return 8.0;
			if (kmh < 25.7) return 10.0;
			if (kmh < 30.6) return 12.0;
			return 15.8;
		case 'strength':
			return 3.5; // resistance training, multiple exercises
		case 'other':
			return 4.0; // unknown activity: a moderate default; the user can overwrite it
	}
}

/**
 * Estimated active calories: MET × body weight (kg) × hours, rounded to
 * whole kcal. Null without a weight or a duration — the app never guesses
 * a body weight.
 */
export function estimateActiveKcal(input: {
	type: LogType;
	durationSeconds: number | null | undefined;
	distanceMeters?: number | null;
	weightKg: number | null | undefined;
}): number | null {
	const { type, durationSeconds, distanceMeters = null, weightKg } = input;
	if (!weightKg || weightKg <= 0 || !durationSeconds || durationSeconds <= 0) return null;
	const kmh =
		type === 'strength' || type === 'other' ? null : speedKmh(distanceMeters, durationSeconds);
	const kcal = metFor(type, kmh) * weightKg * (durationSeconds / 3600);
	return Math.min(20000, Math.round(kcal));
}
