<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import ActivityTiles from '#lib/components/dashboard/ActivityTiles.svelte';
	import EnergyHero from '#lib/components/dashboard/EnergyHero.svelte';
	import LatestActivityCard from '#lib/components/dashboard/LatestActivityCard.svelte';
	import MacroCard from '#lib/components/dashboard/MacroCard.svelte';
	import MealsPreview from '#lib/components/dashboard/MealsPreview.svelte';
	import Logo from '#lib/components/shared/Logo.svelte';
	import { formatLongDate } from '#lib/format.js';
	import { mealTypeForHour, type MealType } from '#lib/nutrition.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const dashboard = $derived(data.dashboard);
	const goal = $derived(dashboard.goal);
	const name = $derived(data.profile.display_name?.split(/\s+/)[0] ?? '');

	const greeting = $derived.by(() => {
		const h = data.hour;
		if (h >= 5 && h < 12) return name ? m.greeting_morning({ name }) : m.greeting_morning_plain();
		if (h >= 12 && h < 18)
			return name ? m.greeting_afternoon({ name }) : m.greeting_afternoon_plain();
		return name ? m.greeting_evening({ name }) : m.greeting_evening_plain();
	});

	const diaryHref = resolve('/app/nutrition');
	const addHref = (type: MealType) =>
		`${resolve('/app/nutrition/search')}?type=${type}` as ResolvedPathname;
</script>

<svelte:head><title>{m.today_title()} · {m.app_name()}</title></svelte:head>

<section
	class="rounded-b-[32px] bg-linear-to-br from-green-dark to-green px-5 pt-[max(1.75rem,env(safe-area-inset-top))] pb-16 text-white"
>
	<div class="mb-6 flex items-center gap-3.5">
		<span class="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/95 shadow-card">
			<Logo size={36} wordmark={false} />
		</span>
		<div class="min-w-0">
			<p class="eyebrow text-white/80!">{formatLongDate(dashboard.date)}</p>
			<h1 class="heading text-[26px] leading-tight font-bold text-white!">{greeting}</h1>
		</div>
	</div>
	<EnergyHero
		consumedKcal={Math.round(dashboard.nutrition.kcal)}
		goalKcal={goal?.calories_kcal ?? null}
		activeKcal={dashboard.activity.active_kcal}
	/>
</section>

<div class="-mt-10 space-y-6 px-4">
	<MacroCard
		protein={{ value: dashboard.nutrition.protein_g, target: goal?.protein_g ?? null }}
		carbs={{ value: dashboard.nutrition.carbs_g, target: goal?.carbs_g ?? null }}
		fat={{ value: dashboard.nutrition.fat_g, target: goal?.fat_g ?? null }}
		showStatus={dashboard.nutrition.logged}
	/>

	<section>
		<div class="mb-3 flex items-baseline justify-between px-1">
			<h2 class="heading text-[19px] font-bold">{m.daily_activity()}</h2>
			<a href={resolve('/app/activity')} class="text-sm font-bold text-green">{m.view_all()}</a>
		</div>
		<ActivityTiles
			gymMinutes={dashboard.activity.gym_minutes}
			steps={dashboard.activity.steps}
			activeKcal={dashboard.activity.active_kcal}
		/>
	</section>

	<section>
		<div class="mb-3 flex items-end justify-between px-1">
			<div>
				<p class="eyebrow">{m.food_diary()}</p>
				<h2 class="mt-1 heading text-[19px] font-bold">{m.todays_meals()}</h2>
			</div>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built from resolve() -->
			<a
				href={addHref(mealTypeForHour(data.hour))}
				class="grid size-12 place-items-center rounded-full bg-green text-white shadow-card hover:bg-green-dark"
				aria-label={m.add_food()}
			>
				<Plus class="size-6" aria-hidden="true" />
			</a>
		</div>
		<MealsPreview meals={dashboard.meals} timeZone={data.profile.timezone} {diaryHref} {addHref} />
	</section>

	<LatestActivityCard latest={dashboard.activity.latest} today={dashboard.date} />
</div>
