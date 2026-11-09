<script lang="ts">
	import { formatShortDate } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { runs, yScale } from './chart.js';

	type Props = {
		/** Every day of the range (the x axis). */
		dates: string[];
		/** One value per date; null = nothing recorded (a gap, never zero). */
		values: (number | null)[];
		/** Optional target per date, drawn as a dashed reference line. */
		target?: (number | null)[];
		/** Connect points across missing days (body trend) instead of leaving gaps. */
		connect?: boolean;
		/** Start the y axis at zero (amounts like kcal); off for body weight. */
		fromZero?: boolean;
		format: (value: number) => string;
		/** Accessible name of the chart, also the table caption. */
		label: string;
		/** Name of the plotted series in the tooltip and table. */
		seriesLabel: string;
		emptyLabel?: string;
		height?: number;
	};

	let {
		dates,
		values,
		target,
		connect = false,
		fromZero = true,
		format,
		label,
		seriesLabel,
		emptyLabel = m.not_logged(),
		height = 180
	}: Props = $props();

	let width = $state(320);
	let hover = $state<number | null>(null);

	const pad = { top: 12, right: 12, bottom: 24, left: 44 };
	const plotW = $derived(Math.max(10, width - pad.left - pad.right));
	const plotH = $derived(height - pad.top - pad.bottom);

	const scale = $derived(
		yScale(
			[...values, ...(target ?? [])].filter((v): v is number => v !== null),
			fromZero
		)
	);
	const x = (i: number) =>
		pad.left + (dates.length <= 1 ? plotW / 2 : (i / (dates.length - 1)) * plotW);
	const y = (v: number) =>
		pad.top + plotH - ((v - scale.min) / (scale.max - scale.min || 1)) * plotH;

	const points = $derived(values.flatMap((v, i) => (v === null ? [] : [{ i, v }])));
	const segments = $derived(
		connect ? (points.length ? [points.map((p) => p.i)] : []) : runs(values)
	);
	const pathFor = (indexes: number[]) =>
		indexes.map((i, n) => `${n ? 'L' : 'M'}${x(i)},${y(values[i]!)}`).join(' ');

	/** Stepped target path; breaks where there is no target. */
	const targetPath = $derived.by(() => {
		if (!target) return '';
		const half = dates.length > 1 ? plotW / (dates.length - 1) / 2 : plotW / 2;
		return runs(target)
			.map((indexes) =>
				indexes
					.map((i, n) => {
						const ty = y(target[i]!);
						const x0 = Math.max(pad.left, x(i) - half);
						const x1 = Math.min(pad.left + plotW, x(i) + half);
						return `${n ? 'L' : 'M'}${x0},${ty} L${x1},${ty}`;
					})
					.join(' ')
			)
			.join(' ');
	});
	const lastTarget = $derived(target?.findLast((t) => t !== null) ?? null);

	// Dots: always for sparse series, and for points without a neighbour (else invisible).
	const showAllDots = $derived(connect || dates.length <= 31);
	const isolated = (i: number) =>
		!connect &&
		(i === 0 || values[i - 1] === null) &&
		(i === values.length - 1 || values[i + 1] === null);

	function move(event: PointerEvent) {
		const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
		const px = event.clientX - rect.left - pad.left;
		const i = Math.round((px / plotW) * (dates.length - 1));
		hover = Math.min(dates.length - 1, Math.max(0, i));
	}

	const xLabels = $derived(
		dates.length > 1 ? [0, Math.floor((dates.length - 1) / 2), dates.length - 1] : [0]
	);
	const tipLeft = $derived(hover === null ? 0 : Math.min(Math.max(x(hover), 70), width - 70));
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
				class="fill-muted text-[11px] tabular-nums">{format(tick)}</text
			>
		{/each}

		{#each xLabels as i (i)}
			<text
				x={x(i)}
				y={height - 6}
				text-anchor={i === 0 ? 'start' : i === dates.length - 1 ? 'end' : 'middle'}
				class="fill-muted text-[11px]">{formatShortDate(dates[i])}</text
			>
		{/each}

		{#if targetPath}
			<path
				d={targetPath}
				fill="none"
				class="stroke-orange"
				stroke-width="1.5"
				stroke-dasharray="5 4"
			/>
		{/if}

		{#each segments as indexes, n (n)}
			{#if indexes.length > 1}
				<path
					d={pathFor(indexes)}
					fill="none"
					class="stroke-green"
					stroke-width="2"
					stroke-linejoin="round"
					stroke-linecap="round"
				/>
			{/if}
		{/each}

		{#each points as p (p.i)}
			{#if showAllDots || isolated(p.i) || hover === p.i}
				<circle cx={x(p.i)} cy={y(p.v)} r="4" class="fill-green stroke-white" stroke-width="2" />
			{/if}
		{/each}

		{#if hover !== null}
			<line
				x1={x(hover)}
				x2={x(hover)}
				y1={pad.top}
				y2={pad.top + plotH}
				class="stroke-muted/50"
				stroke-width="1"
			/>
		{/if}
	</svg>

	{#if lastTarget !== null}
		<p class="mt-1 flex items-center gap-2 text-xs text-muted">
			<span class="inline-block w-4 border-t-[1.5px] border-dashed border-orange"></span>
			{m.chart_target({ value: format(lastTarget) })}
		</p>
	{/if}

	{#if hover !== null}
		<div
			class="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-field border border-line bg-white px-2.5 py-1.5 text-xs shadow-card"
			style:left="{tipLeft}px"
			aria-hidden="true"
		>
			<p class="font-semibold">{formatShortDate(dates[hover])}</p>
			<p class="tabular-nums">
				{values[hover] === null ? emptyLabel : `${seriesLabel}: ${format(values[hover]!)}`}
			</p>
			{#if target?.[hover] != null}
				<p class="text-muted tabular-nums">{m.chart_target({ value: format(target[hover]!) })}</p>
			{/if}
		</div>
	{/if}

	<table class="sr-only">
		<caption>{label}</caption>
		<thead>
			<tr><th scope="col">{m.chart_date()}</th><th scope="col">{seriesLabel}</th></tr>
		</thead>
		<tbody>
			{#each dates as date, i (date)}
				{#if !connect || values[i] !== null}
					<tr>
						<th scope="row">{formatShortDate(date)}</th>
						<td>{values[i] === null ? emptyLabel : format(values[i]!)}</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>
</figure>
