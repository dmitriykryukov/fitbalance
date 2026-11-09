/**
 * Statistics maths (pure, shared by the service and tests). Days without
 * records are null — never zero — and averages use logged days only.
 */
import { summarize, type HistoryEntry } from './activity-summary.js';
import { addDays } from './dates.js';

export const STAT_RANGES = ['7d', '30d', '90d'] as const;
export type StatRange = (typeof STAT_RANGES)[number];
export const RANGE_DAYS: Record<StatRange, number> = { '7d': 7, '30d': 30, '90d': 90 };

/** A logged diary day from the `daily_nutrition` view. */
export type NutritionRow = {
	local_date: string;
	kcal: number | null;
	protein_g: number | null;
	carbs_g: number | null;
	fat_g: number | null;
};

/** A goal version: active from `effective_from` until the next version. */
export type GoalVersion = {
	effective_from: string;
	calories_kcal: number | null;
	protein_g: number | null;
	carbs_g: number | null;
	fat_g: number | null;
	target_weight_kg: number | null;
	target_waist_cm: number | null;
};

export type BodyRow = {
	local_date: string;
	measured_at: string;
	weight_kg: number | null;
	waist_cm: number | null;
};

export type NutritionDay = {
	date: string;
	/** Null: nothing logged that day (a gap in charts, not zero). */
	kcal: number | null;
	protein_g: number | null;
	carbs_g: number | null;
	fat_g: number | null;
	/** Calorie target of the goal version active that day. */
	target_kcal: number | null;
};

export type Targets = {
	calories_kcal: number | null;
	protein_g: number | null;
	carbs_g: number | null;
	fat_g: number | null;
};

export type NutritionStats = {
	days: NutritionDay[];
	days_logged: number;
	avg_kcal: number | null;
	avg_protein_g: number | null;
	avg_carbs_g: number | null;
	avg_fat_g: number | null;
	/** Share of logged days with a target where kcal was within ±10 % of it (0–100). */
	within_target_pct: number | null;
	/** Logged days that had a calorie target (the base of `within_target_pct`). */
	days_with_target: number;
	/** Targets of the goal active on the last day of the range. */
	targets: Targets | null;
};

export type ActivityStats = {
	days: { date: string; seconds: number | null }[];
	sessions: number;
	strength_workouts: number;
	active_seconds: number | null;
	run_distance_meters: number | null;
	steps: number | null;
	active_kcal: number | null;
};

export type BodyPoint = { date: string; value: number };

export type BodyTrend = {
	/** One point per measured day (the latest that day) — no invented points. */
	points: BodyPoint[];
	/** Latest value on or before the end of the range (may be older than the range). */
	current: number | null;
	current_date: string | null;
	target: number | null;
	/** Last minus first point in the range; null with fewer than two points. */
	change: number | null;
	/** Progress from the first point in the range toward the target (0–100). */
	progress_pct: number | null;
};

export type Statistics = {
	range: StatRange;
	from: string;
	to: string;
	days_total: number;
	nutrition: NutritionStats;
	activity: ActivityStats;
	body: { weight: BodyTrend; waist: BodyTrend };
};

export function rangeDates(range: StatRange, end: string) {
	return { from: addDays(end, -(RANGE_DAYS[range] - 1)), to: end };
}

export function datesBetween(from: string, to: string): string[] {
	const dates: string[] = [];
	for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
	return dates;
}

