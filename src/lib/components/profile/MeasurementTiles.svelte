<script lang="ts">
	import { formatNumber } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { ProfileOverview } from '#lib/server/services/overview.js';

	type Props = { overview: ProfileOverview };

	let { overview }: Props = $props();

	const value = (n: number | null | undefined, digits = 1) =>
		n === null || n === undefined ? null : formatNumber(n, digits);

	const change = $derived.by(() => {
		const c = overview.weekly_weight_change_kg;
		if (c === null) return null;
		const sign = c > 0 ? '+' : c < 0 ? '−' : '±';
		return `${sign}${formatNumber(Math.abs(c), 1)}`;
	});

	const tiles = $derived([
		{ label: m.tile_age(), value: value(overview.age, 0), unit: '' },
		{ label: m.profile_height(), value: value(overview.profile.height_cm), unit: m.unit_cm() },
		{ label: m.tile_weight(), value: value(overview.latest_weight_kg), unit: m.unit_kg() },
		{
			label: m.tile_target_weight(),
			value: value(overview.goal?.target_weight_kg),
			unit: m.unit_kg()
		},
		{ label: m.tile_waist(), value: value(overview.latest_waist_cm), unit: m.unit_cm() },
		{ label: m.tile_weekly_change(), value: change, unit: m.unit_kg() }
	]);
</script>

<dl class="grid grid-cols-3 gap-2">
	{#each tiles as tile (tile.label)}
		<div class="rounded-tile bg-paper px-3 py-2.5">
			<dt class="text-[11px] leading-tight font-semibold text-muted">{tile.label}</dt>
			<dd class="mt-1 heading text-lg leading-none font-bold tabular-nums">
				{#if tile.value === null}
					<span class="text-muted">—</span>
				{:else}
					{tile.value}{#if tile.unit}<span class="ml-0.5 text-xs font-semibold text-muted"
							>{tile.unit}</span
						>{/if}
				{/if}
			</dd>
		</div>
	{/each}
</dl>
