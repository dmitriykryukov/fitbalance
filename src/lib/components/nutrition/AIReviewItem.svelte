<script lang="ts">
	import { CircleAlert, Minus, Pencil, Plus, X } from '@lucide/svelte';
	import Button from '#lib/components/shared/Button.svelte';
	import Chip from '#lib/components/shared/Chip.svelte';
	import TextField from '#lib/components/shared/TextField.svelte';
	import {
		editDetails,
		hasEnergyWarning,
		needsGrams,
		setGrams,
		stepQuantity,
		useSavedValues,
		type ReviewItem
	} from '#lib/ai-review.js';
	import { formatNumber } from '#lib/format.js';
	import { numberToInput, parseDecimal, type FieldErrors } from '#lib/forms.js';
	import { draftItemTotals } from '#lib/meal-form.js';
	import { m } from '#lib/paraglide/messages.js';

	type Props = {
		item: ReviewItem;
		/** Set after a save attempt when grams are missing or out of range. */
		error?: string | null;
		onremove: () => void;
	};

	let { item = $bindable(), error = null, onremove }: Props = $props();

	const uid = $props.id();
	let gramsMode = $state(item.gramsPerUnit === null);
	let editing = $state(false);
	let edit = $state({ name: '', kcal: '', protein: '', carbs: '', fat: '', fibre: '' });
	let editErrors = $state<FieldErrors>({});

	const totals = $derived(draftItemTotals(item));
	const missing = $derived(needsGrams(item));
	const energyWarning = $derived(hasEnergyWarning(item));
	const isEstimate = $derived(
		item.estimate_source === 'ai_estimate' || item.estimate_source === 'ai_edited'
	);
	const notes = $derived([
		...(item.is_assumption ? [m.ai_assumed_hint()] : []),
		...item.uncertainties,
		...(energyWarning ? [m.ai_energy_warning()] : [])
	]);

	function openEdit() {
		edit = {
			name: item.name,
			kcal: numberToInput(item.per100.kcal),
			protein: numberToInput(item.per100.protein_g),
			carbs: numberToInput(item.per100.carbs_g),
			fat: numberToInput(item.per100.fat_g),
			fibre: numberToInput(item.per100.fibre_g)
		};
		editErrors = {};
		editing = true;
	}

	function saveEdit() {
		const errors: FieldErrors = {};
		const read = (key: keyof typeof edit, max: number, optional = false) => {
			const value = parseDecimal(edit[key]);
			if (value === null && optional) return null;
			if (typeof value !== 'number' || value < 0 || value > max) {
				errors[key] = m.field_range({ min: '0', max: String(max) });
				return 0;
			}
			return value;
		};
		const name = edit.name.trim();
		if (!name) errors.name = m.field_required();
		const per100 = {
			kcal: read('kcal', 900)!,
			protein_g: read('protein', 100)!,
			carbs_g: read('carbs', 100)!,
			fat_g: read('fat', 100)!,
			fibre_g: read('fibre', 100, true)
		};
		editErrors = errors;
		if (Object.keys(errors).length > 0) return;

		const unchanged =
			name === item.name &&
			(Object.keys(per100) as (keyof typeof per100)[]).every((k) => per100[k] === item.per100[k]);
		if (!unchanged) item = editDetails(item, name.slice(0, 120), per100);
		editing = false;
	}
</script>

<article
	class={[
		'rounded-card border bg-white p-4 shadow-card',
		missing ? 'border-amber-text/60 ring-2 ring-orange-bg' : 'border-line'
	]}
	aria-labelledby="{uid}-name"
