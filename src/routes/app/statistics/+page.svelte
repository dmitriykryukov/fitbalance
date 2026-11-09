<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import MacroBars from '#lib/components/dashboard/MacroBars.svelte';
	import PageHeader from '#lib/components/layout/PageHeader.svelte';
	import Card from '#lib/components/shared/Card.svelte';
	import SegmentedControl from '#lib/components/shared/SegmentedControl.svelte';
	import BarChart from '#lib/components/statistics/BarChart.svelte';
	import LineChart from '#lib/components/statistics/LineChart.svelte';
	import { formatNumber, formatShortDate } from '#lib/format.js';
	import { formatActiveTime, formatKm } from '#lib/labels.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { StatRange } from '#lib/statistics.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const stats = $derived(data.stats);
	const nutrition = $derived(stats.nutrition);
	const activity = $derived(stats.activity);
	const weight = $derived(stats.body.weight);
	const waist = $derived(stats.body.waist);
	const dates = $derived(nutrition.days.map((d) => d.date));

	const home = resolve('/app/statistics');
	function setRange(range: StatRange) {
		const href = (range === '7d' ? home : `${home}?range=${range}`) as ResolvedPathname;
		void goto(href, { replace: true, reset: false });
	}

	const kcal = (v: number) => formatNumber(v);
	const kg = (v: number) => `${formatNumber(v, 1)} ${m.unit_kg()}`;
	const cm = (v: number) => `${formatNumber(v, 1)} ${m.unit_cm()}`;
	const signed = (v: number, unit: (n: number) => string) =>
		`${v > 0 ? '+' : v < 0 ? '−' : '±'}${unit(Math.abs(v))}`;
	const dash = (v: number | null, show: (n: number) => string) => (v === null ? '—' : show(v));

	/** Weight/waist points spread over every day of the range (gaps where not measured). */
	const bodyValues = (points: { date: string; value: number }[]) => {
		const byDate = new Map(points.map((p) => [p.date, p.value]));
		return dates.map((d) => byDate.get(d) ?? null);
	};

	const activityTiles = $derived([
		{ label: m.stats_sessions(), value: activity.sessions ? formatNumber(activity.sessions) : '—' },
		{ label: m.active_time(), value: dash(activity.active_seconds, formatActiveTime) },
		{ label: m.stats_run_distance(), value: dash(activity.run_distance_meters, formatKm) },
		{ label: m.stats_total_steps(), value: dash(activity.steps, (n) => formatNumber(n)) }
	]);
</script>

<svelte:head><title>{m.stats_title()} · {m.app_name()}</title></svelte:head>

<PageHeader
	title={m.stats_title()}
	subtitle={`${formatShortDate(stats.from)} – ${formatShortDate(stats.to)}`}
	backHref={resolve('/app/profile')}
/>

