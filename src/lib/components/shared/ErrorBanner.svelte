<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';

	let { message, onretry }: { message: string; onretry?: () => void } = $props();
</script>

<div
	class="flex items-start gap-3 rounded-tile border border-red-200 bg-red-50 p-4 text-sm text-red-800"
	role="alert"
>
	<CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
	<p class="flex-1">{message}</p>
	{#if onretry}
		<button class="font-semibold underline underline-offset-2" onclick={onretry}>{m.retry()}</button
		>
	{/if}
</div>
