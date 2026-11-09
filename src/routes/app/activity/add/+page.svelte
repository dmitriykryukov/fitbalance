<script lang="ts">
	import { resolve } from '$app/paths';
	import { emptyCardioDraft, emptyStrengthDraft } from '#lib/activity-form.js';
	import { LOG_TYPES, type LogType } from '#lib/activity.js';
	import ActivityTypeTabs from '#lib/components/activity/ActivityTypeTabs.svelte';
	import CardioForm from '#lib/components/activity/CardioForm.svelte';
	import StrengthForm from '#lib/components/activity/StrengthForm.svelte';
	import PageHeader from '#lib/components/layout/PageHeader.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Both drafts live here so switching tabs keeps what was typed.
	// svelte-ignore state_referenced_locally
	let type = $state<LogType>(data.type);
	// svelte-ignore state_referenced_locally
	let cardio = $state(
		emptyCardioDraft(data.type === 'strength' ? 'running' : data.type, data.date, data.time)
	);
	// svelte-ignore state_referenced_locally
	let strength = $state(emptyStrengthDraft(data.date, data.time, m.strength_default_title()));

	function select(next: LogType) {
		type = next;
		if (next !== 'strength') cardio.activity_type = next;
	}
</script>

<svelte:head><title>{m.add_workout()} · {m.app_name()}</title></svelte:head>

<PageHeader title={m.add_workout()} backHref={resolve('/app/activity')} />

<div class="mb-4 px-4">
	<ActivityTypeTabs types={LOG_TYPES} value={type} onchange={select} />
</div>

{#if type === 'strength'}
	<StrengthForm
		bind:draft={strength}
		workoutId={null}
		weightKg={data.weightKg}
		timeZone={data.profile.timezone}
		today={data.today}
	/>
{:else}
	<CardioForm
		bind:draft={cardio}
		activityId={null}
		weightKg={data.weightKg}
		timeZone={data.profile.timezone}
		today={data.today}
	/>
{/if}
