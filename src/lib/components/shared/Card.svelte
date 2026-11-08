<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLDivElement> & {
		children: Snippet;
		/** Inner padding. "none" for cards whose rows draw their own padding. */
		padding?: 'none' | 'sm' | 'md';
	};

	let { children, padding = 'md', class: className = '', ...rest }: Props = $props();

	const paddings = { none: '', sm: 'p-4', md: 'p-5' };
</script>

<div
	class={['rounded-card border border-line bg-white shadow-card', paddings[padding], className]}
	{...rest}
>
	{@render children()}
</div>
