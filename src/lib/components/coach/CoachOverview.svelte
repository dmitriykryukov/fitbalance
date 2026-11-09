<script lang="ts">
	import { Beef, Dumbbell, Scale } from '@lucide/svelte';
	import type { CoachStats, Highlight } from '#lib/coach.js';
	import { formatNumber, formatShortDate } from '#lib/format.js';
	import { formatActiveTime } from '#lib/labels.js';
	import { m } from '#lib/paraglide/messages.js';
	import { countLoggedDays, countWorkouts } from '#lib/plural.js';

	type Props = { stats: CoachStats; highlights: Highlight[] };

	let { stats, highlights }: Props = $props();

	const show = (value: number | null) => (value === null ? '—' : formatNumber(value));

	const tiles = $derived([
		{ value: stats.kcal_today, goal: stats.kcal_goal, label: m.coach_stat_kcal() },
		{ value: stats.protein_today, goal: stats.protein_goal, label: m.coach_stat_protein() },
		{
			value: stats.training_minutes_7d,
			goal: stats.training_goal_minutes,
			label: m.coach_stat_training()
		}
	]);

	const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${formatNumber(Math.abs(n), 1)}`;

	function card(h: Highlight) {
		switch (h.kind) {
			case 'protein':
				return {
					icon: Beef,
					tone: 'bg-mint text-green',
					title:
						h.status === 'on_track'
							? m.coach_protein_on_track()
							: h.status === 'low'
								? m.coach_protein_low()
								: m.coach_protein_avg({ value: formatNumber(h.avg_g) }),
					body:
						h.target_g === null
							? m.coach_protein_body_plain({ days: countLoggedDays(h.days) })
							: m.coach_protein_body({
									avg: formatNumber(h.avg_g),
									target: formatNumber(h.target_g),
									days: countLoggedDays(h.days)
								})
				};
			case 'workouts':
				return {
					icon: Dumbbell,
					tone: 'bg-blue-bg text-blue',
					title:
						h.sessions === 0
							? m.coach_workouts_none()
							: m.coach_workouts_title({ sessions: countWorkouts(h.sessions) }),
					body:
						h.sessions === 0 || h.minutes === null
							? m.coach_workouts_none_body()
							: m.coach_workouts_body({ time: formatActiveTime(h.minutes * 60) })
				};
			case 'weight':
				return {
					icon: Scale,
					tone: 'bg-orange-bg text-amber-text',
					title: m.coach_weight_title({ change: signed(h.change_kg) }),
					body: m.coach_weight_body({ date: formatShortDate(h.from_date) })
				};
		}
	}
</script>

<ul class="grid grid-cols-3 gap-2.5">
	{#each tiles as tile (tile.label)}
		<li class="rounded-tile border border-line bg-white p-3.5 shadow-card">
			<p class="heading text-xl font-bold tabular-nums">{show(tile.value)}</p>
			<p class="text-xs leading-tight text-muted">{tile.label}</p>
			{#if tile.goal !== null}
				<p class="mt-1 text-xs font-semibold text-green tabular-nums">
					{m.coach_of_goal({ value: formatNumber(tile.goal) })}
				</p>
			{/if}
		</li>
	{/each}
</ul>

<section class="mt-5" aria-labelledby="coach-highlights">
	<h2
		id="coach-highlights"
		class="mb-2 px-1 text-xs font-semibold tracking-wider text-muted uppercase"
	>
		{m.coach_highlights()}
	</h2>
	<ul class="-mx-4 flex snap-x [scrollbar-width:none] gap-2.5 overflow-x-auto px-4 pb-1">
		{#each highlights as h (h.kind)}
			{@const c = card(h)}
			<li
				class="w-[min(15rem,75%)] shrink-0 snap-start rounded-tile border border-line bg-white p-4 shadow-card"
			>
				<span class={['grid size-9 place-items-center rounded-xl', c.tone]} aria-hidden="true">
					<c.icon class="size-[18px]" />
				</span>
				<p class="mt-3 font-bold">{c.title}</p>
				<p class="mt-0.5 text-sm text-muted">{c.body}</p>
			</li>
		{/each}
	</ul>
</section>