>
	<div class="flex items-start gap-2">
		<div class="min-w-0 flex-1">
			<h3 id="{uid}-name" class="font-bold [overflow-wrap:anywhere]">{item.name}</h3>
			<div class="mt-1 flex flex-wrap items-center gap-1.5">
				{#if item.estimate_source === 'my_food'}
					<Chip>{m.ai_badge_my_food()}</Chip>
				{:else if isEstimate}
					<Chip tone="amber">{m.ai_badge_estimated()}</Chip>
				{:else}
					<Chip tone="neutral">{m.ai_badge_edited()}</Chip>
				{/if}
				{#if item.preparation}
					<span class="text-xs text-muted">{item.preparation}</span>
				{/if}
			</div>
		</div>
		<button
			type="button"
			class="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-paper hover:text-ink"
			aria-label={m.ai_edit_item({ name: item.name })}
			aria-expanded={editing}
			onclick={() => (editing ? (editing = false) : openEdit())}
		>
			<Pencil class="size-4" aria-hidden="true" />
		</button>
		<button
			type="button"
			class="-mr-1 grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-paper hover:text-red-700"
			aria-label={m.remove_item({ name: item.name })}
			onclick={onremove}
		>
			<X class="size-5" aria-hidden="true" />
		</button>
	</div>

	{#if notes.length > 0}
		<ul class="mt-3 space-y-1.5 rounded-tile bg-orange-bg px-3 py-2.5 text-[13px] text-amber-text">
			{#each notes as note, i (i)}
				<li class="flex gap-2">
					<CircleAlert class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
					<span>{note}</span>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="mt-3 flex flex-wrap items-end gap-3">
		{#if gramsMode || item.gramsPerUnit === null}
			<TextField
				class="w-32"
				label={m.amount_label()}
				value={item.grams}
				oninput={(e) => (item = setGrams(item, e.currentTarget.value))}
				error={error ?? (missing && item.grams === '' ? m.ai_grams_missing() : null)}
				inputmode="decimal"
				suffix={m.unit_g()}
			/>
		{:else}
			<div>
				<span class="mb-1.5 block text-sm font-semibold">{m.amount_label()}</span>
				<div class="flex h-12 items-center rounded-field border border-line bg-white">
					<button
						type="button"
						class="grid h-full w-11 place-items-center text-green disabled:text-muted/50"
						aria-label={m.ai_decrease()}
						disabled={(item.quantity ?? 0) <= item.step}
						onclick={() => (item = stepQuantity(item, -1))}
					>
						<Minus class="size-4" aria-hidden="true" />
					</button>
					<span class="min-w-20 text-center text-sm leading-tight tabular-nums" aria-live="polite">
						<span class="block font-bold">
							{m.quantity_unit({
								quantity: formatNumber(item.quantity ?? 0, 2),
								unit: item.unit ?? ''
							})}
						</span>
						<span class="block text-xs text-muted">{item.grams} {m.unit_g()}</span>
					</span>
					<button
						type="button"
						class="grid h-full w-11 place-items-center text-green"
						aria-label={m.ai_increase()}
						onclick={() => (item = stepQuantity(item, 1))}
					>
						<Plus class="size-4" aria-hidden="true" />
					</button>
				</div>
			</div>
		{/if}
		{#if item.gramsPerUnit !== null}
			<button
				type="button"
				class="mb-1.5 h-9 rounded-full border border-line px-3 text-sm font-semibold text-muted hover:text-ink"
				onclick={() => (gramsMode = !gramsMode)}
			>
				{gramsMode ? m.ai_switch_to_units({ unit: item.unit ?? '' }) : m.ai_switch_to_grams()}
			</button>
		{/if}
	</div>

	<p class="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-3 tabular-nums">
		<span class="text-xs text-muted">
			{m.macro_line({
				p: formatNumber(totals.protein_g, 1),
				c: formatNumber(totals.carbs_g, 1),
				f: formatNumber(totals.fat_g, 1)
			})}
		</span>
		<span class="font-bold whitespace-nowrap">
			{m.kcal_value({ value: formatNumber(totals.kcal) })}
		</span>
	</p>

	{#if item.match && item.estimate_source !== 'my_food'}
		<Button
			variant="soft"
			size="sm"
			class="mt-3"
			onclick={() => {
				item = useSavedValues(item);
				editing = false;
			}}
		>
			{m.ai_use_saved()}
		</Button>
	{/if}

	{#if editing}
		<div class="mt-4 space-y-3 border-t border-line pt-4">
			<TextField
				label={m.food_name()}
				bind:value={edit.name}
				error={editErrors.name}
				maxlength={120}
				autocomplete="off"
			/>
			<fieldset>
				<legend class="mb-2 text-sm font-bold">{m.food_per_100g_title()}</legend>
				<div class="grid grid-cols-2 gap-3">
					<TextField
						class="col-span-2"
						label={m.food_kcal()}
						bind:value={edit.kcal}
						error={editErrors.kcal}
						inputmode="decimal"
						suffix={m.kcal()}
					/>
					<TextField
						label={m.food_protein()}
						bind:value={edit.protein}
						error={editErrors.protein}
						inputmode="decimal"
						suffix={m.unit_g()}
					/>
					<TextField
						label={m.food_carbs()}
						bind:value={edit.carbs}
						error={editErrors.carbs}
						inputmode="decimal"
						suffix={m.unit_g()}
					/>
					<TextField
						label={m.food_fat()}
						bind:value={edit.fat}
						error={editErrors.fat}
						inputmode="decimal"
						suffix={m.unit_g()}
					/>
					<TextField
						label={m.food_fibre()}
						bind:value={edit.fibre}
						error={editErrors.fibre}
						inputmode="decimal"
						suffix={m.unit_g()}
					/>
				</div>
			</fieldset>
			<div class="flex gap-2">
				<Button variant="outline" onclick={() => (editing = false)}>{m.cancel()}</Button>
				<Button class="flex-1" onclick={saveEdit}>{m.ai_edit_done()}</Button>
			</div>
		</div>
	{/if}
</article>
