<script lang="ts">
	import type { ActivitySummary } from '#lib/activity-summary.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { formatShortDate } from '#lib/format.js';
	import { formatActiveTime } from '#lib/labels.js';
	import { m } from '#lib/paraglide/messages.js';
	import { countWorkouts } from '#lib/plural.js';

	type Props = { summary: ActivitySummary; range: 'week' | 'month' };

	let { summary, range }: Props = $props();

	const max = $derived(Math.max(0, ...summary.days.map((d) => d.seconds ?? 0)));
	const weekday = (date: string) => {
		const [y, mo, d] = date.split('-').map(Number);
		return new Intl.DateTimeFormat(getLocale() === 'ru' ? 'ru-RU' : 'en-US', {
			weekday: 'narrow',
			timeZone: 'UTC'
		}).format(new Date(Date.UTC(y, mo - 1, d)));
	};
	const dayLabel = (day: ActivitySummary['days'][number]) =>
		`${formatShortDate(day.date)}: ${
			day.seconds !== null
				? formatActiveTime(day.seconds)
				: day.entries > 0
					? countWorkouts(day.entries)
					: m.not_logged()
		}`;
</script>

<section class="rounded-card bg-ink p-5 text-white shadow-card">
	<p class="text-[11px] font-semibold tracking-wider text-white/70 uppercase">
		{range === 'week' ? m.activity_last_7_days() : m.activity_last_30_days()}
	</p>
	<p class="mt-1 heading text-[30px] leading-tight font-bold text-white!">
		{summary.activeSeconds === null ? '—' : formatActiveTime(summary.activeSeconds)}
	</p>
	<p class="text-sm text-white/70">
		{m.active_time()} · {countWorkouts(summary.sessions)}
	</p>

	<ol
		class={['mt-5 flex h-28 items-end', range === 'week' ? 'gap-2.5' : 'gap-[3px]']}
		aria-label={m.activity_by_day()}
	>
		{#each summary.days as day (day.date)}
			<li class="flex h-full min-w-0 flex-1 flex-col items-center gap-1.5" title={dayLabel(day)}>
				<span class="sr-only">{dayLabel(day)}</span>
				<div
					class="relative w-full flex-1 overflow-hidden rounded-full bg-white/10"
					aria-hidden="true"
				>
					{#if day.seconds !== null && max > 0}
						<div
							class="absolute inset-x-0 bottom-0 rounded-full bg-mint-strong"
							style:height="{Math.max(8, (day.seconds / max) * 100)}%"
						></div>
					{:else if day.entries > 0}
						<div class="absolute inset-x-0 bottom-0 h-1.5 rounded-full bg-mint-strong/70"></div>
					{/if}
				</div>
				{#if range === 'week'}
					<span class="text-[11px] text-white/60" aria-hidden="true">{weekday(day.date)}</span>
				{/if}
			</li>
		{/each}
	</ol>
</section>
