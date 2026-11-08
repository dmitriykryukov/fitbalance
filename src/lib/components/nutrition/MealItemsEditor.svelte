<script lang="ts">
	import { X } from '@lucide/svelte';
	import TextField from '#lib/components/shared/TextField.svelte';
	import { formatNumber } from '#lib/format.js';
	import type { FieldErrors } from '#lib/forms.js';
	import { draftItemTotals, draftTotals, type DraftItem } from '#lib/meal-form.js';
	import { m } from '#lib/paraglide/messages.js';

	type Props = { items: DraftItem[]; errors?: FieldErrors };

	let { items = $bindable(), errors = {} }: Props = $props();

	const total = $derived(draftTotals(items));

	function remove(key: string) {
		items = items.filter((item) => item.key !== key);
	}
</script>

<ul class="divide-y divide-line">
	{#each items as item (item.key)}
		{@const totals = draftItemTotals(item)}
		<li class="flex items-start gap-3 py-3 first:pt-0">
			<div class="min-w-0 flex-1 pt-1">
				<p class="font-semibold [overflow-wrap:anywhere]">{item.name}</p>
				<p class="mt-0.5 text-sm font-bold tabular-nums">
					{m.kcal_value({ value: formatNumber(totals.kcal) })}
				</p>
				<p class="text-xs text-muted tabular-nums">
					{m.macro_line({
						p: formatNumber(totals.protein_g, 1),
						c: formatNumber(totals.carbs_g, 1),
						f: formatNumber(totals.fat_g, 1)
					})}
				</p>
			</div>
			<TextField
				class="w-[6.5rem] shrink-0"
				label={m.amount_label()}
				bind:value={item.grams}
				error={errors[`items.${item.key}`]}
				inputmode="decimal"
				suffix={m.unit_g()}
			/>
			<button
				type="button"
				class="mt-7 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-paper hover:text-red-700"
				aria-label={m.remove_item({ name: item.name })}
				onclick={() => remove(item.key)}
			>
				<X class="size-5" aria-hidden="true" />
			</button>
		</li>
	{/each}
</ul>

{#if items.length > 0}
	<div class="mt-1 flex items-baseline justify-between border-t border-line pt-3">
		<span class="font-bold">{m.meal_total()}</span>
		<span class="text-right tabular-nums">
			<span class="font-bold">{m.kcal_value({ value: formatNumber(total.kcal) })}</span>
			<span class="block text-xs text-muted">
				{m.macro_line({
					p: formatNumber(total.protein_g, 1),
					c: formatNumber(total.carbs_g, 1),
					f: formatNumber(total.fat_g, 1)
				})}
			</span>
		</span>
	</div>
{/if}
