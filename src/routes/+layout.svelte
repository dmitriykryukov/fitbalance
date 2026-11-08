<script lang="ts">
	import './layout.css';
	import { m } from '#lib/paraglide/messages.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>{m.app_name()}</title>
</svelte:head>

{@render children()}
