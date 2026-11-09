<script lang="ts">
	import { formatShortDate } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { yScale } from './chart.js';

	type Props = {
		dates: string[];
		/** One value per date; null = nothing logged (no bar, never a zero bar). */
		values: (number | null)[];
		format: (value: number) => string;
		/** Tick labels (shorter than the tooltip format). */
		formatTick?: (value: number) => string;
		label: string;
		seriesLabel: string;
		height?: number;
	};

	let {
		dates,
		values,
		format,
		formatTick = format,
		label,
		seriesLabel,
		height = 160
	}: Props = $props();

	let width = $state(320);
	let hover = $state<number | null>(null);

	const pad = { top: 12, right: 8, bottom: 24, left: 40 };
	const plotW = $derived(Math.max(10, width - pad.left - pad.right));
	const plotH = $derived(height - pad.top - pad.bottom);
	const scale = $derived(
		yScale(
			values.filter((v): v is number => v !== null),
			true
		)
	);
	const slot = $derived(plotW / Math.max(1, dates.length));
	const barW = $derived(Math.max(2, Math.min(24, slot - 2)));
	const x = (i: number) => pad.left + i * slot + (slot - barW) / 2;
	const y = (v: number) => pad.top + plotH - (v / (scale.max || 1)) * plotH;

	/** Column with a 4px rounded top and a square base. */
	function bar(i: number, v: number) {
		const top = y(v);
		const base = pad.top + plotH;
		const r = Math.min(4, barW / 2, base - top);
		const x0 = x(i);
		const x1 = x0 + barW;
		return `M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x1 - r} Q${x1},${top} ${x1},${top + r} V${base} Z`;
	}

	function move(event: PointerEvent) {
		const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
		const i = Math.floor((event.clientX - rect.left - pad.left) / slot);
		hover = i >= 0 && i < dates.length ? i : null;
	}

	const xLabels = $derived(
		dates.length > 1 ? [0, Math.floor((dates.length - 1) / 2), dates.length - 1] : [0]
	);
	const tipLeft = $derived(
		hover === null ? 0 : Math.min(Math.max(x(hover) + barW / 2, 70), width - 70)
	);
</script>

<figure class="relative" bind:clientWidth={width}>
	<svg
		{width}
		{height}
		role="img"
		aria-label={label}
		class="block touch-pan-y overflow-visible"
		onpointermove={move}
		onpointerdown={move}
		onpointerleave={() => (hover = null)}
	>
		{#each scale.ticks as tick (tick)}
			<line
				x1={pad.left}
				x2={pad.left + plotW}
				y1={y(tick)}
				y2={y(tick)}
				class="stroke-line"
				stroke-width="1"
			/>
			<text
				x={pad.left - 8}
				y={y(tick)}
				dy="0.32em"
				text-anchor="end"
				class="fill-muted text-[11px] tabular-nums">{formatTick(tick)}</text
			>
		{/each}
		{#each xLabels as i (i)}
			<text
				x={x(i) + barW / 2}
				y={height - 6}
				text-anchor={i === 0 ? 'start' : i === dates.length - 1 ? 'end' : 'middle'}
				class="fill-muted text-[11px]">{formatShortDate(dates[i])}</text
			>
		{/each}
		{#each values as v, i (dates[i])}
			{#if v !== null && v > 0}
				<path d={bar(i, v)} class={hover === i ? 'fill-green-dark' : 'fill-green'} />
			{/if}
		{/each}
	</svg>

	{#if hover !== null}
		<div
			class="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-field border border-line bg-white px-2.5 py-1.5 text-xs shadow-card"
			style:left="{tipLeft}px"
			aria-hidden="true"
		>
			<p class="font-semibold">{formatShortDate(dates[hover])}</p>
			<p class="tabular-nums">
				{values[hover] === null ? m.not_logged() : `${seriesLabel}: ${format(values[hover]!)}`}
			</p>
		</div>
	{/if}

	<table class="sr-only">
		<caption>{label}</caption>
		<thead>
			<tr><th scope="col">{m.chart_date()}</th><th scope="col">{seriesLabel}</th></tr>
		</thead>
		<tbody>
			{#each dates as date, i (date)}
				<tr>
					<th scope="row">{formatShortDate(date)}</th>
					<td>{values[i] === null ? m.not_logged() : format(values[i]!)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</figure>
