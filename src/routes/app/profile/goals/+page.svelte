<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { api } from '#lib/api/client.js';
	import PageHeader from '#lib/components/layout/PageHeader.svelte';
	import GoalsForm from '#lib/components/profile/GoalsForm.svelte';
	import Button from '#lib/components/shared/Button.svelte';
	import Card from '#lib/components/shared/Card.svelte';
	import ErrorBanner from '#lib/components/shared/ErrorBanner.svelte';
	import { apiErrorToForm, type FieldErrors } from '#lib/forms.js';
	import { m } from '#lib/paraglide/messages.js';
	import { draftFromGoal, draftToInput } from '#lib/profile-form.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	let values = $state(draftFromGoal(data.goal));
	let errors = $state<FieldErrors>({});
	let message = $state<string | null>(null);
	let saving = $state(false);

	async function save() {
		const result = draftToInput(values);
		errors = result.errors;
		message = null;
		if (Object.keys(errors).length > 0) return;
		saving = true;
		try {
			await api('PUT', '/api/goals', result.input);
			await goto(resolve('/app/profile'), { refreshAll: true });
		} catch (error) {
			({ message, fields: errors } = apiErrorToForm(error));
			saving = false;
		}
	}
</script>

<svelte:head><title>{m.targets_edit_title()} · {m.app_name()}</title></svelte:head>

<PageHeader
	title={m.targets_edit_title()}
	subtitle={m.targets_edit_subtitle()}
	backHref={resolve('/app/profile')}
/>

<form
	class="space-y-4 px-4"
	novalidate
	onsubmit={(event) => {
		event.preventDefault();
		void save();
	}}
>
	{#if message}<ErrorBanner {message} />{/if}
	<Card>
		<GoalsForm bind:values bind:errors />
	</Card>
	<Button type="submit" full size="lg" loading={saving}>{m.save()}</Button>
</form>
