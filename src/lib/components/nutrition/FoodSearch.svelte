<script lang="ts">
	import { Plus, Search } from '@lucide/svelte';
	import { api } from '#lib/api/client.js';
	import Button from '#lib/components/shared/Button.svelte';
	import ErrorBanner from '#lib/components/shared/ErrorBanner.svelte';
	import TextField from '#lib/components/shared/TextField.svelte';
	import { emptyFoodDraft } from '#lib/food-form.js';
	import { formatNumber } from '#lib/format.js';
	import { numberToInput, parseDecimal } from '#lib/forms.js';
	import { itemFromFood, per100FromFood, type DraftItem } from '#lib/meal-form.js';
	import { itemTotals } from '#lib/nutrition.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { FoodInput } from '#lib/schemas/nutrition.js';
	import type { Tables } from '#lib/types/database.js';
	import FoodForm from './FoodForm.svelte';

	type Food = Tables<'food_items'>;

	type Props = {
		/** Recent/frequent foods shown before typing (from the page load). */
		recent: Food[];
		onadd: (item: DraftItem) => void;
	};

	let { recent, onadd }: Props = $props();

	const uid = $props.id();

	let query = $state('');
	// svelte-ignore state_referenced_locally
	let results = $state<Food[]>(recent);
	// svelte-ignore state_referenced_locally
	let known = $state<Food[]>(recent);
	let searching = $state(false);
	let failed = $state(false);
	let selectedId = $state<string | null>(null);
	let grams = $state('');
	let gramsError = $state<string | null>(null);
	let creating = $state(false);

	const trimmed = $derived(query.trim());
	const selected = $derived(results.find((f) => f.id === selectedId) ?? null);
	/** A saved food already has exactly this name: offer a plain "Create food" instead. */
	const exists = $derived(
		results.some((f) => f.name.trim().toLowerCase() === trimmed.toLowerCase())
	);
	const preview = $derived.by(() => {
		if (!selected) return null;
		const g = parseDecimal(grams);
		return typeof g === 'number' && g > 0 ? itemTotals(per100FromFood(selected), g) : null;
	});

	let sequence = 0;
	$effect(() => {
		const text = trimmed;
		const run = ++sequence;
		failed = false;
		if (!text) {
			results = known;
			searching = false;
			return;
		}
		searching = true;
		const timer = setTimeout(async () => {
			try {
				const data = await api<{ foods: Food[] }>(
					'GET',
					`/api/foods?query=${encodeURIComponent(text)}&limit=20`
				);
				if (run === sequence) results = data.foods;
			} catch {
				if (run === sequence) failed = true;
			} finally {
				if (run === sequence) searching = false;
			}
		}, 250);
		return () => clearTimeout(timer);
	});

	function select(food: Food) {
		if (selectedId === food.id) {
			selectedId = null;
			return;
		}
		selectedId = food.id;
		grams = numberToInput(food.serving_grams ?? 100);
		gramsError = null;
	}

	function add() {
		if (!selected) return;
		const g = parseDecimal(grams);
		if (typeof g !== 'number' || g <= 0 || g > 5000) {
			gramsError = m.field_range({ min: '1', max: '5000' });
			return;
		}
		onadd(itemFromFood(selected, g));
		selectedId = null;
	}

	async function create(input: FoodInput) {
		const { food } = await api<{ food: Food }>('POST', '/api/foods', input);
		known = [food, ...known];
		results = [food, ...results.filter((f) => f.id !== food.id)];
		creating = false;
		select(food);
	}
</script>

