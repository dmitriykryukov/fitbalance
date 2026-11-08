<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { api } from '#lib/api/client.js';
	import GoalsForm from '#lib/components/profile/GoalsForm.svelte';
	import PersonalDetailsFields from '#lib/components/profile/PersonalDetailsFields.svelte';
	import Button from '#lib/components/shared/Button.svelte';
	import Card from '#lib/components/shared/Card.svelte';
	import ErrorBanner from '#lib/components/shared/ErrorBanner.svelte';
	import { localDate } from '#lib/dates.js';
	import { apiErrorToForm, type FieldErrors } from '#lib/forms.js';
	import { m } from '#lib/paraglide/messages.js';
	import {
		detailsFromProfile,
		detailsToPatch,
		draftFromGoal,
		draftToInput
	} from '#lib/profile-form.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const detectedZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

	let step = $state<1 | 2>(1);
	// Form state starts from the loaded profile once; edits stay local until saved.
	// svelte-ignore state_referenced_locally
	let details = $state(detailsFromProfile(data.profile, data.latestWeightKg, detectedZone));
	let goals = $state(draftFromGoal(null));
	let errors = $state<FieldErrors>({});
	let message = $state<string | null>(null);
	let saving = $state<'next' | 'finish' | 'skip' | null>(null);
	// svelte-ignore state_referenced_locally
	let savedWeight = data.latestWeightKg;

	async function saveDetails() {
		const result = detailsToPatch(details, data.today);
		errors = result.errors;
		message = null;
		if (Object.keys(errors).length > 0) return;

		saving = 'next';
		try {
			await api('PATCH', '/api/profile', result.patch);
			if (result.weightKg !== null && result.weightKg !== savedWeight) {
				await api('POST', '/api/measurements', {
					local_date: localDate(details.timezone),
					weight_kg: result.weightKg
				});
				savedWeight = result.weightKg;
			}
			step = 2;
			window.scrollTo({ top: 0 });
		} catch (error) {
			({ message, fields: errors } = apiErrorToForm(error));
		} finally {
			saving = null;
		}
	}

	async function finish(withGoals: boolean) {
		message = null;
		if (withGoals) {
			const result = draftToInput(goals);
			errors = result.errors;
			if (Object.keys(errors).length > 0) return;
			saving = 'finish';
			try {
				await api('PUT', '/api/goals', result.input);
			} catch (error) {
				({ message, fields: errors } = apiErrorToForm(error));
				saving = null;
				return;
			}
		} else {
			saving = 'skip';
		}

		try {
			await api('PATCH', '/api/profile', { onboarded: true });
			await goto(resolve('/app'), { refreshAll: true });
		} catch (error) {
			({ message } = apiErrorToForm(error));
			saving = null;
		}
	}
</script>

<svelte:head><title>{m.onboarding_title()} · {m.app_name()}</title></svelte:head>

<main
	class="mx-auto max-w-[480px] px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]"
>
	<p class="eyebrow">{m.onboarding_step({ step, total: 2 })}</p>
	<div class="mt-2 mb-5 grid grid-cols-2 gap-1.5" aria-hidden="true">
		<span class="h-1.5 rounded-full bg-green"></span>
		<span class={['h-1.5 rounded-full', step === 2 ? 'bg-green' : 'bg-line']}></span>
	</div>

	{#if step === 1}
		<h1 class="heading text-[28px] leading-tight font-bold">{m.onboarding_details_title()}</h1>
		<p class="mt-1.5 text-[15px] text-muted">{m.onboarding_details_subtitle()}</p>

		<form
			class="mt-6 space-y-5"
			novalidate
			onsubmit={(event) => {
				event.preventDefault();
				void saveDetails();
			}}
		>
			{#if message}<ErrorBanner {message} />{/if}
			<Card>
				<PersonalDetailsFields bind:values={details} {errors} today={data.today} includeWeight />
			</Card>
			<Button type="submit" full size="lg" loading={saving === 'next'}>{m.continue()}</Button>
		</form>
	{:else}
		<h1 class="heading text-[28px] leading-tight font-bold">{m.onboarding_goals_title()}</h1>
		<p class="mt-1.5 text-[15px] text-muted">{m.onboarding_goals_subtitle()}</p>

		<form
			class="mt-6 space-y-5"
			novalidate
			onsubmit={(event) => {
				event.preventDefault();
				void finish(true);
			}}
		>
			{#if message}<ErrorBanner {message} />{/if}
			<Card>
				<GoalsForm bind:values={goals} bind:errors autoSuggest showBodyTargets={false} />
			</Card>
			<Button type="submit" full size="lg" loading={saving === 'finish'} disabled={!!saving}>
				{m.onboarding_finish()}
			</Button>
			<div class="grid grid-cols-2 gap-2">
				<Button variant="ghost" disabled={!!saving} onclick={() => (step = 1)}>{m.back()}</Button>
				<Button
					variant="ghost"
					loading={saving === 'skip'}
					disabled={!!saving}
					onclick={() => finish(false)}
				>
					{m.onboarding_skip()}
				</Button>
			</div>
		</form>
	{/if}
</main>
