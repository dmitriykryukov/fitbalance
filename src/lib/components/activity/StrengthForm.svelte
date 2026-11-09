<script lang="ts">
	import { Dumbbell, Plus, Trash2 } from '@lucide/svelte';
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { api } from '#lib/api/client.js';
	import {
		filledSets,
		newExercise,
		previewKcal,
		strengthToInput,
		type StrengthDraft
	} from '#lib/activity-form.js';
	import { parseDuration } from '#lib/activity.js';
	import Button from '#lib/components/shared/Button.svelte';
	import Card from '#lib/components/shared/Card.svelte';
	import ConfirmDialog from '#lib/components/shared/ConfirmDialog.svelte';
	import EmptyState from '#lib/components/shared/EmptyState.svelte';
	import ErrorBanner from '#lib/components/shared/ErrorBanner.svelte';
	import TextField from '#lib/components/shared/TextField.svelte';
	import { MIN_LOCAL_DATE } from '#lib/dates.js';
	import type { ExerciseSuggestion } from '#lib/exercises.js';
	import { formatNumber } from '#lib/format.js';
	import { apiErrorToForm, type FieldErrors } from '#lib/forms.js';
	import { formatActiveTime } from '#lib/labels.js';
	import { m } from '#lib/paraglide/messages.js';
	import { countExercises, countSets } from '#lib/plural.js';
	import ExerciseCard from './ExerciseCard.svelte';
	import ExercisePicker from './ExercisePicker.svelte';
	import KcalField from './KcalField.svelte';
	import SaveBar from './SaveBar.svelte';

	type Props = {
		draft: StrengthDraft;
		/** Null creates a new workout; an id replaces that one. */
		workoutId: string | null;
		weightKg: number | null;
		timeZone: string;
		today: string;
	};

	let { draft = $bindable(), workoutId, weightKg, timeZone, today }: Props = $props();

	let errors = $state<FieldErrors>({});
	let message = $state<string | null>(null);
	let saving = $state(false);
	let pickerOpen = $state(draft.exercises.length === 0);
	let confirmDelete = $state(false);
	let deleting = $state(false);

	const seconds = $derived(parseDuration(draft.duration));
	const validSeconds = $derived(typeof seconds === 'number' ? seconds : null);
	const kcal = $derived(
		previewKcal(draft, { type: 'strength', durationSeconds: validSeconds, weightKg })
	);
	const estimate = $derived(kcal.estimated ? kcal.value : null);
	const setCount = $derived(draft.exercises.reduce((n, x) => n + filledSets(x).length, 0));

	const activityHome = resolve('/app/activity');

	function addExercise(suggestion: ExerciseSuggestion) {
		draft.exercises = [...draft.exercises, newExercise(suggestion)];
		delete errors.exercises;
		pickerOpen = false;
	}

	function removeExercise(key: string) {
		draft.exercises = draft.exercises.filter((x) => x.key !== key);
		if (draft.exercises.length === 0) pickerOpen = true;
	}

	async function showFirstError() {
		await tick();
		const target = document.querySelector<HTMLElement>('[aria-invalid="true"]');
		target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
		target?.focus({ preventScroll: true });
	}

	async function save() {
		const result = strengthToInput(draft, timeZone);
		errors = result.errors;
		message = null;
		if (!result.input) {
			message = errors.exercises ?? m.error_validation();
			void showFirstError();
			return;
		}
		saving = true;
		try {
			if (workoutId) await api('PUT', `/api/workouts/${workoutId}`, result.input);
			else await api('POST', '/api/workouts', result.input);
			await goto(activityHome, { refreshAll: true });
		} catch (error) {
			const mapped = apiErrorToForm(error);
			message = mapped.message;
			errors = mapped.fields.local_date ? { date: mapped.fields.local_date } : {};
			saving = false;
		}
	}

	async function remove() {
		if (!workoutId) return;
		deleting = true;
		try {
			await api('DELETE', `/api/workouts/${workoutId}`);
			confirmDelete = false;
			await goto(activityHome, { refreshAll: true });
		} catch (error) {
			confirmDelete = false;
			message = apiErrorToForm(error).message;
		} finally {
			deleting = false;
		}
	}

	const footerLabel = $derived(
		[
			m.log_type_strength(),
			countSets(setCount),
			validSeconds ? formatActiveTime(validSeconds) : null
		]
			.filter(Boolean)
			.join(' · ')
	);
	const footerValue = $derived(
		kcal.value === null
			? m.kcal_value({ value: '—' })
			: `${kcal.estimated ? '~ ' : ''}${m.kcal_value({ value: formatNumber(kcal.value) })}`
	);
