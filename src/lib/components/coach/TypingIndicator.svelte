<script lang="ts">
	import { Sparkles } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
</script>

<li class="flex items-start gap-2.5" role="status">
	<span
		class="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-mint text-green"
		aria-hidden="true"
	>
		<Sparkles class="size-4" />
	</span>
	<div
		class="flex items-center gap-1.5 rounded-3xl rounded-tl-lg border border-line bg-white px-4 py-4 shadow-card"
	>
		<span class="sr-only">{m.coach_typing()}</span>
		{#each [0, 150, 300] as delay (delay)}
			<span
				class="size-2 animate-bounce rounded-full bg-green/60 motion-reduce:animate-none"
				style:animation-delay="{delay}ms"
				aria-hidden="true"
			></span>
		{/each}
	</div>
</li>
