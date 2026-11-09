<script lang="ts">
	import { Sparkles } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import Markdown from './Markdown.svelte';

	type Props = { role: 'user' | 'assistant'; content: string };

	let { role, content }: Props = $props();
</script>

{#if role === 'user'}
	<li class="flex justify-end">
		<div
			class="max-w-[85%] rounded-3xl rounded-br-lg bg-green px-4 py-2.5 whitespace-pre-wrap text-white"
		>
			<span class="sr-only">{m.coach_you()}:</span>
			{content}
		</div>
	</li>
{:else}
	<li class="flex items-start gap-2.5">
		<span
			class="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-mint text-green"
			aria-hidden="true"
		>
			<Sparkles class="size-4" />
		</span>
		<div
			class="max-w-[85%] min-w-0 rounded-3xl rounded-tl-lg border border-line bg-white px-4 py-3 break-words shadow-card"
		>
			<span class="sr-only">{m.coach_name()}:</span>
			<Markdown source={content} />
		</div>
	</li>
{/if}
