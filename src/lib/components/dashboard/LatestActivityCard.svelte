<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import Button from '#lib/components/shared/Button.svelte';
	import Card from '#lib/components/shared/Card.svelte';
	import { formatNumber, formatShortDate } from '#lib/format.js';
	import { activityTypeLabel } from '#lib/labels.js';
	import { m } from '#lib/paraglide/messages.js';
	import { countExercises, countSets } from '#lib/plural.js';
	import type { LatestActivity } from '#lib/server/services/dashboard.js';

	let { latest, today }: { latest: LatestActivity | null; today: string } = $props();

	const minutes = (seconds: number | null) =>
		seconds === null ? null : m.minutes_value({ value: formatNumber(Math.round(seconds / 60)) });

	const details = $derived.by(() => {
		if (!latest) return '';
		const parts =
			latest.kind === 'workout'
				? [
						countExercises(latest.exercises),
						countSets(latest.sets),
						minutes(latest.duration_seconds)
					]
				: [
						latest.distance_meters === null
							? null
							: m.distance_km({ value: formatNumber(latest.distance_meters / 1000, 1) }),
						minutes(latest.duration_seconds)
					];
		if (latest.local_date !== today) parts.push(formatShortDate(latest.local_date));
		return parts.filter(Boolean).join(' · ');
	});
</script>

<Card>
	<p class="eyebrow">{m.activity_eyebrow()}</p>
	{#if latest}
		<h2 class="mt-1 heading text-[19px] font-bold">
			<a
				href={latest.kind === 'workout'
					? resolve('/app/activity/workouts/[id]', { id: latest.id })
					: resolve('/app/activity/[id]', { id: latest.id })}
				class="hover:text-green"
			>
				{latest.kind === 'workout'
					? latest.title
					: (latest.title ?? activityTypeLabel(latest.activity_type))}
			</a>
		</h2>
		<p class="mt-1 text-sm text-muted">{details}</p>
	{:else}
		<h2 class="mt-1 heading text-[19px] font-bold">{m.no_activity_yet()}</h2>
		<p class="mt-1 text-sm text-muted">{m.no_activity_body()}</p>
	{/if}
	<Button variant="soft" full class="mt-4" href={resolve('/app/activity/add')}>
		<Plus class="size-4" aria-hidden="true" />
		{m.add_activity()}
	</Button>
</Card>
