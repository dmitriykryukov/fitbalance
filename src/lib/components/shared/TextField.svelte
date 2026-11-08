<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = Omit<HTMLInputAttributes, 'value'> & {
		label: string;
		value?: string | null;
		error?: string | null;
		hint?: string;
		/** Unit or icon shown inside the field on the right (e.g. "kg"). */
		suffix?: string | Snippet;
	};

	let {
		label,
		value = $bindable(''),
		error = null,
		hint,
		suffix,
		id,
		class: className = '',
		...rest
	}: Props = $props();

	const uid = $props.id();
	const inputId = $derived(id ?? `field-${uid}`);
	const describedBy = $derived(
		[error ? `${inputId}-error` : null, hint ? `${inputId}-hint` : null]
			.filter(Boolean)
			.join(' ') || undefined
	);
</script>

<div class={className}>
	<label for={inputId} class="mb-1.5 block text-sm font-semibold text-ink">{label}</label>
	<div class="relative">
		<input
			id={inputId}
			bind:value
			aria-invalid={error ? true : undefined}
			aria-describedby={describedBy}
			class={[
				'h-12 w-full rounded-field border bg-white px-3.5 text-base text-ink transition-colors outline-none placeholder:text-muted/70',
				'focus:border-green focus:ring-2 focus:ring-green/20',
				error ? 'border-red-400' : 'border-line',
				suffix && 'pr-12'
			]}
			{...rest}
		/>
		{#if suffix}
			<span
				class="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-muted"
			>
				{#if typeof suffix === 'string'}{suffix}{:else}{@render suffix()}{/if}
			</span>
		{/if}
	</div>
	{#if error}
		<p id="{inputId}-error" class="mt-1.5 text-sm text-red-700">{error}</p>
	{:else if hint}
		<p id="{inputId}-hint" class="mt-1.5 text-sm text-muted">{hint}</p>
	{/if}
</div>