</script>

<div class="space-y-4 px-4 pb-28">
	{#if message}<ErrorBanner {message} />{/if}

	<Card>
		<TextField
			label={m.workout_title_label()}
			bind:value={draft.title}
			error={errors.title}
			maxlength={80}
			required
		/>
	</Card>

	<section class="space-y-3">
		<div class="flex items-baseline justify-between gap-3 px-1">
			<h2 class="heading text-[17px] font-bold">{m.exercises_title()}</h2>
			{#if draft.exercises.length > 0}
				<span class="text-sm text-muted">
					{countExercises(draft.exercises.length)} · {countSets(setCount)}
				</span>
			{/if}
		</div>

		{#if draft.exercises.length === 0 && !pickerOpen}
			<Card><EmptyState icon={Dumbbell} title={m.workout_no_exercises()} /></Card>
		{/if}

		{#each draft.exercises as exercise, i (exercise.key)}
			<ExerciseCard
				bind:exercise={draft.exercises[i]}
				{errors}
				onremove={() => removeExercise(exercise.key)}
			/>
		{/each}

		{#if pickerOpen}
			<Card>
				<ExercisePicker
					onadd={addExercise}
					oncancel={draft.exercises.length > 0 ? () => (pickerOpen = false) : undefined}
				/>
			</Card>
		{:else if draft.exercises.length < 30}
			<Button variant="soft" full onclick={() => (pickerOpen = true)}>
				<Plus class="size-4" aria-hidden="true" />
				{m.add_exercise()}
			</Button>
		{/if}
		{#if errors.exercises && draft.exercises.length === 0}
			<p class="px-1 text-sm text-red-700">{errors.exercises}</p>
		{/if}
	</section>

	<Card>
		<div class="grid grid-cols-2 gap-3">
			<TextField
				label={m.meal_date()}
				type="date"
				bind:value={draft.local_date}
				error={errors.date}
				min={MIN_LOCAL_DATE}
				max={today}
				required
			/>
			<TextField label={m.start_time()} type="time" bind:value={draft.time} error={errors.time} />
		</div>
		<div class="mt-4 grid grid-cols-2 gap-3">
			<TextField
				label={m.duration_label()}
				bind:value={draft.duration}
				error={errors.duration}
				inputmode="decimal"
				placeholder="—"
				suffix={m.min_short()}
			/>
			<KcalField
				bind:value={draft.kcal}
				bind:edited={draft.kcalEdited}
				{estimate}
				hasWeight={weightKg !== null}
				error={errors.kcal}
			/>
		</div>
		<label class="mt-4 block">
			<span class="mb-1.5 block text-sm font-semibold">{m.meal_notes()}</span>
			<textarea
				bind:value={draft.notes}
				rows="2"
				maxlength="1000"
				class="w-full rounded-field border border-line bg-white px-3.5 py-3 text-base outline-none focus:border-green focus:ring-2 focus:ring-green/20"
			></textarea>
		</label>
	</Card>

	{#if workoutId}
		<Button variant="outline" full class="text-red-700" onclick={() => (confirmDelete = true)}>
			<Trash2 class="size-4" aria-hidden="true" />
			{m.delete_workout()}
		</Button>
	{/if}
</div>

<SaveBar
	label={footerLabel}
	value={footerValue}
	saveLabel={workoutId ? m.save_changes() : m.save_workout()}
	{saving}
	onsave={save}
/>

<ConfirmDialog
	bind:open={confirmDelete}
	title={m.delete_workout_confirm_title()}
	body={m.delete_workout_confirm_body()}
	confirmLabel={m.delete()}
	busy={deleting}
	onconfirm={remove}
/>
