<script lang="ts">
	import { parseMarkdown, type Line } from '#lib/markdown.js';

	let { source }: { source: string } = $props();

	const blocks = $derived(parseMarkdown(source));
</script>

{#snippet line(parts: Line)}
	{#each parts as part, i (i)}
		{#if part.bold && part.italic}<strong><em>{part.text}</em></strong>{:else if part.bold}<strong
				class="font-semibold">{part.text}</strong
			>{:else if part.italic}<em>{part.text}</em>{:else}{part.text}{/if}
	{/each}
{/snippet}

<div class="space-y-2.5">
	{#each blocks as block, b (b)}
		{#if block.type === 'p'}
			<p>
				{#each block.lines as l, i (i)}{#if i > 0}<br />{/if}{@render line(l)}{/each}
			</p>
		{:else if block.type === 'ul'}
			<ul class="list-disc space-y-1 pl-5 marker:text-green">
				{#each block.items as item, i (i)}<li>{@render line(item)}</li>{/each}
			</ul>
		{:else}
			<ol class="list-decimal space-y-1 pl-5 marker:text-green" start={block.start}>
				{#each block.items as item, i (i)}<li>{@render line(item)}</li>{/each}
			</ol>
		{/if}
	{/each}
</div>
