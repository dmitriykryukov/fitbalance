<script lang="ts">
	import { Plus, Trash2 } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { api } from '#lib/api/client.js';
	import Button from '#lib/components/shared/Button.svelte';
	import Card from '#lib/components/shared/Card.svelte';
	import ConfirmDialog from '#lib/components/shared/ConfirmDialog.svelte';
	import ErrorBanner from '#lib/components/shared/ErrorBanner.svelte';
	import SegmentedControl from '#lib/components/shared/SegmentedControl.svelte';
	import TextField from '#lib/components/shared/TextField.svelte';
	import { MIN_LOCAL_DATE } from '#lib/dates.js';
	import { formatNumber } from '#lib/format.js';
	import { apiErrorToForm, type FieldErrors } from '#lib/forms.js';
	import { mealTypeLabel } from '#lib/labels.js';
	import { draftToInput, draftTotals, type DraftItem, type MealDraft } from '#lib/meal-form.js';
	import { MEAL_TYPES } from '#lib/nutrition.js';
	import { m } from '#lib/paraglide/messages.js';
	import { countItems } from '#lib/plural.js';
	import type { Tables } from '#lib/types/database.js';
	import FoodSearch from './FoodSearch.svelte';
	import MealItemsEditor from './MealItemsEditor.svelte';

	type Props = {
		initial: MealDraft;
		/** Null creates a new meal; an id replaces that meal. */
		mealId: string | null;
		recentFoods: Tables<'food_items'>[];
		timeZone: string;
		today: string;
	};

	let { initial, mealId, recentFoods, timeZone, today }: Props = $props();

	// svelte-ignore state_referenced_locally
	let draft = $state<MealDraft>({ ...initial, items: [...initial.items] });
	let errors = $state<FieldErrors>({});
	let message = $state<string | null>(null);
	let saving = $state(false);
	// svelte-ignore state_referenced_locally
	let searchOpen = $state(initial.items.length === 0);
	let confirmDelete = $state(false);
	let deleting = $state(false);

	const total = $derived(draftTotals(draft.items));
	const typeOptions = MEAL_TYPES.map((type) => ({ value: type, label: mealTypeLabel(type) }));

	const diaryFor = (date: string) =>
		(date === today
			? resolve('/app/nutrition')
			: `${resolve('/app/nutrition')}?date=${date}`) as ResolvedPathname;

	function addItem(item: DraftItem) {
		draft.items = [...draft.items, item];
		delete errors.items;
		if (mealId) searchOpen = false;
	}

	async function save() {
		const result = draftToInput(draft, timeZone);
		errors = result.errors;
		message = null;
		if (!result.input) {
			message = errors.items ?? m.error_validation();
			return;
		}
		saving = true;
		try {
			if (mealId) await api('PUT', `/api/meals/${mealId}`, result.input);
			else await api('POST', '/api/meals', result.input);
			await goto(diaryFor(result.input.local_date), { refreshAll: true });
		} catch (error) {
			const mapped = apiErrorToForm(error);
			message = mapped.message;
			errors = mapped.fields.local_date ? { date: mapped.fields.local_date } : {};
			saving = false;
		}
	}

	async function remove() {
		if (!mealId) return;
		deleting = true;
		try {
			await api('DELETE', `/api/meals/${mealId}`);
			confirmDelete = false;
			await goto(diaryFor(initial.local_date), { refreshAll: true });
		} catch (error) {
			confirmDelete = false;
			message = apiErrorToForm(error).message;
		} finally {
			deleting = false;
		}
	}
</script>

<div class="space-y-4 px-4 pb-28">
	{#if message}<ErrorBanner {message} />{/if}

	<Card>
		<SegmentedControl
			label={m.meal_type_label()}
			options={typeOptions}
			bind:value={draft.meal_type}
		/>
		<div class="mt-4 grid grid-cols-2 gap-3">
			<TextField
				label={m.meal_date()}
				type="date"
				bind:value={draft.local_date}
				error={errors.date}
				min={MIN_LOCAL_DATE}
				max={today}
				required
			/>
			<TextField
				label={m.meal_time()}
				type="time"
				bind:value={draft.time}
				error={errors.time}
				required
			/>
		</div>
	</Card>

	<Card>
		<div class="mb-3 flex items-baseline justify-between gap-3">
			<h2 class="heading text-[17px] font-bold">{m.meal_foods()}</h2>
			{#if draft.items.length > 0}
				<span class="text-sm text-muted">{countItems(draft.items.length)}</span>
			{/if}
		</div>
		{#if draft.items.length === 0}
			<p class={['text-sm', errors.items ? 'text-red-700' : 'text-muted']}>
				{errors.items ?? m.meal_no_items_hint()}
			</p>
		{:else}
			<MealItemsEditor bind:items={draft.items} {errors} />
		{/if}
	</Card>

	{#if searchOpen}
		<Card>
			<FoodSearch recent={recentFoods} onadd={addItem} />
		</Card>
	{:else}
		<Button variant="soft" full onclick={() => (searchOpen = true)}>
			<Plus class="size-4" aria-hidden="true" />
			{m.add_food()}
		</Button>
	{/if}

	<Card>
		<label class="block">
			<span class="mb-1.5 block text-sm font-semibold">{m.meal_notes()}</span>
			<textarea
				bind:value={draft.notes}
				rows="2"
				maxlength="1000"
				class="w-full rounded-field border border-line bg-white px-3.5 py-3 text-base outline-none focus:border-green focus:ring-2 focus:ring-green/20"
			></textarea>
		</label>
	</Card>

	{#if mealId}
		<Button variant="outline" full class="text-red-700" onclick={() => (confirmDelete = true)}>
			<Trash2 class="size-4" aria-hidden="true" />
			{m.delete_meal()}
		</Button>
	{/if}
</div>

<div
	class="fixed inset-x-0 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[480px] px-4"
>
	<div
		class="flex items-center gap-3 rounded-card border border-line bg-white/95 p-2.5 pl-4 shadow-card backdrop-blur"
	>
		<div class="min-w-0 flex-1">
			<p class="text-xs text-muted">{m.meal_total()}</p>
			<p class="font-bold tabular-nums">{m.kcal_value({ value: formatNumber(total.kcal) })}</p>
		</div>
		<Button onclick={save} loading={saving} disabled={draft.items.length === 0}>
			{mealId ? m.save_changes() : m.save_meal()}
		</Button>
	</div>
</div>

<ConfirmDialog
	bind:open={confirmDelete}
	title={m.delete_meal_confirm_title()}
	body={m.delete_meal_confirm_body()}
	confirmLabel={m.delete()}
	busy={deleting}
	onconfirm={remove}
/>
