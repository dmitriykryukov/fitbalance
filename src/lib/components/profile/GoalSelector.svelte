<script lang="ts">
	import { Dumbbell, Scale, TrendingDown } from '@lucide/svelte';
	import type { FitnessGoal } from '#lib/goals.js';
	import { m } from '#lib/paraglide/messages.js';

	type Props = {
		value: FitnessGoal;
		disabled?: boolean;
		onchange?: (goal: FitnessGoal) => void;
	};

	let { value = $bindable(), disabled = false, onchange }: Props = $props();

	const options = $derived([
		{
			value: 'lose_fat' as const,
			label: m.goal_lose_fat(),
			hint: m.goal_lose_fat_hint(),
			Icon: TrendingDown
		},
		{
			value: 'maintain' as const,
			label: m.goal_maintain(),
			hint: m.goal_maintain_hint(),
			Icon: Scale
		},
		{
			value: 'build_muscle' as const,
			label: m.goal_build_muscle(),
			hint: m.goal_build_muscle_hint(),
			Icon: Dumbbell
		}
	]);

	function select(goal: FitnessGoal) {
		if (disabled || goal === value) return;
		value = goal;
		onchange?.(goal);
	}
</script>

<fieldset class="grid grid-cols-3 gap-2" {disabled}>
	<legend class="sr-only">{m.goal_title()}</legend>
	{#each options as option (option.value)}
		{@const active = option.value === value}
		<button
			type="button"
			aria-pressed={active}
			class={[
				'flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-tile border px-1.5 py-3 text-center transition-colors disabled:opacity-60',
				active
					? 'border-green bg-mint text-green'
					: 'border-line bg-white text-ink hover:border-green/40'
			]}
			onclick={() => select(option.value)}
		>
			<option.Icon class="size-5" aria-hidden="true" />
			<span class="text-[13px] leading-tight font-bold [overflow-wrap:anywhere] hyphens-auto"
				>{option.label}</span
			>
			<span class={['text-[11px] leading-tight', active ? 'text-green/80' : 'text-muted']}>
				{option.hint}
			</span>
		</button>
	{/each}
</fieldset>
