<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeader from '#lib/components/layout/PageHeader.svelte';
	import MealEditor from '#lib/components/nutrition/MealEditor.svelte';
	import { formatLongDate } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>{m.add_food_title()} · {m.app_name()}</title></svelte:head>

<PageHeader
	title={m.add_food_title()}
	subtitle={formatLongDate(data.draft.local_date)}
	backHref={resolve('/app/nutrition')}
/>

<MealEditor
	initial={data.draft}
	mealId={null}
	recentFoods={data.recentFoods}
	timeZone={data.profile.timezone}
	today={data.today}
/>