<div class="space-y-6 px-4">
	<SegmentedControl
		label={m.stats_range()}
		hideLabel
		options={[
			{ value: '7d', label: m.stats_7d() },
			{ value: '30d', label: m.stats_30d() },
			{ value: '90d', label: m.stats_90d() }
		]}
		value={stats.range}
		onchange={setRange}
	/>

	<section aria-labelledby="stats-nutrition">
		<h2 id="stats-nutrition" class="mb-3 px-1 heading text-[19px] font-bold">
			{m.stats_nutrition()}
		</h2>
		<Card>
			<div class="flex items-end justify-between gap-4">
				<div>
					<p class="text-xs text-muted">{m.stats_avg_kcal()}</p>
					<p class="heading text-[28px] leading-tight font-bold tabular-nums">
						{nutrition.avg_kcal === null
							? '—'
							: m.kcal_value({ value: formatNumber(nutrition.avg_kcal) })}
					</p>
					<p class="text-sm text-muted">
						{m.stats_days_logged({
							logged: formatNumber(nutrition.days_logged),
							total: formatNumber(stats.days_total)
						})}
					</p>
				</div>
				<div class="text-right">
					<p class="heading text-xl font-bold tabular-nums">
						{nutrition.within_target_pct === null ? '—' : `${nutrition.within_target_pct}%`}
					</p>
					<p class="max-w-32 text-xs leading-tight text-muted">{m.stats_within_target()}</p>
				</div>
			</div>

			<div class="mt-4">
				{#if nutrition.days_logged === 0}
					<p class="rounded-tile bg-paper p-4 text-center text-sm text-muted">
						{m.stats_no_meals()}
					</p>
				{:else}
					<LineChart
						{dates}
						values={nutrition.days.map((d) => d.kcal)}
						target={nutrition.days.map((d) => d.target_kcal)}
						format={kcal}
						label={m.stats_kcal_chart()}
						seriesLabel={m.kcal()}
					/>
					<p class="mt-2 text-xs text-muted">{m.stats_gaps_note()}</p>
				{/if}
			</div>
		</Card>

		<Card class="mt-3">
			<h3 class="mb-3 eyebrow">{m.stats_avg_macros()}</h3>
			<MacroBars
				protein={{
					value: nutrition.avg_protein_g,
					target: nutrition.targets?.protein_g ?? null
				}}
				carbs={{ value: nutrition.avg_carbs_g, target: nutrition.targets?.carbs_g ?? null }}
				fat={{ value: nutrition.avg_fat_g, target: nutrition.targets?.fat_g ?? null }}
			/>
		</Card>
	</section>

	<section aria-labelledby="stats-activity">
		<h2 id="stats-activity" class="mb-3 px-1 heading text-[19px] font-bold">
			{m.stats_activity()}
		</h2>
		<Card>
			<dl class="grid grid-cols-2 gap-2">
				{#each activityTiles as tile (tile.label)}
					<div class="rounded-tile bg-paper px-3 py-2.5">
						<dt class="text-[11px] leading-tight font-semibold text-muted">{tile.label}</dt>
						<dd class="mt-1 heading text-lg leading-none font-bold tabular-nums">{tile.value}</dd>
					</div>
				{/each}
			</dl>
			{#if activity.active_seconds !== null}
				<div class="mt-4">
					<BarChart
						{dates}
						values={activity.days.map((d) =>
							d.seconds === null ? null : Math.round(d.seconds / 60)
						)}
						format={(minutes) => formatActiveTime(minutes * 60)}
						formatTick={(minutes) => formatNumber(minutes)}
						label={m.activity_by_day()}
						seriesLabel={m.active_time()}
					/>
					<p class="mt-1 text-xs text-muted">{m.stats_minutes_axis()}</p>
				</div>
			{/if}
		</Card>
	</section>

	<section aria-labelledby="stats-body">
		<h2 id="stats-body" class="mb-3 px-1 heading text-[19px] font-bold">{m.stats_body()}</h2>
		<Card>
			<h3 class="mb-3 eyebrow">{m.tile_weight()}</h3>
			<dl class="grid grid-cols-2 gap-2">
				<div class="rounded-tile bg-paper px-3 py-2.5">
					<dt class="text-[11px] font-semibold text-muted">{m.stats_current()}</dt>
					<dd class="mt-1 heading text-lg leading-none font-bold tabular-nums">
						{dash(weight.current, kg)}
					</dd>
				</div>
				<div class="rounded-tile bg-paper px-3 py-2.5">
					<dt class="text-[11px] font-semibold text-muted">{m.tile_target_weight()}</dt>
					<dd class="mt-1 heading text-lg leading-none font-bold tabular-nums">
						{dash(weight.target, kg)}
					</dd>
				</div>
				<div class="rounded-tile bg-paper px-3 py-2.5">
					<dt class="text-[11px] font-semibold text-muted">{m.stats_change()}</dt>
					<dd class="mt-1 heading text-lg leading-none font-bold tabular-nums">
						{weight.change === null ? '—' : signed(weight.change, kg)}
					</dd>
				</div>
				<div class="rounded-tile bg-paper px-3 py-2.5">
					<dt class="text-[11px] font-semibold text-muted">{m.stats_to_goal()}</dt>
					<dd class="mt-1 heading text-lg leading-none font-bold tabular-nums">
						{weight.progress_pct === null ? '—' : `${weight.progress_pct}%`}
					</dd>
				</div>
			</dl>
			<div class="mt-4">
				{#if weight.points.length === 0}
					<p class="rounded-tile bg-paper p-4 text-center text-sm text-muted">
						{m.stats_no_weight()}
						<a href={resolve('/app/profile/measurements')} class="font-semibold text-green">
							{m.measurement_add()}
						</a>
					</p>
				{:else}
					<LineChart
						{dates}
						values={bodyValues(weight.points)}
						target={weight.target === null ? undefined : dates.map(() => weight.target)}
						connect
						fromZero={false}
						format={(v) => formatNumber(v, 1)}
						label={m.stats_weight_chart()}
						seriesLabel={m.tile_weight()}
						emptyLabel={m.stats_not_measured()}
						height={160}
					/>
				{/if}
			</div>
		</Card>

		<Card class="mt-3">
			<div class="flex items-center justify-between gap-4">
				<div>
					<h3 class="eyebrow">{m.tile_waist()}</h3>
					<p class="mt-1 heading text-xl font-bold tabular-nums">{dash(waist.current, cm)}</p>
				</div>
				<div class="text-right">
					<p class="text-xs text-muted">{m.stats_change()}</p>
					<p class="font-bold tabular-nums">
						{waist.change === null ? '—' : signed(waist.change, cm)}
					</p>
				</div>
			</div>
			{#if waist.points.length > 1}
				<div class="mt-4">
					<LineChart
						{dates}
						values={bodyValues(waist.points)}
						connect
						fromZero={false}
						format={(v) => formatNumber(v, 1)}
						label={m.stats_waist_chart()}
						seriesLabel={m.tile_waist()}
						emptyLabel={m.stats_not_measured()}
						height={140}
					/>
				</div>
			{/if}
		</Card>
		<p class="mt-3 px-1 text-xs text-muted">{m.stats_body_note()}</p>
	</section>
</div>
