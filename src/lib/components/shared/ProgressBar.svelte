<script lang="ts">
	type Color = 'green' | 'orange' | 'fat' | 'blue';

	let {
		value,
		max,
		color = 'green',
		label
	}: { value: number; max: number; color?: Color; label: string } = $props();

	const colors: Record<Color, string> = {
		green: 'bg-green',
		orange: 'bg-orange',
		fat: 'bg-fat',
		blue: 'bg-blue'
	};

	const percent = $derived(max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0);
</script>

<div
	class="h-1.5 w-full overflow-hidden rounded-full bg-line"
	role="progressbar"
	aria-label={label}
	aria-valuemin={0}
	aria-valuemax={max}
	aria-valuenow={value}
>
	<div
		class={['h-full rounded-full transition-[width]', colors[color]]}
		style:width="{percent}%"
	></div>
</div>
