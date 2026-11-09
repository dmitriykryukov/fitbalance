<script lang="ts">
	import { Bike, Dumbbell, Footprints, Activity, Zap } from '@lucide/svelte';
	import type { LogType } from '#lib/activity.js';
	import { logTypeLabel } from '#lib/labels.js';
	import { m } from '#lib/paraglide/messages.js';

	type Props = {
		types: readonly LogType[];
		value: LogType;
		onchange: (type: LogType) => void;
	};

	let { types, value, onchange }: Props = $props();

	const icons = {
		strength: Dumbbell,
		running: Zap,
		walking: Footprints,
		cycling: Bike,
		other: Activity
	} as const;
</script>

<div
	role="radiogroup"
	aria-label={m.activity_type_label()}
	class="-mx-4 [scrollbar-width:none] overflow-x-auto px-4"
>
	<div class="flex w-max gap-2 pb-1">
		{#each types as type (type)}
			{@const Icon = icons[type]}
			<button
				type="button"
				role="radio"
				aria-checked={type === value}
				onclick={() => onchange(type)}
				class={[
					'inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors',
					type === value
						? 'border-green bg-green text-white'
						: 'border-line bg-white text-ink hover:border-green/50'
				]}
			>
				<Icon class="size-4" aria-hidden="true" />
				{logTypeLabel(type)}
			</button>
		{/each}
	</div>
</div>