<div class="space-y-4">
	<TextField
		label={m.food_search_label()}
		type="search"
		bind:value={query}
		placeholder={m.food_search_placeholder()}
		autocomplete="off"
		enterkeyhint="search"
		suffix={searchIcon}
	/>

	{#if creating}
		<div class="rounded-tile border border-line bg-paper/60 p-4">
			<h3 class="mb-3 heading text-base font-bold">{m.create_food()}</h3>
			<FoodForm
				initial={emptyFoodDraft(exists ? '' : trimmed)}
				onsubmit={create}
				oncancel={() => (creating = false)}
			/>
		</div>
	{:else}
		{#if failed}
			<ErrorBanner message={m.error_generic()} />
		{/if}

		<div>
			<p class="mb-2 eyebrow" id="{uid}-list">
				{trimmed ? m.search_results() : m.recent_foods()}
			</p>
			{#if results.length === 0 && !searching}
				<p class="rounded-tile bg-paper px-4 py-5 text-center text-sm text-muted">
					{#if trimmed}
						{m.no_results({ query: trimmed })}
					{:else}
						<span class="block font-semibold text-ink">{m.no_foods_yet()}</span>
						{m.no_foods_yet_body()}
					{/if}
				</p>
			{:else}
				<ul
					class={[
						'divide-y divide-line rounded-tile border border-line',
						searching && 'opacity-60'
					]}
					aria-labelledby="{uid}-list"
					aria-busy={searching}
				>
					{#each results as food (food.id)}
						{@const open = food.id === selectedId}
						<li>
							<button
								type="button"
								class="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-paper/60"
								aria-expanded={open}
								onclick={() => select(food)}
							>
								<span class="min-w-0 flex-1">
									<span class="block font-semibold [overflow-wrap:anywhere]">
										{food.name}
										{#if food.brand}<span class="font-normal text-muted"> · {food.brand}</span>{/if}
									</span>
									<span class="block text-xs text-muted">
										{m.kcal_per_100g_short({ kcal: formatNumber(food.kcal_per_100g) })}
										{#if food.serving_description && food.serving_grams}
											· {m.serving_chip({
												serving: food.serving_description,
												grams: formatNumber(food.serving_grams, 1)
											})}
										{/if}
									</span>
								</span>
								<Plus
									class={['size-5 shrink-0 text-green transition-transform', open && 'rotate-45']}
									aria-hidden="true"
								/>
							</button>

							{#if open}
								<div class="space-y-3 border-t border-line bg-paper/50 px-3.5 py-3.5">
									<div class="flex flex-wrap gap-2">
										{#if food.serving_description && food.serving_grams}
											<button
												type="button"
												class="h-9 rounded-full border border-line bg-white px-3 text-sm font-semibold"
												onclick={() => (grams = numberToInput(food.serving_grams))}
											>
												{m.serving_chip({
													serving: food.serving_description,
													grams: formatNumber(food.serving_grams, 1)
												})}
											</button>
										{/if}
										<button
											type="button"
											class="h-9 rounded-full border border-line bg-white px-3 text-sm font-semibold"
											onclick={() => (grams = '100')}
										>
											100 {m.unit_g()}
										</button>
									</div>
									<div class="flex items-end gap-3">
										<TextField
											class="w-32"
											label={m.amount_label()}
											bind:value={grams}
											error={gramsError}
											inputmode="decimal"
											suffix={m.unit_g()}
											onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
										/>
										<p class="min-w-0 flex-1 pb-3 text-sm text-muted tabular-nums">
											{#if preview}
												<span class="font-bold text-ink"
													>{m.kcal_value({ value: formatNumber(preview.kcal) })}</span
												>
												<span class="block text-xs">
													{m.macro_line({
														p: formatNumber(preview.protein_g, 1),
														c: formatNumber(preview.carbs_g, 1),
														f: formatNumber(preview.fat_g, 1)
													})}
												</span>
											{/if}
										</p>
									</div>
									<Button full onclick={add}>
										<Plus class="size-4" aria-hidden="true" />
										{m.add_to_meal()}
									</Button>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<Button variant="soft" full onclick={() => (creating = true)}>
			<Plus class="size-4" aria-hidden="true" />
			{trimmed && !exists ? m.create_food_named({ name: trimmed }) : m.create_food()}
		</Button>
	{/if}
</div>

{#snippet searchIcon()}
	<Search class="size-4" aria-hidden="true" />
{/snippet}
