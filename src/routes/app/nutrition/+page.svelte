<script lang="ts">
	import { ChevronRight, Plus, Sparkles, UtensilsCrossed } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import PageHeader from '#lib/components/layout/PageHeader.svelte';
	import DayEnergyCard from '#lib/components/nutrition/DayEnergyCard.svelte';
	import MealCard from '#lib/components/nutrition/MealCard.svelte';
	import Button from '#lib/components/shared/Button.svelte';
	import Card from '#lib/components/shared/Card.svelte';
	import DateChip from '#lib/components/shared/DateChip.svelte';
	import EmptyState from '#lib/components/shared/EmptyState.svelte';
	import { localHour } from '#lib/dates.js';
	import { formatLongDate } from '#lib/format.js';
	import { mealTypeLabel } from '#lib/labels.js';
	import { MEAL_TYPES, mealTypeForHour, type MealType } from '#lib/nutrition.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const diary = resolve('/app/nutrition');
	const hrefFor = (date: string) =>
		(date === data.today ? diary : `${diary}?date=${date}`) as ResolvedPathname;
	const addHref = (type: MealType) => {
		const date = data.date === data.today ? '' : `&date=${data.date}`;
		return `${resolve('/app/nutrition/search')}?type=${type}${date}` as ResolvedPathname;
	};

	const defaultType = $derived(
		data.date === data.today ? mealTypeForHour(localHour(data.profile.timezone)) : 'lunch'
	);
	const aiHref = $derived(
		`${resolve('/app/nutrition/ai')}?type=${defaultType}${data.date === data.today ? '' : `&date=${data.date}`}` as ResolvedPathname
	);
	const unlogged = $derived(
		MEAL_TYPES.filter((type) => !data.meals.some((meal) => meal.meal_type === type))
	);
</script>

<svelte:head><title>{m.nutrition_title()} · {m.app_name()}</title></svelte:head>

<PageHeader title={m.nutrition_title()} subtitle={formatLongDate(data.date)}>
	{#snippet actions()}
		<DateChip date={data.date} today={data.today} {hrefFor} />
	{/snippet}
</PageHeader>

<div class="space-y-6 px-4">
	<DayEnergyCard nutrition={data.nutrition} goal={data.goal} />

	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built from resolve() -->
	<a
		href={aiHref}
		class="flex items-center gap-4 rounded-card border border-green/15 bg-mint p-4 shadow-card transition-colors hover:border-green/40"
	>
		<span class="grid size-12 shrink-0 place-items-center rounded-tile bg-green text-white">
			<Sparkles class="size-6" aria-hidden="true" />
		</span>
		<span class="min-w-0 flex-1">
			<span class="block heading text-base font-bold text-ink">{m.ai_log_card_title()}</span>
			<span class="mt-0.5 block text-sm text-muted">{m.ai_log_card_body()}</span>
		</span>
		<ChevronRight class="size-5 shrink-0 text-green" aria-hidden="true" />
	</a>

	<section>
		<div class="mb-3 flex items-end justify-between gap-3 px-1">
			<div>
				<p class="eyebrow">{m.daily_diary()}</p>
				<h2 class="mt-1 heading text-[19px] font-bold">{m.meals_title()}</h2>
			</div>
			<Button size="sm" href={addHref(defaultType)}>
				<Plus class="size-4" aria-hidden="true" />
				{m.add_food()}
			</Button>
		</div>

		{#if data.meals.length === 0}
			<Card>
				<EmptyState icon={UtensilsCrossed} title={m.meal_empty_hint()} />
			</Card>
		{:else}
			<ul class="space-y-3">
				{#each data.meals as meal (meal.id)}
					<li><MealCard {meal} timeZone={data.profile.timezone} /></li>
				{/each}
			</ul>
		{/if}

		{#if unlogged.length > 0}
			<ul class="mt-3 grid grid-cols-2 gap-2">
				{#each unlogged as type (type)}
					<li>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built from resolve() -->
						<a
							href={addHref(type)}
							class="flex min-h-12 items-center gap-2 rounded-tile border border-dashed border-line bg-white/60 px-3.5 text-sm font-semibold text-muted hover:border-green hover:text-green"
						>
							<Plus class="size-4 shrink-0" aria-hidden="true" />
							<span class="min-w-0 truncate">{mealTypeLabel(type)}</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
