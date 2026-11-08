<script lang="ts">
	import { formatNumber } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { Tables } from '#lib/types/database.js';

	type Props = { goal: Tables<'user_goals'> | null };

	let { goal }: Props = $props();

	const macros = $derived([
		{ label: m.protein(), value: goal?.protein_g ?? null, color: 'bg-green' },
		{ label: m.carbs(), value: goal?.carbs_g ?? null, color: 'bg-orange' },
		{ label: m.fat(), value: goal?.fat_g ?? null, color: 'bg-fat' }
	]);
</script>

{#if goal?.calories_kcal == null && macros.every((x) => x.value === null)}
	<p class="text-sm text-muted">{m.targets_empty()}</p>
{:else}
	<p class="heading text-[28px] leading-none font-bold tabular-nums">
		{goal?.calories_kcal == null ? '—' : formatNumber(goal.calories_kcal)}
		<span class="text-sm font-semibold text-muted">{m.kcal_per_day()}</span>
	</p>
	<dl class="mt-4 grid grid-cols-3 gap-2">
		{#each macros as macro (macro.label)}
			<div>
				<dt class="flex items-center gap-1.5 text-xs font-semibold text-muted">
					<span class={['size-2 rounded-full', macro.color]} aria-hidden="true"></span>{macro.label}
				</dt>
				<dd class="mt-0.5 font-bold tabular-nums">
					{macro.value === null ? '—' : m.grams_value({ value: formatNumber(macro.value) })}
				</dd>
			</div>
		{/each}
	</dl>
{/if}
