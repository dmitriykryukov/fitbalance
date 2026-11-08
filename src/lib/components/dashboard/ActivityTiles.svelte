<script lang="ts">
	import { Dumbbell, Flame, Footprints } from '@lucide/svelte';
	import { formatNumber } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';

	type Props = {
		/** Null when nothing of that kind is logged (shown as "—", not 0). */
		gymMinutes: number | null;
		steps: number | null;
		activeKcal: number | null;
	};

	let { gymMinutes, steps, activeKcal }: Props = $props();

	const tiles = $derived([
		{ value: gymMinutes, label: m.tile_gym(), icon: Dumbbell, tone: 'bg-mint text-green' },
		{ value: steps, label: m.tile_steps(), icon: Footprints, tone: 'bg-blue-bg text-blue' },
		{
			value: activeKcal,
			label: m.tile_active_kcal(),
			icon: Flame,
			tone: 'bg-orange-bg text-amber-text'
		}
	]);
</script>

<ul class="grid grid-cols-3 gap-2.5">
	{#each tiles as tile (tile.label)}
		<li class="rounded-tile border border-line bg-white p-3.5 shadow-card">
			<span class={['grid size-9 place-items-center rounded-xl', tile.tone]}>
				<tile.icon class="size-[18px]" aria-hidden="true" />
			</span>
			<p class="mt-3 heading text-xl font-bold tabular-nums">
				{tile.value === null ? '—' : formatNumber(tile.value)}
			</p>
			<p class="text-xs leading-tight text-muted">{tile.label}</p>
		</li>
	{/each}
</ul>
