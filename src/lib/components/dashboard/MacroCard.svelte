<script lang="ts">
	import Card from '#lib/components/shared/Card.svelte';
	import ProgressBar from '#lib/components/shared/ProgressBar.svelte';
	import { formatNumber } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';

	type Macro = { value: number; target: number | null };
	type Props = { protein: Macro; carbs: Macro; fat: Macro };

	let { protein, carbs, fat }: Props = $props();

	const rows = $derived([
		{ label: m.protein(), macro: protein, color: 'green' as const },
		{ label: m.carbs(), macro: carbs, color: 'orange' as const },
		{ label: m.fat(), macro: fat, color: 'fat' as const }
	]);
</script>

<Card>
	<ul class="space-y-4">
		{#each rows as row (row.label)}
			<li>
				<div class="mb-2 flex items-baseline justify-between text-sm">
					<span class="font-medium text-muted">{row.label}</span>
					<span class="font-bold tabular-nums">
						{row.macro.target === null
							? m.grams_value({ value: formatNumber(row.macro.value) })
							: m.grams_of_target({
									value: formatNumber(row.macro.value),
									target: formatNumber(row.macro.target)
								})}
					</span>
				</div>
				<ProgressBar
					value={row.macro.value}
					max={row.macro.target ?? row.macro.value}
					color={row.color}
					label={row.label}
				/>
			</li>
		{/each}
	</ul>
</Card>
