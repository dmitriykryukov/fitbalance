<script lang="ts">
	import { Trash2 } from '@lucide/svelte';
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { api } from '#lib/api/client.js';
	import {
		cardioToInput,
		parseDistanceKm,
		previewKcal,
		type CardioDraft
	} from '#lib/activity-form.js';
	import { paceSecondsPerKm, parseDuration, speedKmh } from '#lib/activity.js';
	import Button from '#lib/components/shared/Button.svelte';
	import Card from '#lib/components/shared/Card.svelte';
	import ConfirmDialog from '#lib/components/shared/ConfirmDialog.svelte';
	import ErrorBanner from '#lib/components/shared/ErrorBanner.svelte';
	import TextField from '#lib/components/shared/TextField.svelte';
	import { MIN_LOCAL_DATE } from '#lib/dates.js';
	import { formatNumber } from '#lib/format.js';
	import { apiErrorToForm, type FieldErrors } from '#lib/forms.js';
	import { formatActiveTime, formatPace, formatSpeed, logTypeLabel } from '#lib/labels.js';
	import { m } from '#lib/paraglide/messages.js';
	import KcalField from './KcalField.svelte';
	import SaveBar from './SaveBar.svelte';

	type Props = {
		draft: CardioDraft;
		/** Null creates a new activity; an id updates that one. */
		activityId: string | null;
		weightKg: number | null;
		timeZone: string;
		today: string;
	};

	let { draft = $bindable(), activityId, weightKg, timeZone, today }: Props = $props();

	let errors = $state<FieldErrors>({});
	let message = $state<string | null>(null);
	let saving = $state(false);
	let confirmDelete = $state(false);
	let deleting = $state(false);

	const seconds = $derived(parseDuration(draft.duration));
	const meters = $derived(parseDistanceKm(draft.distance));
	const validSeconds = $derived(typeof seconds === 'number' ? seconds : null);
	const validMeters = $derived(typeof meters === 'number' ? meters : null);
	const pace = $derived(validSeconds ? paceSecondsPerKm(validMeters, validSeconds) : null);
	const speed = $derived(validSeconds ? speedKmh(validMeters, validSeconds) : null);
	const kcal = $derived(
		previewKcal(draft, {
			type: draft.activity_type,
			durationSeconds: validSeconds,
			distanceMeters: validMeters,
			weightKg
		})
	);
	const estimate = $derived(kcal.estimated ? kcal.value : null);

	const activityHome = resolve('/app/activity');

	async function save() {
		const result = cardioToInput(draft, timeZone);
		errors = result.errors;
		message = null;
		if (!result.input) {
			message = m.error_validation();
			await tick();
			document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
			return;
		}
		saving = true;
		try {
			if (activityId) await api('PATCH', `/api/activities/${activityId}`, result.input);
			else await api('POST', '/api/activities', result.input);
			await goto(activityHome, { refreshAll: true });
		} catch (error) {
			const mapped = apiErrorToForm(error);
			message = mapped.message;
			errors = {
				...(mapped.fields.local_date ? { date: mapped.fields.local_date } : {}),
				...(mapped.fields.duration_seconds ? { duration: mapped.fields.duration_seconds } : {})
			};
			saving = false;
		}
	}

	async function remove() {
		if (!activityId) return;
		deleting = true;
		try {
			await api('DELETE', `/api/activities/${activityId}`);
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
			logTypeLabel(draft.activity_type),
			validSeconds ? formatActiveTime(validSeconds) : null,
			pace && draft.activity_type !== 'cycling' ? formatPace(pace) : null,
			speed && draft.activity_type === 'cycling' ? formatSpeed(speed) : null
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
		<div class="space-y-4">
			{#if draft.activity_type === 'other'}
				<TextField
					label={m.activity_title_label()}
					bind:value={draft.title}
					error={errors.title}
					maxlength={80}
					placeholder={m.activity_title_placeholder()}
					required
				/>
			{:else}
				<TextField
					label={m.activity_title_optional()}
					bind:value={draft.title}
					maxlength={80}
					placeholder={logTypeLabel(draft.activity_type)}
				/>
			{/if}

			<div class="grid grid-cols-2 gap-3">
				<TextField
					label={m.duration_label()}
					bind:value={draft.duration}
					error={errors.duration}
					hint={m.duration_hint()}
					inputmode="decimal"
					placeholder="45"
					suffix={m.min_short()}
					required
				/>
				{#if draft.activity_type !== 'other'}
					<TextField
						label={draft.activity_type === 'running' ? m.distance_label() : m.distance_optional()}
						bind:value={draft.distance}
						error={errors.distance}
						inputmode="decimal"
						placeholder="—"
						suffix={m.km()}
					/>
				{/if}
			</div>

			{#if draft.activity_type === 'running' || draft.activity_type === 'cycling'}
				<div class="grid grid-cols-2 gap-3 rounded-tile bg-mint p-3.5" aria-live="polite">
					<div>
						<p class="text-xs text-muted">{m.pace_label()}</p>
						<p class="heading text-lg font-bold tabular-nums">
							{pace === null ? '—' : formatPace(pace)}
						</p>
					</div>
					<div>
						<p class="text-xs text-muted">{m.speed_label()}</p>
						<p class="heading text-lg font-bold tabular-nums">
							{speed === null ? '—' : formatSpeed(speed)}
						</p>
					</div>
				</div>
			{/if}

			{#if draft.activity_type === 'walking'}
				<TextField
					label={m.steps_optional()}
					bind:value={draft.steps}
					error={errors.steps}
					inputmode="numeric"
					placeholder="—"
				/>
			{/if}

			<KcalField
				bind:value={draft.kcal}
				bind:edited={draft.kcalEdited}
				{estimate}
				hasWeight={weightKg !== null}
				error={errors.kcal}
			/>
		</div>
	</Card>

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

	{#if activityId}
		<Button variant="outline" full class="text-red-700" onclick={() => (confirmDelete = true)}>
			<Trash2 class="size-4" aria-hidden="true" />
			{m.delete_activity()}
		</Button>
	{/if}
</div>

<SaveBar
	label={footerLabel}
	value={footerValue}
	saveLabel={activityId ? m.save_changes() : m.save_activity()}
	{saving}
	onsave={save}
/>

<ConfirmDialog
	bind:open={confirmDelete}
	title={m.delete_activity_confirm_title()}
	body={m.delete_activity_confirm_body()}
	confirmLabel={m.delete()}
	busy={deleting}
	onconfirm={remove}
/>
