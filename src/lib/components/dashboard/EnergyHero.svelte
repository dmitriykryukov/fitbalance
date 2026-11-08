<script lang="ts">
	import { resolve } from '$app/paths';
	import Ring from '#lib/components/shared/Ring.svelte';
	import { formatNumber } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';

	type Props = {
		/** Food calories eaten today. */
		consumedKcal: number;
		/** Active goal; null when the user has not set one. */
		goalKcal: number | null;
		/** Estimated active calories. Shown only — never changes "kcal left". Null: none logged. */
		activeKcal: number | null;
	};

	let { consumedKcal, goalKcal, activeKcal }: Props = $props();

	const left = $derived(goalKcal === null ? null : Math.round(goalKcal - consumedKcal));
</script>

<div class="flex items-center gap-5">
	<Ring value={consumedKcal} max={goalKcal ?? 0} label={m.consumed()}>
		<span class="text-[11px] text-white/80">{m.consumed()}</span>
		<span class="heading text-[28px] leading-none font-bold text-white">
			{formatNumber(consumedKcal)}
		</span>
		<span class="text-[11px] text-white/80">{m.kcal()}</span>
	</Ring>

	<div class="min-w-0 text-white">
		<p class="text-[11px] font-semibold tracking-wider text-white/80">{m.daily_energy()}</p>
		{#if left !== null && goalKcal !== null}
			<p class="mt-1 heading text-[28px] leading-tight font-bold text-white">
				{formatNumber(Math.abs(left))}
				<span class="text-base font-semibold">{left >= 0 ? m.kcal_left() : m.kcal_over()}</span>
			</p>
			<p class="mt-1 text-sm text-white/80">{m.goal_kcal({ value: formatNumber(goalKcal) })}</p>
		{:else}
			<a
				href={resolve('/app/profile/goals')}
				class="mt-2 inline-flex min-h-11 items-center rounded-full bg-white/15 px-4 text-sm font-semibold text-white hover:bg-white/25"
			>
				{m.set_goals_link()}
			</a>
		{/if}
		<dl class="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 text-xs">
			<span class="size-2 rounded-full bg-mint-strong"></span>
			<dt class="text-white/85">{m.food()}</dt>
			<dd class="font-bold">{formatNumber(consumedKcal)}</dd>
			<span class="size-2 rounded-full bg-orange"></span>
			<dt class="text-white/85">{m.active()}</dt>
			<dd class="font-bold">{activeKcal === null ? '—' : formatNumber(activeKcal)}</dd>
		</dl>
	</div>
</div>
