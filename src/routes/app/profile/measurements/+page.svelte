<script lang="ts">
	import { SquarePen, Trash2 } from '@lucide/svelte';
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
	import { apiErrorToForm, numberToInput, parseDecimal, type FieldErrors } from '#lib/forms.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Row = (typeof data.measurements)[number];
	const emptyForm = () => ({ local_date: data.today, weight_kg: '', waist_cm: '', notes: '' });

	let form = $state(emptyForm());
	/** Id of the measurement being edited; null while adding a new one. */
	let editingId = $state<string | null>(null);
	let formCard: HTMLElement | undefined = $state();
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
			const body = {
				local_date: form.local_date,
				weight_kg: weight,
				waist_cm: waist,
				notes: form.notes.trim() || null
			};
			if (editingId) await api('PATCH', `/api/measurements/${editingId}`, body);
			else await api('POST', '/api/measurements', body);
			form = emptyForm();
			editingId = null;
			await refreshAll();
		} catch (error) {
			({ message, fields: errors } = apiErrorToForm(error));
		} finally {
			saving = false;
		}
	}

	function startEdit(row: Row) {
		editingId = row.id;
		form = {
			local_date: row.local_date,
			weight_kg: numberToInput(row.weight_kg),
			waist_cm: numberToInput(row.waist_cm),
			notes: row.notes ?? ''
		};
		errors = {};
		message = null;
		formCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function cancelEdit() {
		editingId = null;
		form = emptyForm();
		errors = {};
		message = null;
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
			if (deleteId === editingId) cancelEdit();
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
		bind:this={formCard}
		class="scroll-mt-4"
		novalidate
		onsubmit={(event) => {
			event.preventDefault();
			void add();
		}}
	>
		<Card>
			<div class="mb-4 flex items-center justify-between gap-3">
				<h2 class="eyebrow">{editingId ? m.measurement_edit() : m.measurement_add()}</h2>
				{#if editingId}
					<button
						type="button"
						class="text-sm font-semibold text-muted hover:text-ink"
						onclick={cancelEdit}
					>
						{m.cancel()}
					</button>
				{/if}
			</div>
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
				<Button type="submit" full loading={saving}>
					{editingId ? m.save_changes() : m.save()}
				</Button>
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
						<li
							class={['flex items-center gap-1 py-3 pr-2 pl-5', row.id === editingId && 'bg-mint']}
						>
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
								class="grid size-11 place-items-center rounded-full text-muted hover:bg-paper hover:text-ink"
								aria-label={m.measurement_edit_row({ date: formatLongDate(row.local_date) })}
								onclick={() => startEdit(row)}
							>
								<SquarePen class="size-4" aria-hidden="true" />
							</button>
							<button
								type="button"
								class="grid size-11 place-items-center rounded-full text-muted hover:bg-paper hover:text-red-700"
								aria-label={m.measurement_delete_row({ date: formatLongDate(row.local_date) })}
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
