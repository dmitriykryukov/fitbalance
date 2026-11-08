<script lang="ts">
	import type { Snippet } from 'svelte';
	import BottomNav from './BottomNav.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="mx-auto min-h-dvh max-w-[480px] bg-paper pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
	<main>
		{@render children()}
	</main>
</div>
<BottomNav />
