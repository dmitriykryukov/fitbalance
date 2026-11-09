<script lang="ts">
	import { Info, Plus, Sparkles } from '@lucide/svelte';
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { api } from '#lib/api/client.js';
	import { reviewItemFromDraft, reviewItemFromParse, type ReviewItem } from '#lib/ai-review.js';
	import PageHeader from '#lib/components/layout/PageHeader.svelte';
	import AIReviewItem from '#lib/components/nutrition/AIReviewItem.svelte';
	import FoodSearch from '#lib/components/nutrition/FoodSearch.svelte';
	import Button from '#lib/components/shared/Button.svelte';
	import Card from '#lib/components/shared/Card.svelte';
	import EmptyState from '#lib/components/shared/EmptyState.svelte';
	import ErrorBanner from '#lib/components/shared/ErrorBanner.svelte';
	import SegmentedControl from '#lib/components/shared/SegmentedControl.svelte';
	import TextField from '#lib/components/shared/TextField.svelte';
	import { addDays } from '#lib/dates.js';
	import { formatNumber, formatShortDate } from '#lib/format.js';
	import { apiErrorToForm, type FieldErrors } from '#lib/forms.js';
	import { mealTypeLabel } from '#lib/labels.js';
	import { draftToInput, draftTotals } from '#lib/meal-form.js';
	import { MEAL_TYPES, type MealType } from '#lib/nutrition.js';
	import { m } from '#lib/paraglide/messages.js';
	import { countFoodsIdentified, countItems } from '#lib/plural.js';
	import type { FoodParseRequest, FoodParseResult } from '#lib/schemas/food-parse.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Clarification = { question: string; answer: string };

	let step = $state<'describe' | 'review'>('describe');
	// svelte-ignore state_referenced_locally
	let mealType = $state<MealType>(data.draft.meal_type);
	let description = $state('');
	let analyzing = $state(false);
	let analyzeError = $state<string | null>(null);

	/** What the current items were analyzed from (saved as the meal's ai_description). */
	let analyzed = $state<{ description: string; clarifications: Clarification[] }>({
		description: '',
		clarifications: []
	});
	let items = $state<ReviewItem[]>([]);
	let questions = $state<string[]>([]);
	let answers = $state<string[]>([]);
	let notes = $state<string[]>([]);

	let adding = $state(false);
	let ingredient = $state('');
	let ingredientBusy = $state(false);
	let ingredientError = $state<string | null>(null);

	let saving = $state(false);
	let saveMessage = $state<string | null>(null);
	let errors = $state<FieldErrors>({});

	const date = $derived(data.draft.local_date);
	const total = $derived(draftTotals(items));
	const typeOptions = MEAL_TYPES.map((type) => ({ value: type, label: mealTypeLabel(type) }));
	const dayLabel = $derived(
		date === data.today
			? m.date_today()
			: date === addDays(data.today, -1)
				? m.date_yesterday()
				: formatShortDate(date)
	);

	const diary = $derived(
		(date === data.today
			? resolve('/app/nutrition')
			: `${resolve('/app/nutrition')}?date=${date}`) as ResolvedPathname
	);
	const manualHref = $derived(
		`${resolve('/app/nutrition/search')}?type=${mealType}${date === data.today ? '' : `&date=${date}`}` as ResolvedPathname
	);

	function parse(body: FoodParseRequest) {
		return api<FoodParseResult>('POST', '/api/ai/food-parse', body);
	}

	async function analyze(clarifications: Clarification[] = []) {
		const text = description.trim();
		if (!text || analyzing) return;
		analyzing = true;
		analyzeError = null;
		try {
			const result = await parse({
				description: text,
				meal_type: mealType,
				clarifications: clarifications.length ? clarifications : undefined
			});
			analyzed = { description: text, clarifications };
			items = result.items.map(reviewItemFromParse);
			questions = result.clarifying_questions;
			answers = questions.map(() => '');
			notes = result.notes;
			errors = {};
			saveMessage = null;
			adding = false;
			step = 'review';
			await tick();
			window.scrollTo({ top: 0 });
		} catch (error) {
			// The description stays in the field so the user can retry or edit it.
			analyzeError = apiErrorToForm(error).message;
			if (step === 'review') await tick().then(() => window.scrollTo({ top: 0 }));
		} finally {
			analyzing = false;
		}
	}

	function reanalyze() {
		const answered = questions
			.map((question, i) => ({ question, answer: answers[i].trim() }))
			.filter((c) => c.answer);
		if (answered.length === 0) return;
		void analyze([...analyzed.clarifications, ...answered].slice(-3));
	}

	async function addDescribed() {
		const text = ingredient.trim();
		if (!text || ingredientBusy) return;
		ingredientBusy = true;
		ingredientError = null;
		try {
			const result = await parse({ description: text, meal_type: mealType });
			if (result.items.length === 0) {
				ingredientError = result.notes[0] ?? m.ai_no_items_body();
				return;
			}
			items = [...items, ...result.items.map(reviewItemFromParse)];
			ingredient = '';
			adding = false;
		} catch (error) {
			ingredientError = apiErrorToForm(error).message;
		} finally {
			ingredientBusy = false;
		}
	}

	function aiDescription(): string {
		const lines = [analyzed.description];
		for (const { question, answer } of analyzed.clarifications) lines.push(`${question} ${answer}`);
		return lines.join('\n').slice(0, 2000);
	}

	async function save() {
		const result = draftToInput(
			{ ...data.draft, meal_type: mealType, ai_description: aiDescription(), items },
			data.profile.timezone
		);
		errors = result.errors;
		saveMessage = null;
		if (!result.input) {
			saveMessage = errors.items ?? m.ai_fix_grams();
			await tick();
			const field = document.querySelector<HTMLInputElement>('main input[aria-invalid="true"]');
			field?.scrollIntoView({ block: 'center', behavior: 'smooth' });
			field?.focus({ preventScroll: true });
			return;
		}
		saving = true;
		try {
			await api('POST', '/api/meals', result.input);
			await goto(diary, { refreshAll: true });
		} catch (error) {
			saveMessage = apiErrorToForm(error).message;
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>{step === 'describe' ? m.ai_log_title() : m.ai_review_title()} · {m.app_name()}</title>
</svelte:head>

<PageHeader
	title={step === 'describe' ? m.ai_log_title() : m.ai_review_title()}
	subtitle="{mealTypeLabel(mealType)} · {dayLabel}"
	backHref={diary}
/>

{#if step === 'describe'}
	<div class="space-y-4 px-4 pb-8">
		<Card>
			<SegmentedControl label={m.meal_type_label()} options={typeOptions} bind:value={mealType} />
			<label class="mt-5 block">
				<span class="mb-1.5 block text-sm font-semibold">{m.ai_describe_label()}</span>
				<textarea
					bind:value={description}
					rows="5"
					maxlength="1000"
					placeholder={m.ai_describe_placeholder()}
					class="w-full resize-y rounded-field border border-line bg-white px-3.5 py-3 text-base outline-none placeholder:text-muted/70 focus:border-green focus:ring-2 focus:ring-green/20"
				></textarea>
			</label>
			<p class="mt-2 text-sm text-muted">
				<span class="font-semibold text-ink">{m.ai_try_saying()}:</span>
				{m.ai_try_saying_example()}
			</p>
		</Card>

		{#if analyzeError}
			<div class="space-y-2">
				<ErrorBanner message={analyzeError} />
				<div class="flex gap-2">
					<Button variant="outline" class="flex-1" onclick={() => analyze()}>
						{m.ai_try_again()}
					</Button>
					<Button variant="outline" class="flex-1" href={manualHref}>{m.ai_enter_manually()}</Button
					>
				</div>
			</div>
		{/if}

		<Button
			full
			size="lg"
			loading={analyzing}
			disabled={!description.trim()}
			onclick={() => analyze()}
		>
			<Sparkles class="size-5" aria-hidden="true" />
			{m.ai_analyze()}
		</Button>

		<div class="text-center">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built from resolve() -->
			<a
				href={manualHref}
				class="text-sm font-semibold text-green underline-offset-2 hover:underline"
			>
				{m.ai_search_instead()}
			</a>
		</div>
		<p class="px-2 text-center text-xs text-muted">{m.ai_privacy_note()}</p>
	</div>
{:else}
	<div class="space-y-4 px-4 pb-32">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<p
				class="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 text-sm font-semibold text-green"
			>
				<Sparkles class="size-4" aria-hidden="true" />
				{countFoodsIdentified(items.length)} · {m.ai_nothing_saved()}
			</p>
			<button
				type="button"
				class="text-sm font-semibold text-green underline-offset-2 hover:underline"
				onclick={() => {
					step = 'describe';
					analyzeError = null;
				}}
			>
				{m.ai_edit_description()}
			</button>
		</div>

		{#if analyzeError}
			<ErrorBanner message={analyzeError} />
		{/if}

		{#if notes.length > 0}
			<Card padding="sm">
				<ul class="space-y-1.5 text-sm">
					{#each notes as note, i (i)}
						<li class="flex gap-2">
							<Info class="mt-0.5 size-4 shrink-0 text-blue" aria-hidden="true" />
							<span>{note}</span>
						</li>
					{/each}
				</ul>
			</Card>
		{/if}

		{#if questions.length > 0}
			<Card padding="sm">
				<h2 class="heading text-base font-bold">{m.ai_questions_title()}</h2>
				<div class="mt-3 space-y-3">
					{#each questions as question, i (i)}
						<TextField
							label={question}
							bind:value={answers[i]}
							maxlength={300}
							autocomplete="off"
						/>
					{/each}
				</div>
				<Button
					variant="soft"
					full
					class="mt-4"
					loading={analyzing}
					disabled={answers.every((a) => !a.trim())}
					onclick={reanalyze}
				>
					<Sparkles class="size-4" aria-hidden="true" />
					{m.ai_reanalyze()}
				</Button>
				<p class="mt-2 text-center text-xs text-muted">{m.ai_reanalyze_hint()}</p>
			</Card>
		{/if}

		{#if items.length === 0}
			<Card>
				<EmptyState icon={Sparkles} title={m.ai_no_items_title()} body={m.ai_no_items_body()} />
			</Card>
		{:else}
			<ul class="space-y-3">
				{#each items as item, i (item.key)}
					<li>
						<AIReviewItem
							bind:item={items[i]}
							error={errors[`items.${item.key}`]}
							onremove={() => (items = items.filter((it) => it.key !== item.key))}
						/>
					</li>
				{/each}
			</ul>
		{/if}

		{#if adding}
			<Card>
				<h2 class="heading text-base font-bold">{m.ai_add_ingredient()}</h2>
				<div class="mt-3 flex items-end gap-2">
					<TextField
						class="flex-1"
						label={m.ai_describe_ingredient()}
						bind:value={ingredient}
						placeholder={m.ai_describe_ingredient_placeholder()}
						maxlength={1000}
						autocomplete="off"
						error={ingredientError}
						onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addDescribed())}
					/>
				</div>
				<Button
					variant="soft"
					full
					class="mt-3"
					loading={ingredientBusy}
					disabled={!ingredient.trim()}
					onclick={addDescribed}
				>
					<Sparkles class="size-4" aria-hidden="true" />
					{m.ai_add_described()}
				</Button>
				<p class="mt-5 mb-3 eyebrow">{m.ai_or_search()}</p>
				<FoodSearch
					recent={data.recentFoods}
					onadd={(draft) => {
						items = [...items, reviewItemFromDraft(draft)];
						adding = false;
					}}
				/>
			</Card>
		{:else}
			<Button variant="soft" full onclick={() => (adding = true)}>
				<Plus class="size-4" aria-hidden="true" />
				{m.ai_add_ingredient()}
			</Button>
		{/if}

		{#if saveMessage}<ErrorBanner message={saveMessage} />{/if}
	</div>

	<div
		class="fixed inset-x-0 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[480px] px-4"
	>
		<div
			class="flex items-center gap-3 rounded-card border border-line bg-white/95 p-2.5 pl-4 shadow-card backdrop-blur"
		>
			<div class="min-w-0 flex-1">
				<p class="font-bold tabular-nums">{m.kcal_value({ value: formatNumber(total.kcal) })}</p>
				<p class="line-clamp-2 text-xs text-muted">
					{m.ai_saves_items({
						items: countItems(items.length),
						meal: mealTypeLabel(mealType).toLocaleLowerCase()
					})}
				</p>
			</div>
			<Button onclick={save} loading={saving} disabled={items.length === 0}>
				{m.ai_confirm_save()}
			</Button>
		</div>
	</div>
{/if}
