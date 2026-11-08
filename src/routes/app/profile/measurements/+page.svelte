<script lang="ts">
	import { Trash2 } from '@lucide/svelte';
	import { refreshAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { api } from '#lib/api/client.js';
	import PageHeader from '#lib/components/layout/PageHeader.svelte';
	import Button from '#lib/components/shared/Button.svelte';
	import Card from '#lib/components/shared/Card.svelte';
	import ConfirmDialog from '#lib/components/shared/ConfirmDialog.svelte';
	import EmptyState from '#lib/components/shared/EmptyState.svelte';
	import ErrorBanner from '#lib/components/shared/ErrorBanner.svelte';
	import TextField from '#lib/components/shared/TextField.svelte';
	import { addDays } from '#lib/dates.js';
	import { formatLongDate, formatNumber } from '#lib/format.js';
	import { apiErrorToForm, parseDecimal, type FieldErrors } from '#lib/forms.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	let form = $state({ local_date: data.today, weight_kg: '', waist_cm: '', notes: '' });
	let errors = $state<FieldErrors>({});
	let message = $state<string | null>(null);
	let saving = $state(false);

	let deleteId = $state<string | null>(null);
	let confirmOpen = $state(false);
	let deleting = $state(false);

	async function add() {
		errors = {};
		message = null;
		const weight = parseDecimal(form.weight_kg);
		const waist = parseDecimal(form.waist_cm);
		if (weight === undefined || (weight !== null && (weight < 20 || weight > 400))) {
			errors.weight_kg = m.field_range({ min: 20, max: 400 });
		}
		if (waist === undefined || (waist !== null && (waist < 30 || waist > 300))) {
			errors.waist_cm = m.field_range({ min: 30, max: 300 });
		}
		if (weight === null && waist === null) errors.weight_kg = m.measurement_need_value();
		if (!form.local_date) errors.local_date = m.field_required();
		if (Object.keys(errors).length > 0) return;

		saving = true;
		try {
			await api('POST', '/api/measurements', {
				local_date: form.local_date,
				weight_kg: weight,
				waist_cm: waist,
				notes: form.notes.trim() || null
			});
			form = { local_date: data.today, weight_kg: '', waist_cm: '', notes: '' };
			await refreshAll();
		} catch (error) {
			({ message, fields: errors } = apiErrorToForm(error));
		} finally {
			saving = false;
		}
	}

	function askDelete(id: string) {
		deleteId = id;
		confirmOpen = true;
	}

	async function confirmDelete() {
		if (!deleteId) return;
		deleting = true;
		try {
			await api('DELETE', `/api/measurements/${deleteId}`);
			confirmOpen = false;
			await refreshAll();
		} catch (error) {
			({ message } = apiErrorToForm(error));
			confirmOpen = false;
		} finally {
			deleting = false;
			deleteId = null;
		}
	}
</script>

<svelte:head><title>{m.measurements_title()} · {m.app_name()}</title></svelte:head>

<PageHeader title={m.measurements_title()} backHref={resolve('/app/profile')} />

<div class="space-y-4 px-4">
	<form
		novalidate
		onsubmit={(event) => {
			event.preventDefault();
			void add();
		}}
	>
		<Card>
			<h2 class="mb-4 eyebrow">{m.measurement_add()}</h2>
			<div class="space-y-4">
				{#if message}<ErrorBanner {message} />{/if}
				<TextField
					label={m.measurement_date()}
					type="date"
					bind:value={form.local_date}
					error={errors.local_date}
					min="2000-01-01"
					max={addDays(data.today, 1)}
				/>
				<div class="grid grid-cols-2 gap-3">
					<TextField
						label={m.tile_weight()}
						bind:value={form.weight_kg}
						error={errors.weight_kg}
						inputmode="decimal"
						suffix={m.unit_kg()}
					/>
					<TextField
						label={m.tile_waist()}
						bind:value={form.waist_cm}
						error={errors.waist_cm}
						inputmode="decimal"
						suffix={m.unit_cm()}
					/>
				</div>
				<TextField label={m.measurement_notes()} bind:value={form.notes} maxlength={500} />
				<Button type="submit" full loading={saving}>{m.save()}</Button>
			</div>
		</Card>
	</form>

	<section aria-labelledby="history-title">
		<h2 id="history-title" class="mb-2 px-1 eyebrow">{m.measurements_history()}</h2>
		{#if data.measurements.length === 0}
			<EmptyState title={m.measurements_empty_title()} body={m.measurements_empty_body()} />
		{:else}
			<Card padding="none">
				<ul class="divide-y divide-line">
					{#each data.measurements as row (row.id)}
						<li class="flex items-center gap-3 px-5 py-3">
							<div class="min-w-0 flex-1">
								<p class="text-sm font-semibold">{formatLongDate(row.local_date)}</p>
								<p class="text-sm text-muted tabular-nums">
									{[
										row.weight_kg !== null
											? `${formatNumber(row.weight_kg, 1)} ${m.unit_kg()}`
											: null,
										row.waist_cm !== null
											? `${m.tile_waist()} ${formatNumber(row.waist_cm, 1)} ${m.unit_cm()}`
											: null
									]
										.filter(Boolean)
										.join(' · ')}
								</p>
								{#if row.notes}<p class="truncate text-xs text-muted">{row.notes}</p>{/if}
							</div>
							<button
								type="button"
								class="grid size-11 place-items-center rounded-full text-muted hover:bg-paper hover:text-red-700"
								aria-label={m.delete()}
								onclick={() => askDelete(row.id)}
							>
								<Trash2 class="size-4" aria-hidden="true" />
							</button>
						</li>
					{/each}
				</ul>
			</Card>
		{/if}
	</section>
</div>

<ConfirmDialog
	bind:open={confirmOpen}
	title={m.measurement_delete_title()}
	body={m.measurement_delete_body()}
	confirmLabel={m.delete()}
	busy={deleting}
	onconfirm={confirmDelete}
/>
