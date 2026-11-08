<script lang="ts">
	import Button from '#lib/components/shared/Button.svelte';
	import TextField from '#lib/components/shared/TextField.svelte';
	import { foodDraftToInput, type FoodDraft } from '#lib/food-form.js';
	import { apiErrorToForm, type FieldErrors } from '#lib/forms.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { FoodInput } from '#lib/schemas/nutrition.js';

	type Props = {
		initial: FoodDraft;
		submitLabel?: string;
		/** Saves the food; throw (e.g. ApiClientError) to show an error and keep the input. */
		onsubmit: (input: FoodInput) => Promise<void>;
		oncancel?: () => void;
	};

	let { initial, submitLabel = m.save_food(), onsubmit, oncancel }: Props = $props();

	// svelte-ignore state_referenced_locally
	let draft = $state({ ...initial });
	let errors = $state<FieldErrors>({});
	let message = $state<string | null>(null);
	let warning = $state<string | null>(null);
	/** The energy warning was shown for these exact values; a second press saves. */
	let warnedFor = $state<string | null>(null);
	let saving = $state(false);

	const uid = $props.id();

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		event.stopPropagation();
		const result = foodDraftToInput(draft);
		errors = result.errors;
		message = null;
		warning = result.warning;
		if (!result.input) return;

		const signature = JSON.stringify(result.input);
		if (result.warning && warnedFor !== signature) {
			warnedFor = signature;
			return;
		}

		saving = true;
		try {
			await onsubmit(result.input);
		} catch (error) {
			const mapped = apiErrorToForm(error);
			message = mapped.message;
			errors = {};
			for (const key of Object.keys(mapped.fields)) {
				errors[key.replace('_per_100g', '')] = mapped.fields[key];
			}
		} finally {
			saving = false;
		}
	}
</script>

<form onsubmit={submit} class="space-y-4" novalidate aria-labelledby="{uid}-title">
	<TextField
		label={m.food_name()}
		bind:value={draft.name}
		error={errors.name}
		maxlength={120}
		autocomplete="off"
		required
	/>
	<TextField
		label={m.food_brand()}
		bind:value={draft.brand}
		error={errors.brand}
		maxlength={80}
		autocomplete="off"
	/>

	<fieldset>
		<legend id="{uid}-title" class="mb-2 text-sm font-bold text-ink">
			{m.food_per_100g_title()}
		</legend>
		<div class="grid grid-cols-2 gap-3">
			<TextField
				class="col-span-2"
				label={m.food_kcal()}
				bind:value={draft.kcal}
				error={errors.kcal}
				inputmode="decimal"
				suffix={m.kcal()}
			/>
			<TextField
				label={m.food_protein()}
				bind:value={draft.protein}
				error={errors.protein}
				inputmode="decimal"
				suffix={m.unit_g()}
			/>
			<TextField
				label={m.food_carbs()}
				bind:value={draft.carbs}
				error={errors.carbs}
				inputmode="decimal"
				suffix={m.unit_g()}
			/>
			<TextField
				label={m.food_fat()}
				bind:value={draft.fat}
				error={errors.fat}
				inputmode="decimal"
				suffix={m.unit_g()}
			/>
			<TextField
				label={m.food_fibre()}
				bind:value={draft.fibre}
				error={errors.fibre}
				inputmode="decimal"
				suffix={m.unit_g()}
			/>
		</div>
		{#if errors.macros}<p class="mt-2 text-sm text-red-700">{errors.macros}</p>{/if}
	</fieldset>

	<fieldset>
		<legend class="mb-2 text-sm font-bold text-ink">{m.food_serving_title()}</legend>
		<div class="grid grid-cols-[1fr_8rem] gap-3">
			<TextField
				label={m.food_serving_description()}
				bind:value={draft.serving_description}
				error={errors.serving_description}
				placeholder={m.food_serving_placeholder()}
				maxlength={60}
				autocomplete="off"
			/>
			<TextField
				label={m.food_serving_grams()}
				bind:value={draft.serving_grams}
				error={errors.serving_grams}
				inputmode="decimal"
				suffix={m.unit_g()}
			/>
		</div>
	</fieldset>

	{#if warning && warnedFor}
		<p class="rounded-tile bg-orange-bg px-3.5 py-3 text-sm text-amber-text" role="status">
			{warning}
		</p>
	{/if}
	{#if message}<p class="text-sm text-red-700" role="alert">{message}</p>{/if}

	<div class={['grid gap-2', oncancel ? 'grid-cols-2' : 'grid-cols-1']}>
		{#if oncancel}
			<Button variant="outline" onclick={oncancel} disabled={saving}>{m.cancel()}</Button>
		{/if}
		<Button type="submit" loading={saving}>{submitLabel}</Button>
	</div>
</form>
