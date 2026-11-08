<script lang="ts">
	import AppShell from '#lib/components/layout/AppShell.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<AppShell>
	{@render children()}
</AppShell>
