<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import type { ResolvedPathname } from '$app/types';

	type Variant = 'primary' | 'soft' | 'outline' | 'ghost' | 'danger';
	type Size = 'sm' | 'md' | 'lg';

	type Props = HTMLButtonAttributes & {
		children: Snippet;
		variant?: Variant;
		size?: Size;
		/** Renders a link styled as a button. Pass a `resolve()` result. */
		href?: ResolvedPathname;
		loading?: boolean;
		full?: boolean;
	};

	let {
		children,
		variant = 'primary',
		size = 'md',
		href,
		loading = false,
		full = false,
		disabled,
		class: className = '',
		...rest
	}: Props = $props();

	const variants: Record<Variant, string> = {
		primary: 'bg-green text-white hover:bg-green-dark',
		soft: 'bg-mint text-green hover:bg-mint-strong',
		outline: 'border border-line bg-white text-ink hover:bg-paper',
		ghost: 'text-green hover:bg-mint',
		danger: 'bg-red-600 text-white hover:bg-red-700'
	};
	const sizes: Record<Size, string> = {
		sm: 'h-9 px-3 text-sm',
		md: 'h-11 px-4 text-[15px]',
		lg: 'h-13 px-5 text-base'
	};

	const classes = $derived([
		'inline-flex items-center justify-center gap-2 rounded-tile font-semibold transition-colors',
		'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green',
		'disabled:cursor-not-allowed disabled:opacity-50',
		variants[variant],
		sizes[size],
		full && 'w-full',
		className
	]);
</script>

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- typed as ResolvedPathname -->
	<a {href} class={classes}>{@render children()}</a>
{:else}
	<button class={classes} disabled={disabled || loading} aria-busy={loading} {...rest}>
		{#if loading}
			<span
				class="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
				aria-hidden="true"
			></span>
		{/if}
		{@render children()}
	</button>
{/if}
