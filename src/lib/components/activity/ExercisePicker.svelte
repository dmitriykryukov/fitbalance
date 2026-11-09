<script lang="ts">
	import { Plus, Search } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { api } from '#lib/api/client.js';
	import type { ExerciseSuggestion } from '#lib/exercises.js';
	import { exerciseMeta } from '#lib/labels.js';
	import { m } from '#lib/paraglide/messages.js';

	type Props = {
		onadd: (exercise: ExerciseSuggestion) => void;
		oncancel?: () => void;
	};

	let { onadd, oncancel }: Props = $props();

	let query = $state('');
	let results = $state<ExerciseSuggestion[]>([]);
	let loading = $state(false);
	let failed = $state(false);
	let input: HTMLInputElement | undefined = $state();
	let timer: ReturnType<typeof setTimeout> | undefined;
	let request = 0;

	async function load(text: string) {
		const id = ++request;
		loading = true;
		try {
			const params = text.trim() ? `?query=${encodeURIComponent(text.trim())}` : '';
			const data = await api<{ exercises: ExerciseSuggestion[] }>('GET', `/api/exercises${params}`);
			if (id === request) {
				results = data.exercises;
				failed = false;
			}
		} catch {
			if (id === request) failed = true;
		} finally {
			if (id === request) loading = false;
		}
	}

	function search() {
		clearTimeout(timer);
		timer = setTimeout(() => load(query), 200);
	}

	onMount(() => {
		void load('');
		input?.focus();
		return () => clearTimeout(timer);
	});

	const custom = $derived(query.trim().slice(0, 80));
	const match = $derived(
		results.find((r) => r.name.toLocaleLowerCase() === custom.toLocaleLowerCase())
	);
	const exact = $derived(match !== undefined);

	function addCustom() {
		if (custom) onadd({ id: null, name: custom, muscle_group: null, equipment: null });
	}
</script>

<div>
	<div class="mb-3 flex items-center justify-between gap-3">
		<h2 class="heading text-[17px] font-bold">{m.add_exercise()}</h2>
		{#if oncancel}
			<button
				type="button"
				class="text-sm font-semibold text-muted hover:text-ink"
				onclick={oncancel}
			>
				{m.cancel()}
			</button>
		{/if}
	</div>
	<label class="relative block">
		<span class="sr-only">{m.exercise_search()}</span>
		<Search
			class="pointer-events-none absolute top-3.5 left-3.5 size-5 text-muted"
			aria-hidden="true"
		/>
		<input
			bind:this={input}
			bind:value={query}
			oninput={search}
			onkeydown={(event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					if (match) onadd(match);
					else addCustom();
				}
			}}
			type="search"
			maxlength="80"
			placeholder={m.exercise_search()}
			class="h-12 w-full rounded-field border border-line bg-white pr-3.5 pl-11 text-base outline-none focus:border-green focus:ring-2 focus:ring-green/20"
		/>
	</label>

	<ul class="mt-3 max-h-80 divide-y divide-line overflow-y-auto" aria-busy={loading}>
		{#if custom && !exact}
			<li>
				<button
					type="button"
					class="flex min-h-12 w-full items-center gap-3 py-2 text-left"
					onclick={addCustom}
				>
					<span class="grid size-9 shrink-0 place-items-center rounded-xl bg-mint text-green">
						<Plus class="size-4" aria-hidden="true" />
					</span>
					<span class="min-w-0 flex-1 truncate font-semibold"
						>{m.exercise_add_custom({ name: custom })}</span
					>
				</button>
			</li>
		{/if}
		{#each results as exercise (exercise.id ?? `built-in:${exercise.name}`)}
			<li>
				<button
					type="button"
					class="flex min-h-12 w-full items-center gap-3 py-2 text-left"
					onclick={() => onadd(exercise)}
				>
					<span class="min-w-0 flex-1">
						<span class="block truncate font-semibold">{exercise.name}</span>
						{#if exerciseMeta(exercise.muscle_group, exercise.equipment)}
							<span class="block truncate text-sm text-muted">
								{exerciseMeta(exercise.muscle_group, exercise.equipment)}
							</span>
						{/if}
					</span>
					<Plus class="size-4 shrink-0 text-green" aria-hidden="true" />
				</button>
			</li>
		{/each}
	</ul>
	{#if failed}
		<p class="mt-2 text-sm text-red-700">{m.error_generic()}</p>
	{:else if !loading && results.length === 0 && !custom}
		<p class="mt-2 text-sm text-muted">{m.exercise_none()}</p>
	{/if}
</div>
