<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Button from '#lib/components/shared/Button.svelte';
	import EmptyState from '#lib/components/shared/EmptyState.svelte';
	import { m } from '#lib/paraglide/messages.js';
</script>

<svelte:head><title>{m.app_name()}</title></svelte:head>

<main class="mx-auto grid min-h-dvh max-w-[480px] place-items-center bg-paper px-4">
	<EmptyState
		icon={CircleAlert}
		title={page.status === 404 ? m.error_not_found() : m.error_generic()}
		body={page.status === 404 ? undefined : String(page.status)}
	>
		{#snippet action()}
			<Button href={resolve('/app')}>{m.nav_today()}</Button>
		{/snippet}
	</EmptyState>
</main>
