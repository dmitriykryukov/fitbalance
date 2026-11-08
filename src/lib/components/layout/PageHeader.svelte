<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ArrowLeft } from '@lucide/svelte';
	import type { ResolvedPathname } from '$app/types';
	import { m } from '#lib/paraglide/messages.js';

	type Props = {
		title: string;
		subtitle?: string;
		/** Shows a back arrow linking here. Pass a `resolve()` result. */
		backHref?: ResolvedPathname;
		actions?: Snippet;
	};

	let { title, subtitle, backHref, actions }: Props = $props();
</script>

<header class="flex items-start gap-3 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4">
	{#if backHref}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- typed as ResolvedPathname -->
		<a
			href={backHref}
			class="-ml-1 grid size-10 shrink-0 place-items-center rounded-full text-ink hover:bg-white"
			aria-label={m.back()}
		>
			<ArrowLeft class="size-5" />
		</a>
	{/if}
	<div class="min-w-0 flex-1">
		<h1 class="heading text-[28px] leading-tight font-bold">{title}</h1>
		{#if subtitle}
			<p class="mt-0.5 text-sm text-muted">{subtitle}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex shrink-0 items-center gap-2">{@render actions()}</div>
	{/if}
</header>
