<script lang="ts">
	import { Lightbulb } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { DailyInsight } from '#lib/schemas/coach.js';

	type Props = {
		insight: DailyInsight;
		/** Small label above the title ("Daily insight" on Today, "Practical recommendation" in Coach). */
		label?: string;
	};

	let { insight, label = m.coach_insight_label() }: Props = $props();
</script>

<section
	class="rounded-card bg-linear-to-br from-green-dark to-green p-5 text-white shadow-card"
	aria-label={label}
>
	<div class="flex items-center gap-2">
		<span class="grid size-8 place-items-center rounded-xl bg-white/15" aria-hidden="true">
			<Lightbulb class="size-4" />
		</span>
		<p class="text-[11px] font-semibold tracking-wider text-white/80 uppercase">{label}</p>
		<span
			class="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white/90"
			>{m.coach_ai_label()}</span
		>
	</div>
	<p class="mt-3 heading text-lg leading-snug font-bold text-white!">{insight.title}</p>
	<p class="mt-1.5 text-sm leading-relaxed text-white/85">{insight.body}</p>
</section>
