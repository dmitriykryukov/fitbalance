<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { m } from '#lib/paraglide/messages.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{m.app_name()}</title>
</svelte:head>

{@render children()}
