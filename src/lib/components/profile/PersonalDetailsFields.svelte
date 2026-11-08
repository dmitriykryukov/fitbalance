<script lang="ts">
	import SegmentedControl from '#lib/components/shared/SegmentedControl.svelte';
	import TextField from '#lib/components/shared/TextField.svelte';
	import type { FieldErrors } from '#lib/forms.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { PersonalDetails, SexChoice } from '#lib/profile-form.js';

	type Props = {
		values: PersonalDetails;
		errors?: FieldErrors;
		today: string;
		/** Onboarding asks for the current weight too. */
		includeWeight?: boolean;
	};

	let { values = $bindable(), errors = {}, today, includeWeight = false }: Props = $props();

	const sexOptions: { value: SexChoice; label: string }[] = $derived([
		{ value: 'female', label: m.sex_female() },
		{ value: 'male', label: m.sex_male() },
		{ value: 'unspecified', label: m.sex_unspecified() }
	]);

	const timeZones = $derived.by(() => {
		const zones = Intl.supportedValuesOf('timeZone');
		return zones.includes(values.timezone) ? zones : [values.timezone, ...zones];
	});
</script>

<div class="space-y-4">
	<TextField
		label={m.profile_name()}
		bind:value={values.display_name}
		error={errors.display_name}
		autocomplete="given-name"
		maxlength={80}
		required
	/>
	<TextField
		label={m.profile_date_of_birth()}
		type="date"
		bind:value={values.date_of_birth}
		error={errors.date_of_birth}
		min="1900-01-02"
		max={today}
		autocomplete="bday"
	/>
	<div>
		<SegmentedControl label={m.profile_sex()} options={sexOptions} bind:value={values.sex} />
		<p class="mt-1.5 text-sm text-muted">{m.profile_sex_hint()}</p>
	</div>
	<div class="grid grid-cols-2 gap-3">
		<TextField
			label={m.profile_height()}
			bind:value={values.height_cm}
			error={errors.height_cm}
			inputmode="decimal"
			suffix={m.unit_cm()}
		/>
		{#if includeWeight}
			<TextField
				label={m.profile_weight()}
				bind:value={values.weight_kg}
				error={errors.weight_kg}
				inputmode="decimal"
				suffix={m.unit_kg()}
			/>
		{/if}
	</div>
	<div>
		<label for="timezone" class="mb-1.5 block text-sm font-semibold text-ink">
			{m.profile_timezone()}
		</label>
		<select
			id="timezone"
			bind:value={values.timezone}
			class="h-12 w-full rounded-field border border-line bg-white px-3 text-base text-ink focus:border-green focus:ring-2 focus:ring-green/20 focus:outline-none"
		>
			{#each timeZones as zone (zone)}
				<option value={zone}>{zone.replaceAll('_', ' ')}</option>
			{/each}
		</select>
		<p class="mt-1.5 text-sm text-muted">{m.profile_timezone_hint()}</p>
	</div>
</div>