/** The goal version active on `date` (versions in any order). */
export function goalOn<T extends { effective_from: string }>(
	versions: T[],
	date: string
): T | null {
	let best: T | null = null;
	for (const v of versions) {
		if (v.effective_from <= date && (!best || v.effective_from > best.effective_from)) best = v;
	}
	return best;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function average(values: (number | null)[]): number | null {
	const present = values.filter((v): v is number => v !== null);
	return present.length ? present.reduce((a, b) => a + b, 0) / present.length : null;
}

export function nutritionStats(
	from: string,
	to: string,
	rows: NutritionRow[],
	goals: GoalVersion[]
): NutritionStats {
	const byDate = new Map(rows.map((r) => [r.local_date, r]));
	const days: NutritionDay[] = datesBetween(from, to).map((date) => {
		const row = byDate.get(date);
		const goal = goalOn(goals, date);
		return {
			date,
			kcal: row?.kcal ?? null,
			protein_g: row ? (row.protein_g ?? 0) : null,
			carbs_g: row ? (row.carbs_g ?? 0) : null,
			fat_g: row ? (row.fat_g ?? 0) : null,
			target_kcal: goal?.calories_kcal ?? null
		};
	});

	const logged = days.filter((d) => d.kcal !== null);
	const withTarget = logged.filter((d) => d.target_kcal !== null && d.target_kcal > 0);
	const within = withTarget.filter(
		(d) => Math.abs(d.kcal! - d.target_kcal!) <= d.target_kcal! * 0.1
	);
	const avg = (key: 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g', digits: (n: number) => number) => {
		const value = average(logged.map((d) => d[key]));
		return value === null ? null : digits(value);
	};
	const end = goalOn(goals, to);

	return {
		days,
		days_logged: logged.length,
		avg_kcal: avg('kcal', Math.round),
		avg_protein_g: avg('protein_g', round1),
		avg_carbs_g: avg('carbs_g', round1),
		avg_fat_g: avg('fat_g', round1),
		within_target_pct: withTarget.length
			? Math.round((within.length / withTarget.length) * 100)
			: null,
		days_with_target: withTarget.length,
		targets: end
			? {
					calories_kcal: end.calories_kcal,
					protein_g: end.protein_g,
					carbs_g: end.carbs_g,
					fat_g: end.fat_g
				}
			: null
	};
}

export function activityStats(from: string, to: string, history: HistoryEntry[]): ActivityStats {
	const summary = summarize(from, to, history);
	const runs = history.filter(
		(e) => e.local_date >= from && e.local_date <= to && e.type === 'running'
	);
	const runMeters = runs.map((e) => e.distance_meters).filter((v): v is number => v !== null);
	return {
		days: summary.days.map(({ date, seconds }) => ({ date, seconds })),
		sessions: summary.sessions,
		strength_workouts: summary.strength.count,
		active_seconds: summary.activeSeconds,
		run_distance_meters: runMeters.length ? runMeters.reduce((a, b) => a + b, 0) : null,
		steps: summary.walking.steps,
		active_kcal: summary.activeKcal
	};
}

/**
 * Trend for one body field. `rows` may include measurements before `from`
 * (used only for `current`); points and change come from the range.
 */
export function bodyTrend(
	from: string,
	to: string,
	rows: BodyRow[],
	field: 'weight_kg' | 'waist_cm',
	target: number | null
): BodyTrend {
	const valued = rows
		.filter((r) => r[field] !== null && r.local_date <= to)
		.sort((a, b) =>
			a.local_date === b.local_date
				? a.measured_at.localeCompare(b.measured_at)
				: a.local_date.localeCompare(b.local_date)
		);
	// Latest measurement of each day wins.
	const perDay = new Map<string, number>();
	for (const r of valued) perDay.set(r.local_date, r[field]!);

	const points = [...perDay]
		.filter(([date]) => date >= from)
		.map(([date, value]) => ({ date, value }));
	const last = valued.at(-1);
	const current = last ? last[field]! : null;

	const first = points[0];
	const final = points.at(-1);
	const change = points.length >= 2 ? round1(final!.value - first!.value) : null;

	let progress: number | null = null;
	if (target !== null && first && final && first.value !== target) {
		const pct = ((first.value - final.value) / (first.value - target)) * 100;
		progress = Math.round(Math.min(100, Math.max(0, pct)));
	}

	return {
		points,
		current,
		current_date: last?.local_date ?? null,
		target,
		change,
		progress_pct: points.length >= 2 ? progress : null
	};
}

export function buildStatistics(input: {
	range: StatRange;
	end: string;
	nutrition: NutritionRow[];
	goals: GoalVersion[];
	history: HistoryEntry[];
	body: BodyRow[];
}): Statistics {
	const { from, to } = rangeDates(input.range, input.end);
	const goal = goalOn(input.goals, to);
	return {
		range: input.range,
		from,
		to,
		days_total: RANGE_DAYS[input.range],
		nutrition: nutritionStats(from, to, input.nutrition, input.goals),
		activity: activityStats(from, to, input.history),
		body: {
			weight: bodyTrend(from, to, input.body, 'weight_kg', goal?.target_weight_kg ?? null),
			waist: bodyTrend(from, to, input.body, 'waist_cm', goal?.target_waist_cm ?? null)
		}
	};
}
