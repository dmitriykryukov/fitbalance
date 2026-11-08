<script lang="ts">
	import Card from '#lib/components/shared/Card.svelte';
	import Chip from '#lib/components/shared/Chip.svelte';
	import { macroStatusLabel } from '#lib/labels.js';
	import { macroStatus } from '#lib/nutrition.js';
	import { m } from '#lib/paraglide/messages.js';
	import MacroBars from './MacroBars.svelte';

	type Macro = { value: number; target: number | null };
	type Props = {
		protein: Macro;
		carbs: Macro;
		fat: Macro;
		/** Show the On track / Under / Over chip (only meaningful once something is logged). */
		showStatus?: boolean;
		eyebrow?: string;
	};

	let { protein, carbs, fat, showStatus = true, eyebrow = m.today_targets() }: Props = $props();

	const status = $derived(showStatus ? macroStatus([protein, carbs, fat]) : null);
</script>

<Card>
	<div class="mb-4 flex items-start justify-between gap-3">
		<div>
			<p class="eyebrow">{eyebrow}</p>
			<h2 class="mt-1 heading text-[19px] font-bold">{m.macronutrients()}</h2>
		</div>
		{#if status}
			<Chip tone={status === 'on_track' ? 'green' : 'amber'}>{macroStatusLabel(status)}</Chip>
		{/if}
	</div>
	<MacroBars {protein} {carbs} {fat} />
</Card>
