<script lang="ts">
	import MacroBars from '#lib/components/dashboard/MacroBars.svelte';
	import Card from '#lib/components/shared/Card.svelte';
	import Ring from '#lib/components/shared/Ring.svelte';
	import { formatNumber } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { DayNutrition } from '#lib/server/services/dashboard.js';
	import type { Goal } from '#lib/server/services/goals.js';

	let { nutrition, goal }: { nutrition: DayNutrition; goal: Goal | null } = $props();

	const consumed = $derived(Math.round(nutrition.kcal));
	/** A day without meals shows dashes, never zeros. */
	const shown = $derived(nutrition.logged ? formatNumber(consumed) : '—');
	const grams = (value: number) => (nutrition.logged ? value : null);
	const left = $derived(nutrition.kcal_left);
</script>

<Card>
	<div class="flex items-center gap-5">
		<Ring
			value={consumed}
			max={goal?.calories_kcal ?? 0}
			size={120}
			stroke={11}
			trackColor="var(--color-line)"
			progressColor="var(--color-green)"
			label={m.consumed()}
		>
			<span class="text-[11px] text-muted">{m.consumed()}</span>
			<span class="heading text-[26px] leading-none font-bold">{shown}</span>
			<span class="text-[11px] text-muted">{m.kcal()}</span>
		</Ring>
		<div class="min-w-0">
			<p class="text-[11px] font-semibold tracking-wider text-muted">{m.daily_energy()}</p>
			{#if left !== null && goal?.calories_kcal != null}
				<p class="mt-1 heading text-[26px] leading-tight font-bold">
					{formatNumber(Math.abs(left))}
					<span class="text-base font-semibold">{left >= 0 ? m.kcal_left() : m.kcal_over()}</span>
				</p>
				<p class="mt-1 text-sm text-muted">
					{m.goal_kcal({ value: formatNumber(goal.calories_kcal) })}
				</p>
			{:else}
				<p class="mt-1 heading text-[26px] leading-tight font-bold">
					{shown} <span class="text-base font-semibold">{m.kcal()}</span>
				</p>
			{/if}
		</div>
	</div>
	<hr class="my-5 border-line" />
	<MacroBars
		protein={{ value: grams(nutrition.protein_g), target: goal?.protein_g ?? null }}
		carbs={{ value: grams(nutrition.carbs_g), target: goal?.carbs_g ?? null }}
		fat={{ value: grams(nutrition.fat_g), target: goal?.fat_g ?? null }}
	/>
</Card>
