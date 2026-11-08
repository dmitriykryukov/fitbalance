<script lang="ts">
	import { Hammer } from '@lucide/svelte';
	import Card from './Card.svelte';
	import EmptyState from './EmptyState.svelte';
	import { m } from '#lib/paraglide/messages.js';

	let { phase }: { phase: number } = $props();
</script>

<div class="px-4">
	<Card padding="none">
		<EmptyState icon={Hammer} title={m.coming_soon_title()} body={m.coming_soon_body({ phase })} />
	</Card>
</div>
