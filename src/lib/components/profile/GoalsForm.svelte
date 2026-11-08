<script lang="ts">
	import { Sparkles } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { api } from '#lib/api/client.js';
	import Button from '#lib/components/shared/Button.svelte';
	import Chip from '#lib/components/shared/Chip.svelte';
	import TextField from '#lib/components/shared/TextField.svelte';
	import { numberToInput, parseDecimal, type FieldErrors } from '#lib/forms.js';
	import type { FitnessGoal, Suggestion } from '#lib/goals.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { GoalsDraft } from '#lib/profile-form.js';
	import GoalSelector from './GoalSelector.svelte';

	type SuggestionResult = { suggestion: Suggestion | null; missing: string[] };

	type Props = {
		values: GoalsDraft;
		errors?: FieldErrors;
		/** Fill targets from the suggestion on load and whenever the goal changes. */
		autoSuggest?: boolean;
		/** Show target weight/waist and weekly minutes (the full editor). */
		showBodyTargets?: boolean;
	};

	let {
		values = $bindable(),
		errors = $bindable({}),
		autoSuggest = false,
		showBodyTargets = true
	}: Props = $props();

	let loading = $state(false);
	let missing = $state<string[]>([]);
	let suggestionFailed = $state(false);
	/** True while the macro fields still hold the suggestion (not hand-edited). */
	let fromSuggestion = $state(false);

	const missingLabels = $derived(
		missing.map((field) =>
			field === 'date_of_birth'
				? m.profile_date_of_birth()
				: field === 'height_cm'
					? m.profile_height()
					: m.profile_weight()
		)
	);

	async function suggest(goal: FitnessGoal = values.fitness_goal) {
		loading = true;
		suggestionFailed = false;
		try {
			const params: Record<string, string> = { fitness_goal: goal };
			const minutes = parseDecimal(values.weekly_activity_minutes);
			if (typeof minutes === 'number' && Number.isInteger(minutes)) {
				params.weekly_activity_minutes = String(minutes);
			}
			const query = new URLSearchParams(params).toString();
			const result = await api<SuggestionResult>('GET', `/api/goals/suggestion?${query}`);
			missing = result.missing;
			if (result.suggestion) {
				values.calories_kcal = numberToInput(result.suggestion.calories_kcal);
				values.protein_g = numberToInput(result.suggestion.protein_g);
				values.carbs_g = numberToInput(result.suggestion.carbs_g);
				values.fat_g = numberToInput(result.suggestion.fat_g);
				const filled = ['calories_kcal', 'protein_g', 'carbs_g', 'fat_g'];
				errors = Object.fromEntries(
					Object.entries(errors).filter(([key]) => !filled.includes(key))
				);
				fromSuggestion = true;
			}
		} catch {
			suggestionFailed = true;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (autoSuggest && !values.calories_kcal) void suggest();
	});

	function onGoalChange(goal: FitnessGoal) {
		if (autoSuggest && (fromSuggestion || !values.calories_kcal)) void suggest(goal);
	}

	const manualEdit = () => (fromSuggestion = false);
</script>

<div class="space-y-5">
	<div>
		<p class="mb-2 text-sm font-semibold text-ink">{m.goal_title()}</p>
		<GoalSelector bind:value={values.fitness_goal} onchange={onGoalChange} />
	</div>

	<div class="space-y-3">
		<div class="flex items-center justify-between gap-2">
			<p class="text-sm font-semibold text-ink">{m.targets_title()}</p>
			{#if fromSuggestion}<Chip tone="amber">{m.estimate()}</Chip>{/if}
		</div>
		<TextField
			label={m.targets_calories()}
			bind:value={values.calories_kcal}
			error={errors.calories_kcal}
			inputmode="numeric"
			suffix={m.kcal()}
			oninput={manualEdit}
		/>
		<div class="grid grid-cols-3 gap-2">
			<TextField
				label={m.protein()}
				bind:value={values.protein_g}
				error={errors.protein_g}
				inputmode="decimal"
				suffix={m.unit_g()}
				oninput={manualEdit}
			/>
			<TextField
				label={m.carbs()}
				bind:value={values.carbs_g}
				error={errors.carbs_g}
				inputmode="decimal"
				suffix={m.unit_g()}
				oninput={manualEdit}
			/>
			<TextField
				label={m.fat()}
				bind:value={values.fat_g}
				error={errors.fat_g}
				inputmode="decimal"
				suffix={m.unit_g()}
				oninput={manualEdit}
			/>
		</div>

		<div class="rounded-tile bg-paper p-3">
			<Button variant="soft" size="sm" full {loading} onclick={() => suggest()}>
				<Sparkles class="size-4" aria-hidden="true" />
				{m.targets_suggest()}
			</Button>
			<p class="mt-2 text-xs text-muted">{m.targets_suggest_hint()}</p>
			{#if missing.length > 0}
				<p class="mt-2 text-sm text-amber-text" role="status">
					{m.targets_suggest_missing({ fields: missingLabels.join(', ') })}
					<a href={resolve('/app/profile/edit')} class="font-semibold underline"
						>{m.profile_edit_details()}</a
					>
				</p>
			{/if}
			{#if suggestionFailed}
				<p class="mt-2 text-sm text-red-700" role="alert">{m.error_generic()}</p>
			{/if}
		</div>
	</div>

	{#if showBodyTargets}
		<div class="space-y-3">
			<p class="text-sm font-semibold text-ink">{m.targets_body_title()}</p>
			<div class="grid grid-cols-2 gap-3">
				<TextField
					label={m.targets_weight()}
					bind:value={values.target_weight_kg}
					error={errors.target_weight_kg}
					inputmode="decimal"
					suffix={m.unit_kg()}
				/>
				<TextField
					label={m.targets_waist()}
					bind:value={values.target_waist_cm}
					error={errors.target_waist_cm}
					inputmode="decimal"
					suffix={m.unit_cm()}
				/>
			</div>
			<TextField
				label={m.targets_weekly_minutes()}
				bind:value={values.weekly_activity_minutes}
				error={errors.weekly_activity_minutes}
				inputmode="numeric"
				suffix={m.unit_min()}
				hint={m.targets_weekly_minutes_hint()}
			/>
		</div>
	{/if}
</div>
