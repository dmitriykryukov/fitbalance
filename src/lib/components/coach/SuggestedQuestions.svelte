<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	type Props = { disabled?: boolean; onpick: (question: string) => void };

	let { disabled = false, onpick }: Props = $props();

	const questions = $derived([
		m.coach_q_week(),
		m.coach_q_protein(),
		m.coach_q_training(),
		m.coach_q_tomorrow()
	]);
</script>

<section aria-label={m.coach_suggested()}>
	<p class="mb-2 px-1 text-xs font-semibold tracking-wider text-muted uppercase">
		{m.coach_suggested()}
	</p>
	<ul class="flex flex-wrap gap-2">
		{#each questions as question (question)}
			<li>
				<button
					type="button"
					{disabled}
					onclick={() => onpick(question)}
					class="rounded-full border border-green/30 bg-white px-3.5 py-2 text-left text-sm font-semibold text-green hover:bg-mint disabled:opacity-50"
				>
					{question}
				</button>
			</li>
		{/each}
	</ul>
</section>
