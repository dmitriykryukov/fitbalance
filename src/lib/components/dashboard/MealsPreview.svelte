<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import type { ResolvedPathname } from '$app/types';
	import Card from '#lib/components/shared/Card.svelte';
	import { formatNumber, formatTime } from '#lib/format.js';
	import { mealTypeLabel } from '#lib/labels.js';
	import type { MealType } from '#lib/nutrition.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { MealSummary } from '#lib/server/services/dashboard.js';

	type Props = {
		meals: MealSummary[];
		timeZone: string;
		/** Where a logged row goes (the day in the diary). */
		diaryHref: ResolvedPathname;
		/** Where an unlogged row goes (add food for that meal type). */
		addHref: (type: MealType) => ResolvedPathname;
	};

	let { meals, timeZone, diaryHref, addHref }: Props = $props();

	const badge: Record<MealType, string> = {
		breakfast: 'bg-mint text-green',
		lunch: 'bg-orange-bg text-amber-text',
		dinner: 'bg-blue-bg text-blue',
		snack: 'bg-[#efeaf8] text-[#7a5fb4]'
	};
</script>

<Card padding="none">
	<ul class="divide-y divide-line">
		{#each meals as meal (meal.meal_type)}
			{@const label = mealTypeLabel(meal.meal_type)}
			<li>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- hrefs are ResolvedPathname -->
				<a
					href={meal.logged ? diaryHref : addHref(meal.meal_type)}
					class="flex items-center gap-3.5 px-4 py-3.5 hover:bg-paper/60"
				>
					<span
						class={[
							'grid size-11 shrink-0 place-items-center rounded-tile heading text-lg font-bold',
							badge[meal.meal_type]
						]}
						aria-hidden="true">{label.charAt(0)}</span
					>
					<span class="min-w-0 flex-1">
						<span class="flex items-baseline justify-between gap-3">
							<span class="font-bold">{label}</span>
							{#if meal.logged}
								<span class="shrink-0 font-bold tabular-nums"
									>{m.kcal_value({ value: formatNumber(meal.kcal) })}</span
								>
							{:else}
								<span class="shrink-0 text-sm font-bold text-green">{m.add_food()}</span>
							{/if}
						</span>
						<span class="mt-0.5 block truncate text-sm text-muted">
							{meal.logged ? meal.item_names.join(', ') : m.meal_empty_hint()}
						</span>
						<span class="mt-0.5 block text-xs text-muted/90">
							{meal.logged ? formatTime(meal.logged_at, timeZone) : m.not_logged()}
						</span>
					</span>
					<ChevronRight class="size-5 shrink-0 text-muted" aria-hidden="true" />
				</a>
			</li>
		{/each}
	</ul>
</Card>
