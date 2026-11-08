<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import PageHeader from '#lib/components/layout/PageHeader.svelte';
	import MealEditor from '#lib/components/nutrition/MealEditor.svelte';
	import { formatLongDate } from '#lib/format.js';
	import { mealTypeLabel } from '#lib/labels.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const back = $derived(
		(data.draft.local_date === data.today
			? resolve('/app/nutrition')
			: `${resolve('/app/nutrition')}?date=${data.draft.local_date}`) as ResolvedPathname
	);
</script>

<svelte:head><title>{m.edit_meal()} · {m.app_name()}</title></svelte:head>

<PageHeader
	title={mealTypeLabel(data.draft.meal_type)}
	subtitle={formatLongDate(data.draft.local_date)}
	backHref={back}
/>

{#key data.mealId}
	<MealEditor
		initial={data.draft}
		mealId={data.mealId}
		recentFoods={data.recentFoods}
		timeZone={data.profile.timezone}
		today={data.today}
	/>
{/key}
