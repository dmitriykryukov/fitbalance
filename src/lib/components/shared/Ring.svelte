<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		value: number;
		max: number;
		size?: number;
		stroke?: number;
		trackColor?: string;
		progressColor?: string;
		label: string;
		children?: Snippet;
	};

	let {
		value,
		max,
		size = 136,
		stroke = 12,
		trackColor = 'rgb(255 255 255 / 0.18)',
		progressColor = '#a6d8c5',
		label,
		children
	}: Props = $props();

	const radius = $derived((size - stroke) / 2);
	const circumference = $derived(2 * Math.PI * radius);
	const fraction = $derived(max > 0 ? Math.min(1, Math.max(0, value / max)) : 0);
</script>

<div class="relative shrink-0" style:width="{size}px" style:height="{size}px">
	<svg
		width={size}
		height={size}
		viewBox="0 0 {size} {size}"
		class="-rotate-90"
		role="img"
		aria-label={label}
	>
		<circle
			cx={size / 2}
			cy={size / 2}
			r={radius}
			fill="none"
			stroke={trackColor}
			stroke-width={stroke}
		/>
		<circle
			cx={size / 2}
			cy={size / 2}
			r={radius}
			fill="none"
			stroke={progressColor}
			stroke-width={stroke}
			stroke-linecap="round"
			stroke-dasharray={circumference}
			stroke-dashoffset={circumference * (1 - fraction)}
			class="transition-[stroke-dashoffset] duration-500"
		/>
	</svg>
	{#if children}
		<div class="absolute inset-0 flex flex-col items-center justify-center text-center">
			{@render children()}
		</div>
	{/if}
</div>
