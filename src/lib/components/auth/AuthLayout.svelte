<script lang="ts">
	import type { Snippet } from 'svelte';
	import LanguageSwitch from '#lib/components/shared/LanguageSwitch.svelte';
	import Logo from '#lib/components/shared/Logo.svelte';

	type Props = { title: string; subtitle?: string; children: Snippet; footer?: Snippet };

	let { title, subtitle, children, footer }: Props = $props();
</script>

<main
	class="mx-auto flex min-h-dvh max-w-[440px] flex-col px-5 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
>
	<Logo size={44} class="mb-8" />

	<h1 class="heading text-[28px] leading-tight font-bold">{title}</h1>
	{#if subtitle}
		<p class="mt-1.5 text-[15px] text-muted">{subtitle}</p>
	{/if}

	<div class="mt-7">
		{@render children()}
	</div>

	{#if footer}
		<div class="mt-6 text-center text-sm text-muted">{@render footer()}</div>
	{/if}

	<div class="mt-auto pt-10">
		<LanguageSwitch />
	</div>
</main>
