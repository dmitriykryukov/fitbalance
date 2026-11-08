<script lang="ts">
	import type { Component, Snippet } from 'svelte';

	type Props = {
		title: string;
		body?: string;
		icon?: Component<{ class?: string }>;
		action?: Snippet;
	};

	let { title, body, icon: Icon, action }: Props = $props();
</script>

<div class="flex flex-col items-center px-6 py-10 text-center">
	{#if Icon}
		<div class="mb-4 grid size-14 place-items-center rounded-tile bg-mint text-green">
			<Icon class="size-6" />
		</div>
	{/if}
	<p class="heading text-lg font-semibold">{title}</p>
	{#if body}
		<p class="mt-1 max-w-xs text-sm text-muted">{body}</p>
	{/if}
	{#if action}
		<div class="mt-5">{@render action()}</div>
	{/if}
</div>
