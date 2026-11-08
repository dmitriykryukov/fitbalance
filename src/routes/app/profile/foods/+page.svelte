<script lang="ts">
	import { Apple, Plus, Trash2 } from '@lucide/svelte';
	import { refreshAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { api } from '#lib/api/client.js';
	import PageHeader from '#lib/components/layout/PageHeader.svelte';
	import FoodForm from '#lib/components/nutrition/FoodForm.svelte';
	import Button from '#lib/components/shared/Button.svelte';
	import Card from '#lib/components/shared/Card.svelte';
	import ConfirmDialog from '#lib/components/shared/ConfirmDialog.svelte';
	import EmptyState from '#lib/components/shared/EmptyState.svelte';
	import ErrorBanner from '#lib/components/shared/ErrorBanner.svelte';
	import { emptyFoodDraft, foodToDraft } from '#lib/food-form.js';
	import { formatNumber } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { FoodInput } from '#lib/schemas/nutrition.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** Food being edited, or "new". */
	let editing = $state<string | null>(null);
	let toDelete = $state<{ id: string; name: string } | null>(null);
	let confirmOpen = $state(false);
	let deleting = $state(false);
	let failed = $state(false);

	async function create(input: FoodInput) {
		await api('POST', '/api/foods', input);
		editing = null;
		await refreshAll();
	}

	async function update(id: string, input: FoodInput) {
		await api('PATCH', `/api/foods/${id}`, input);
		editing = null;
		await refreshAll();
	}

	async function remove() {
		if (!toDelete) return;
		deleting = true;
		failed = false;
		try {
			await api('DELETE', `/api/foods/${toDelete.id}`);
			editing = null;
			await refreshAll();
		} catch {
			failed = true;
		} finally {
			deleting = false;
			confirmOpen = false;
		}
	}
</script>

<svelte:head><title>{m.my_foods_title()} · {m.app_name()}</title></svelte:head>

<PageHeader
	title={m.my_foods_title()}
	subtitle={m.my_foods_subtitle()}
	backHref={resolve('/app/profile')}
/>

<div class="space-y-4 px-4 pb-6">
	{#if failed}<ErrorBanner message={m.error_generic()} />{/if}

	{#if editing === 'new'}
		<Card>
			<h2 class="mb-3 heading text-[17px] font-bold">{m.create_food()}</h2>
			<FoodForm initial={emptyFoodDraft()} onsubmit={create} oncancel={() => (editing = null)} />
		</Card>
	{:else}
		<Button variant="soft" full onclick={() => (editing = 'new')}>
			<Plus class="size-4" aria-hidden="true" />
			{m.create_food()}
		</Button>
	{/if}

	{#if data.foods.length === 0}
		<Card>
			<EmptyState icon={Apple} title={m.no_foods_yet()} body={m.no_foods_yet_body()} />
		</Card>
	{:else}
		<Card padding="none">
			<ul class="divide-y divide-line">
				{#each data.foods as food (food.id)}
					<li>
						{#if editing === food.id}
							<div class="p-4">
								<h2 class="mb-3 heading text-[17px] font-bold">{m.edit_food()}</h2>
								<FoodForm
									initial={foodToDraft(food)}
									onsubmit={(input) => update(food.id, input)}
									oncancel={() => (editing = null)}
								/>
								<Button
									variant="ghost"
									full
									class="mt-2 text-red-700"
									onclick={() => {
										toDelete = { id: food.id, name: food.name };
										confirmOpen = true;
									}}
								>
									<Trash2 class="size-4" aria-hidden="true" />
									{m.delete_food()}
								</Button>
							</div>
						{:else}
							<button
								type="button"
								class="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-paper/60"
								onclick={() => (editing = food.id)}
								aria-label="{m.edit_food()}: {food.name}"
							>
								<span class="min-w-0 flex-1">
									<span class="block font-semibold [overflow-wrap:anywhere]">
										{food.name}
										{#if food.brand}<span class="font-normal text-muted"> · {food.brand}</span>{/if}
									</span>
									<span class="block text-xs text-muted tabular-nums">
										{m.kcal_per_100g_short({ kcal: formatNumber(food.kcal_per_100g) })} ·
										{m.macro_line({
											p: formatNumber(food.protein_per_100g, 1),
											c: formatNumber(food.carbs_per_100g, 1),
											f: formatNumber(food.fat_per_100g, 1)
										})}
									</span>
								</span>
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		</Card>
	{/if}
</div>

<ConfirmDialog
	bind:open={confirmOpen}
	title={m.delete_food_confirm_title({ name: toDelete?.name ?? '' })}
	body={m.delete_food_confirm_body()}
	confirmLabel={m.delete()}
	busy={deleting}
	onconfirm={remove}
/>
