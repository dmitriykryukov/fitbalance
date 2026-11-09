<script lang="ts">
	import { Activity, Dumbbell, Flame, Footprints, Plus, Route, Zap } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import ActivitySummaryCard from '#lib/components/activity/ActivitySummaryCard.svelte';
	import HistoryRow from '#lib/components/activity/HistoryRow.svelte';
	import PageHeader from '#lib/components/layout/PageHeader.svelte';
	import Button from '#lib/components/shared/Button.svelte';
	import Card from '#lib/components/shared/Card.svelte';
	import EmptyState from '#lib/components/shared/EmptyState.svelte';
	import SegmentedControl from '#lib/components/shared/SegmentedControl.svelte';
	import { formatNumber } from '#lib/format.js';
	import { formatActiveTime, formatKm, formatPace } from '#lib/labels.js';
	import { m } from '#lib/paraglide/messages.js';
	import { countSets, countWorkouts } from '#lib/plural.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const home = resolve('/app/activity');
	const addHref = resolve('/app/activity/add');
	const summary = $derived(data.summary);

	function setRange(range: 'week' | 'month') {
		const href = (range === 'week' ? home : `${home}?range=month`) as ResolvedPathname;
		void goto(href, { replace: true, reset: false });
	}

	const tiles = $derived([
		{
			value: summary.sessions > 0 ? formatNumber(summary.sessions) : '—',
			label: m.tile_workouts(),
			icon: Dumbbell,
			tone: 'bg-mint text-green'
		},
		{
			value: summary.distanceMeters === null ? '—' : formatNumber(summary.distanceMeters / 1000, 1),
			label: m.tile_km(),
			icon: Route,
			tone: 'bg-blue-bg text-blue'
		},
		{
			value: summary.activeKcal === null ? '—' : formatNumber(summary.activeKcal),
			label: m.tile_active_kcal(),
			icon: Flame,
			tone: 'bg-orange-bg text-amber-text'
		}
	]);

	const categories = $derived([
		{
			name: m.log_type_strength(),
			icon: Dumbbell,
			tone: 'bg-mint text-green',
			detail:
				summary.strength.count === 0
					? m.not_logged()
					: [
							countWorkouts(summary.strength.count),
							countSets(summary.strength.sets),
							summary.strength.seconds === null ? null : formatActiveTime(summary.strength.seconds)
						]
							.filter(Boolean)
							.join(' · '),
			metric: null as string | null,
			metricLabel: null as string | null
		},
		{
			name: m.category_cardio(),
			icon: Zap,
			tone: 'bg-orange-bg text-amber-text',
			detail:
				summary.cardio.count === 0
					? m.not_logged()
					: [
							countWorkouts(summary.cardio.count),
							summary.cardio.distanceMeters === null
								? null
								: formatKm(summary.cardio.distanceMeters)
						]
							.filter(Boolean)
							.join(' · '),
			metric:
				summary.cardio.avgPaceSecondsPerKm === null
					? null
					: formatPace(summary.cardio.avgPaceSecondsPerKm),
			metricLabel: m.avg_pace()
		},
		{
			name: m.activity_type_walking(),
			icon: Footprints,
			tone: 'bg-blue-bg text-blue',
			detail:
				summary.walking.count === 0
					? m.not_logged()
					: [
							countWorkouts(summary.walking.count),
							summary.walking.distanceMeters === null
								? null
								: formatKm(summary.walking.distanceMeters)
						]
							.filter(Boolean)
							.join(' · '),
			metric: summary.walking.steps === null ? null : formatNumber(summary.walking.steps),
			metricLabel: m.tile_steps()
		}
	]);
</script>

<svelte:head><title>{m.activity_title()} · {m.app_name()}</title></svelte:head>

<PageHeader title={m.activity_title()} subtitle={m.activity_subtitle()}>
	{#snippet actions()}
		<a
			href={addHref}
			class="grid size-12 place-items-center rounded-full bg-green text-white shadow-card hover:bg-green-dark"
			aria-label={m.add_workout()}
		>
			<Plus class="size-6" aria-hidden="true" />
		</a>
	{/snippet}
</PageHeader>

<div class="space-y-6 px-4">
	<SegmentedControl
		label={m.activity_range()}
		hideLabel
		options={[
			{ value: 'week', label: m.range_week() },
			{ value: 'month', label: m.range_month() }
		]}
		value={data.range}
		onchange={setRange}
	/>

	<ActivitySummaryCard {summary} range={data.range} />

	<ul class="grid grid-cols-3 gap-2.5">
		{#each tiles as tile (tile.label)}
			<li class="rounded-tile border border-line bg-white p-3.5 shadow-card">
				<span class={['grid size-9 place-items-center rounded-xl', tile.tone]}>
					<tile.icon class="size-[18px]" aria-hidden="true" />
				</span>
				<p class="mt-3 heading text-xl font-bold tabular-nums">{tile.value}</p>
				<p class="text-xs leading-tight text-muted">{tile.label}</p>
			</li>
		{/each}
	</ul>

	<section>
		<h2 class="mb-3 px-1 heading text-[19px] font-bold">{m.your_activity()}</h2>
		<Card padding="none">
			<ul class="divide-y divide-line">
				{#each categories as category (category.name)}
					<li class="flex items-center gap-3.5 px-4 py-3.5">
						<span class={['grid size-11 shrink-0 place-items-center rounded-tile', category.tone]}>
							<category.icon class="size-5" aria-hidden="true" />
						</span>
						<span class="min-w-0 flex-1">
							<span class="block font-bold">{category.name}</span>
							<span class="block truncate text-sm text-muted">{category.detail}</span>
						</span>
						{#if category.metricLabel}
							<span class="shrink-0 text-right">
								<span class="block text-sm font-bold tabular-nums">{category.metric ?? '—'}</span>
								<span class="block text-xs text-muted">{category.metricLabel}</span>
							</span>
						{/if}
					</li>
				{/each}
			</ul>
		</Card>
	</section>

	<section>
		<div class="mb-3 flex items-end justify-between gap-3 px-1">
			<h2 class="heading text-[19px] font-bold">{m.workout_history()}</h2>
			<Button size="sm" href={addHref}>
				<Plus class="size-4" aria-hidden="true" />
				{m.add_workout()}
			</Button>
		</div>
		{#if data.history.length === 0}
			<Card>
				<EmptyState
					icon={Activity}
					title={data.range === 'week' ? m.activity_empty_week() : m.activity_empty_month()}
					body={m.activity_empty_body()}
				/>
			</Card>
		{:else}
			<Card padding="none" class="overflow-hidden">
				<ul class="divide-y divide-line">
					{#each data.history as entry (`${entry.kind}:${entry.id}`)}
						<li><HistoryRow {entry} today={data.today} timeZone={data.profile.timezone} /></li>
					{/each}
				</ul>
			</Card>
		{/if}
	</section>
</div>
