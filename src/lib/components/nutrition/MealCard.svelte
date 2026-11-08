<script lang="ts">
	import { SquarePen } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import Card from '#lib/components/shared/Card.svelte';
	import Chip from '#lib/components/shared/Chip.svelte';
	import { formatNumber, formatTime } from '#lib/format.js';
	import { mealTypeLabel } from '#lib/labels.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { Meal } from '#lib/server/services/meals.js';

	let { meal, timeZone }: { meal: Meal; timeZone: string } = $props();
</script>

<Card padding="none">
	<div class="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
		<div class="min-w-0">
			<h3 class="heading text-lg font-bold">{mealTypeLabel(meal.meal_type)}</h3>
			<p class="text-xs text-muted">{formatTime(meal.logged_at, timeZone)}</p>
		</div>
		<div class="flex shrink-0 flex-col items-end gap-1">
			<span class="font-bold tabular-nums">
				{m.kcal_value({ value: formatNumber(meal.totals.kcal) })}
			</span>
			{#if meal.has_ai_estimates}<Chip tone="amber">{m.estimated()}</Chip>{/if}
		</div>
	</div>
	<a
		href={resolve('/app/nutrition/meals/[id]', { id: meal.id })}
		class="mx-5 flex items-center gap-3 border-t border-line py-3.5"
		aria-label="{m.edit_meal()}: {mealTypeLabel(meal.meal_type)}"
	>
		<span class="min-w-0 flex-1">
			<span class="block text-[15px] [overflow-wrap:anywhere]">
				{meal.items.map((item) => item.name).join(', ')}
			</span>
			<span class="mt-1 block text-xs text-muted tabular-nums">
				{m.macro_line({
					p: formatNumber(meal.totals.protein_g),
					c: formatNumber(meal.totals.carbs_g),
					f: formatNumber(meal.totals.fat_g)
				})}
			</span>
		</span>
		<SquarePen class="size-[18px] shrink-0 text-muted" aria-hidden="true" />
	</a>
</Card>
