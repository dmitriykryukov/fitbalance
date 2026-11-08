<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'green' | 'amber' | 'neutral' | 'blue';

	let { children, tone = 'green' }: { children: Snippet; tone?: Tone } = $props();

	const tones: Record<Tone, string> = {
		green: 'bg-mint text-green',
		amber: 'bg-orange-bg text-amber-text',
		neutral: 'bg-paper text-muted',
		blue: 'bg-blue-bg text-blue'
	};
</script>

<span
	class={[
		'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
		tones[tone]
	]}
>
	{@render children()}
</span>
