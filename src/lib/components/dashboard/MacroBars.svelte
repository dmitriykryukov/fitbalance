<script lang="ts">
	import ProgressBar from '#lib/components/shared/ProgressBar.svelte';
	import { formatNumber } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';

	/** `value` null: nothing logged that day (shown as —, never 0). */
	type Macro = { value: number | null; target: number | null };
	type Props = { protein: Macro; carbs: Macro; fat: Macro };

	let { protein, carbs, fat }: Props = $props();

	const show = (value: number | null) => (value === null ? '—' : formatNumber(value));

	const rows = $derived([
		{ label: m.protein(), macro: protein, color: 'green' as const },
		{ label: m.carbs(), macro: carbs, color: 'orange' as const },
		{ label: m.fat(), macro: fat, color: 'fat' as const }
	]);
</script>

<ul class="space-y-4">
	{#each rows as row (row.label)}
		<li>
			<div class="mb-2 flex items-baseline justify-between gap-3 text-sm">
				<span class="font-medium text-muted">{row.label}</span>
				<span class="font-bold tabular-nums">
					{row.macro.target === null
						? m.grams_value({ value: show(row.macro.value) })
						: m.grams_of_target({
								value: show(row.macro.value),
								target: formatNumber(row.macro.target)
							})}
				</span>
			</div>
			<ProgressBar
				value={row.macro.value ?? 0}
				max={row.macro.target ?? 0}
				color={row.color}
				label={row.label}
			/>
		</li>
	{/each}
</ul>
