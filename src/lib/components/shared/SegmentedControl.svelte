<script lang="ts" generics="T extends string">
	type Option = { value: T; label: string };

	type Props = {
		label: string;
		options: Option[];
		value: T | null;
		/** Hide the visible label (it stays available to screen readers). */
		hideLabel?: boolean;
		onchange?: (value: T) => void;
	};

	let { label, options, value = $bindable(), hideLabel = false, onchange }: Props = $props();

	function select(next: T) {
		value = next;
		onchange?.(next);
	}
</script>

<fieldset>
	<legend class={hideLabel ? 'sr-only' : 'mb-1.5 text-sm font-semibold text-ink'}>{label}</legend>
	<div
		class="grid gap-1 rounded-tile bg-line/60 p-1"
		style:grid-template-columns="repeat({options.length}, minmax(0, 1fr))"
	>
		{#each options as option (option.value)}
			<button
				type="button"
				class={[
					'min-h-10 rounded-field px-2 text-sm font-semibold transition-colors',
					option.value === value ? 'bg-white text-ink shadow-card' : 'text-muted hover:text-ink'
				]}
				aria-pressed={option.value === value}
				onclick={() => select(option.value)}
			>
				{option.label}
			</button>
		{/each}
	</div>
</fieldset>
