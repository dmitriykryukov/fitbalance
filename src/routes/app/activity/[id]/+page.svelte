<script lang="ts">
	import { resolve } from '$app/paths';
	import { ACTIVITY_TYPES, type LogType } from '#lib/activity.js';
	import ActivityTypeTabs from '#lib/components/activity/ActivityTypeTabs.svelte';
	import CardioForm from '#lib/components/activity/CardioForm.svelte';
	import PageHeader from '#lib/components/layout/PageHeader.svelte';
	import { formatLongDate } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	let draft = $state({ ...data.draft });
</script>

<svelte:head><title>{m.edit_activity()} · {m.app_name()}</title></svelte:head>

<PageHeader
	title={m.edit_activity()}
	subtitle={formatLongDate(data.draft.local_date)}
	backHref={resolve('/app/activity')}
/>

<div class="mb-4 px-4">
	<ActivityTypeTabs
		types={ACTIVITY_TYPES}
		value={draft.activity_type}
		onchange={(type: LogType) => {
			if (type !== 'strength') draft.activity_type = type;
		}}
	/>
</div>

{#key data.activityId}
	<CardioForm
		bind:draft
		activityId={data.activityId}
		weightKg={data.weightKg}
		timeZone={data.profile.timezone}
		today={data.today}
	/>
{/key}
