<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { ACTIVITY_PREFERENCES, type ActivityPreference } from '#lib/goals.js';
	import { m } from '#lib/paraglide/messages.js';

	type Props = {
		value: ActivityPreference[];
		disabled?: boolean;
		onchange: (next: ActivityPreference[]) => void;
	};

	let { value, disabled = false, onchange }: Props = $props();

	const labels: Record<ActivityPreference, () => string> = {
		gym: m.pref_gym,
		running: m.pref_running,
		walking: m.pref_walking,
		cycling: m.pref_cycling,
		other: m.pref_other
	};

	function toggle(pref: ActivityPreference) {
		onchange(value.includes(pref) ? value.filter((p) => p !== pref) : [...value, pref]);
	}
</script>

<div class="flex flex-wrap gap-2">
	{#each ACTIVITY_PREFERENCES as pref (pref)}
		{@const on = value.includes(pref)}
		<button
			type="button"
			aria-pressed={on}
			{disabled}
			class={[
				'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors disabled:opacity-60',
				on ? 'border-green bg-mint text-green' : 'border-line bg-white text-muted hover:text-ink'
			]}
			onclick={() => toggle(pref)}
		>
			{#if on}<Check class="size-4" aria-hidden="true" />{/if}
			{labels[pref]()}
		</button>
	{/each}
</div>
