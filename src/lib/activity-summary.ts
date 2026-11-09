import { addDays } from './dates.js';
import { paceSecondsPerKm, speedKmh, type ActivityType, type LogType } from './activity.js';

/** What the Activity history needs from a saved activity row. */
export type ActivityLike = {
	id: string;
	activity_type: string;
	title: string | null;
	local_date: string;
	started_at: string | null;
	created_at: string;
	duration_seconds: number;
	distance_meters: number | null;
	steps: number | null;
	estimated_kcal_burned: number | null;
};

/** What the Activity history needs from a saved workout (with counts). */
export type WorkoutLike = {
	id: string;
	title: string;
	local_date: string;
	started_at: string | null;
	created_at: string;
	duration_seconds: number | null;
	estimated_kcal_burned: number | null;
	exercise_count: number;
	set_count: number;
};

/** One row of the Activity history: a strength workout or another activity. */
export type HistoryEntry = {
	kind: 'workout' | 'activity';
	id: string;
	type: LogType;
	title: string | null;
	local_date: string;
	started_at: string | null;
	created_at: string;
	duration_seconds: number | null;
	distance_meters: number | null;
	steps: number | null;
	kcal: number | null;
	exercise_count: number | null;
	set_count: number | null;
	pace_seconds_per_km: number | null;
	speed_kmh: number | null;
};

const ACTIVITY: readonly string[] = ['walking', 'running', 'cycling', 'other'];

/** Workouts and activities merged, newest first (by date, then start or creation time). */
export function toHistory(workouts: WorkoutLike[], activities: ActivityLike[]): HistoryEntry[] {
	const entries: HistoryEntry[] = [
		...workouts.map((w): HistoryEntry => ({
			kind: 'workout',
			id: w.id,
			type: 'strength',
			title: w.title,
			local_date: w.local_date,
			started_at: w.started_at,
			created_at: w.created_at,
			duration_seconds: w.duration_seconds,
			distance_meters: null,
			steps: null,
			kcal: w.estimated_kcal_burned,
			exercise_count: w.exercise_count,
			set_count: w.set_count,
			pace_seconds_per_km: null,
			speed_kmh: null
		})),
		...activities.map((a): HistoryEntry => ({
			kind: 'activity',
			id: a.id,
			type: (ACTIVITY.includes(a.activity_type) ? a.activity_type : 'other') as ActivityType,
			title: a.title,
			local_date: a.local_date,
			started_at: a.started_at,
			created_at: a.created_at,
			duration_seconds: a.duration_seconds,
			distance_meters: a.distance_meters,
			steps: a.steps,
			kcal: a.estimated_kcal_burned,
			exercise_count: null,
			set_count: null,
			pace_seconds_per_km: paceSecondsPerKm(a.distance_meters, a.duration_seconds),
			speed_kmh: speedKmh(a.distance_meters, a.duration_seconds)
		}))
	];
	const key = (e: HistoryEntry) => `${e.local_date}|${e.started_at ?? e.created_at}`;
	return entries.sort((a, b) => (key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0));
}

/** Sum of the values that are present; null when none are (missing ≠ zero). */
function sumPresent(values: (number | null)[]): number | null {
	const present = values.filter((v): v is number => v !== null);
	return present.length ? present.reduce((a, b) => a + b, 0) : null;
}

export type DayBar = {
	date: string;
	/** Active seconds logged that day; null when nothing with a duration was logged. */
	seconds: number | null;
	/** Entries logged that day (a workout may have no duration). */
	entries: number;
};

export type ActivitySummary = {
	days: DayBar[];
	sessions: number;
	activeSeconds: number | null;
	distanceMeters: number | null;
	activeKcal: number | null;
	strength: { count: number; seconds: number | null; sets: number };
	/** Running, cycling and other activities. */
	cardio: { count: number; distanceMeters: number | null; avgPaceSecondsPerKm: number | null };
	walking: { count: number; steps: number | null; distanceMeters: number | null };
};

/**
 * Totals for the Activity screen over `from`…`to` (inclusive). Days and
 * totals with nothing logged stay null, never 0. Average pace uses runs
 * that have both a distance and a duration: Σ seconds ÷ Σ km.
 */
export function summarize(from: string, to: string, history: HistoryEntry[]): ActivitySummary {
	const inRange = history.filter((e) => e.local_date >= from && e.local_date <= to);

	const days: DayBar[] = [];
	for (let date = from; date <= to; date = addDays(date, 1)) {
		const of = inRange.filter((e) => e.local_date === date);
		days.push({ date, seconds: sumPresent(of.map((e) => e.duration_seconds)), entries: of.length });
	}

	const strength = inRange.filter((e) => e.type === 'strength');
	const cardio = inRange.filter((e) => ['running', 'cycling', 'other'].includes(e.type));
	const walking = inRange.filter((e) => e.type === 'walking');
	const runs = inRange.filter(
		(e) => e.type === 'running' && e.distance_meters && e.duration_seconds
	);
	const runMeters = runs.reduce((s, e) => s + e.distance_meters!, 0);
	const runSeconds = runs.reduce((s, e) => s + e.duration_seconds!, 0);

	return {
		days,
		sessions: inRange.length,
		activeSeconds: sumPresent(inRange.map((e) => e.duration_seconds)),
		distanceMeters: sumPresent(inRange.map((e) => e.distance_meters)),
		activeKcal: sumPresent(inRange.map((e) => e.kcal)),
		strength: {
			count: strength.length,
			seconds: sumPresent(strength.map((e) => e.duration_seconds)),
			sets: strength.reduce((s, e) => s + (e.set_count ?? 0), 0)
		},
		cardio: {
			count: cardio.length,
			distanceMeters: sumPresent(cardio.map((e) => e.distance_meters)),
			avgPaceSecondsPerKm: runs.length ? paceSecondsPerKm(runMeters, runSeconds) : null
		},
		walking: {
			count: walking.length,
			steps: sumPresent(walking.map((e) => e.steps)),
			distanceMeters: sumPresent(walking.map((e) => e.distance_meters))
		}
	};
}
