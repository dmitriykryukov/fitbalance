<script lang="ts">
	import { Sparkles } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import PageHeader from '#lib/components/layout/PageHeader.svelte';
	import MealEditor from '#lib/components/nutrition/MealEditor.svelte';
	import { formatLongDate } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const aiHref = $derived(
		`${resolve('/app/nutrition/ai')}?type=${data.draft.meal_type}${data.draft.local_date === data.today ? '' : `&date=${data.draft.local_date}`}` as ResolvedPathname
	);
</script>

<svelte:head><title>{m.add_food_title()} · {m.app_name()}</title></svelte:head>

<PageHeader
	title={m.add_food_title()}
	subtitle={formatLongDate(data.draft.local_date)}
	backHref={resolve('/app/nutrition')}
/>

<div class="-mt-2 mb-3 px-4">
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built from resolve() -->
	<a
		href={aiHref}
		class="inline-flex items-center gap-1.5 text-sm font-semibold text-green underline-offset-2 hover:underline"
	>
		<Sparkles class="size-4" aria-hidden="true" />
		{m.ai_describe_with_ai()}
	</a>
</div>

<MealEditor
	initial={data.draft}
	mealId={null}
	recentFoods={data.recentFoods}
	timeZone={data.profile.timezone}
	today={data.today}
/>
