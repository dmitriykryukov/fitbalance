<script lang="ts">
	import Ring from '#lib/components/shared/Ring.svelte';
	import { formatNumber } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';

	type Props = {
		/** Food calories eaten today. */
		consumedKcal: number;
		/** Active goal; null when the user has not set one. */
		goalKcal: number | null;
		/** Estimated active calories. Shown only — never changes "kcal left". */
		activeKcal: number;
	};

	let { consumedKcal, goalKcal, activeKcal }: Props = $props();

	const left = $derived(goalKcal === null ? null : Math.max(0, goalKcal - consumedKcal));
</script>

<div class="flex items-center gap-5">
	<Ring value={consumedKcal} max={goalKcal ?? consumedKcal} label={m.consumed()}>
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
				{formatNumber(left)} <span class="text-base font-semibold">{m.kcal_left()}</span>
			</p>
			<p class="mt-1 text-sm text-white/80">{m.goal_kcal({ value: formatNumber(goalKcal) })}</p>
		{/if}
		<dl class="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 text-xs">
			<span class="size-2 rounded-full bg-mint-strong"></span>
			<dt class="text-white/85">{m.food()}</dt>
			<dd class="font-bold">{formatNumber(consumedKcal)}</dd>
			<span class="size-2 rounded-full bg-orange"></span>
			<dt class="text-white/85">{m.active()}</dt>
			<dd class="font-bold">{formatNumber(activeKcal)}</dd>
		</dl>
	</div>
</div>
