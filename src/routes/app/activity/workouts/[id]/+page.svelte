<script lang="ts">
	import { resolve } from '$app/paths';
	import StrengthForm from '#lib/components/activity/StrengthForm.svelte';
	import PageHeader from '#lib/components/layout/PageHeader.svelte';
	import { formatLongDate } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	let draft = $state(structuredClone(data.draft));
</script>

<svelte:head><title>{m.edit_workout()} · {m.app_name()}</title></svelte:head>

<PageHeader
	title={m.edit_workout()}
	subtitle={formatLongDate(data.draft.local_date)}
	backHref={resolve('/app/activity')}
/>

{#key data.workoutId}
	<StrengthForm
		bind:draft
		workoutId={data.workoutId}
		weightKg={data.weightKg}
		timeZone={data.profile.timezone}
		today={data.today}
	/>
{/key}
