<script lang="ts">
	import { Activity, Bike, ChevronRight, Dumbbell, Footprints, Zap } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { HistoryEntry } from '#lib/activity-summary.js';
	import { addDays } from '#lib/dates.js';
	import { formatNumber, formatShortDate, formatTime } from '#lib/format.js';
	import {
		formatActiveTime,
		formatKm,
		formatPace,
		formatSpeed,
		logTypeLabel
	} from '#lib/labels.js';
	import { m } from '#lib/paraglide/messages.js';
	import { countExercises, countSets } from '#lib/plural.js';

	type Props = { entry: HistoryEntry; today: string; timeZone: string };

	let { entry, today, timeZone }: Props = $props();

	const icons = {
		strength: { icon: Dumbbell, tone: 'bg-mint text-green' },
		running: { icon: Zap, tone: 'bg-orange-bg text-amber-text' },
		walking: { icon: Footprints, tone: 'bg-blue-bg text-blue' },
		cycling: { icon: Bike, tone: 'bg-orange-bg text-amber-text' },
		other: { icon: Activity, tone: 'bg-paper text-muted' }
	} as const;

	const look = $derived(icons[entry.type]);
	const href = $derived(
		entry.kind === 'workout'
			? resolve('/app/activity/workouts/[id]', { id: entry.id })
			: resolve('/app/activity/[id]', { id: entry.id })
	);

	const title = $derived(entry.title ?? logTypeLabel(entry.type));
	const details = $derived(
		(entry.kind === 'workout'
			? [
					entry.exercise_count === null ? null : countExercises(entry.exercise_count),
					entry.set_count === null ? null : countSets(entry.set_count),
					entry.duration_seconds === null ? null : formatActiveTime(entry.duration_seconds)
				]
			: [
					entry.distance_meters === null ? null : formatKm(entry.distance_meters),
					entry.duration_seconds === null ? null : formatActiveTime(entry.duration_seconds),
					entry.type === 'running' && entry.pace_seconds_per_km !== null
						? formatPace(entry.pace_seconds_per_km)
						: null,
					entry.type === 'cycling' && entry.speed_kmh !== null
						? formatSpeed(entry.speed_kmh)
						: null,
					entry.type === 'walking' && entry.steps !== null
						? m.steps_value({ value: formatNumber(entry.steps) })
						: null
				]
		)
			.filter(Boolean)
			.join(' · ')
	);
	const when = $derived(
		[
			entry.local_date === today
				? m.date_today()
				: entry.local_date === addDays(today, -1)
					? m.date_yesterday()
					: formatShortDate(entry.local_date),
			entry.started_at ? formatTime(entry.started_at, timeZone) : null
		]
			.filter(Boolean)
			.join(', ')
	);
</script>

<a {href} class="flex items-center gap-3.5 px-4 py-3.5 hover:bg-paper">
	<span class={['grid size-11 shrink-0 place-items-center rounded-tile', look.tone]}>
		<look.icon class="size-5" aria-hidden="true" />
	</span>
	<span class="min-w-0 flex-1">
		<span class="block truncate font-bold">{title}</span>
		<span class="block truncate text-sm text-muted">{details || when}</span>
		{#if details}<span class="block truncate text-xs text-muted">{when}</span>{/if}
	</span>
	<span class="shrink-0 text-right">
		{#if entry.kcal !== null}
			<span class="block text-sm font-bold tabular-nums">{formatNumber(entry.kcal)}</span>
			<span class="block text-xs text-muted">{m.kcal()}</span>
		{/if}
	</span>
	<ChevronRight class="size-4 shrink-0 text-muted" aria-hidden="true" />
</a>
