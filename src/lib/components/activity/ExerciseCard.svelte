<script lang="ts">
	import { Plus, Trash2, X } from '@lucide/svelte';
	import { newSet, type ExerciseDraft } from '#lib/activity-form.js';
	import type { FieldErrors } from '#lib/forms.js';
	import { exerciseMeta } from '#lib/labels.js';
	import { m } from '#lib/paraglide/messages.js';

	type Props = {
		exercise: ExerciseDraft;
		errors: FieldErrors;
		onremove: () => void;
	};

	let { exercise = $bindable(), errors, onremove }: Props = $props();

	const meta = $derived(exerciseMeta(exercise.muscle_group, exercise.equipment));

	function addSet() {
		exercise.sets = [...exercise.sets, newSet(exercise.sets.at(-1))];
	}

	function removeSet(key: string) {
		exercise.sets = exercise.sets.filter((s) => s.key !== key);
	}

	const cell =
		'h-11 w-full rounded-field border bg-white px-2 text-center text-base tabular-nums outline-none focus:border-green focus:ring-2 focus:ring-green/20';
</script>

<div class="rounded-card border border-line bg-white p-4 shadow-card" data-exercise={exercise.key}>
	<div class="flex items-start gap-3">
		<div class="min-w-0 flex-1">
			<h3 class="heading text-base font-bold break-words">{exercise.name}</h3>
			{#if meta}<p class="text-sm text-muted">{meta}</p>{/if}
		</div>
		<button
			type="button"
			class="-mt-1 -mr-1 grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-paper hover:text-red-700"
			aria-label={m.remove_exercise({ name: exercise.name })}
			onclick={onremove}
		>
			<Trash2 class="size-4" aria-hidden="true" />
		</button>
	</div>

	<table class="mt-3 w-full table-fixed border-separate border-spacing-x-2 border-spacing-y-1.5">
		<thead>
			<tr class="text-xs text-muted">
				<th scope="col" class="w-9 text-left font-semibold">{m.set_col()}</th>
				<th scope="col" class="font-semibold">{m.unit_kg()}</th>
				<th scope="col" class="font-semibold">{m.reps()}</th>
				<th scope="col" class="w-10"><span class="sr-only">{m.remove_set()}</span></th>
			</tr>
		</thead>
		<tbody>
			{#each exercise.sets as row, i (row.key)}
				<tr>
					<th scope="row" class="text-left text-sm font-bold tabular-nums">{i + 1}</th>
					<td>
						<input
							bind:value={row.kg}
							inputmode="decimal"
							placeholder="—"
							aria-label={m.set_kg_label({ n: i + 1 })}
							aria-invalid={errors[`${row.key}.kg`] ? true : undefined}
							class={[cell, errors[`${row.key}.kg`] ? 'border-red-400' : 'border-line']}
						/>
					</td>
					<td>
						<input
							bind:value={row.reps}
							inputmode="numeric"
							placeholder="—"
							aria-label={m.set_reps_label({ n: i + 1 })}
							aria-invalid={errors[`${row.key}.reps`] || (i === 0 && errors[exercise.key])
								? true
								: undefined}
							class={[
								cell,
								errors[`${row.key}.reps`] || (i === 0 && errors[exercise.key])
									? 'border-red-400'
									: 'border-line'
							]}
						/>
					</td>
					<td>
						<button
							type="button"
							class="grid size-10 place-items-center rounded-full text-muted hover:bg-paper hover:text-ink disabled:opacity-30"
							aria-label={m.remove_set_n({ n: i + 1 })}
							disabled={exercise.sets.length === 1}
							onclick={() => removeSet(row.key)}
						>
							<X class="size-4" aria-hidden="true" />
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	{#if errors[exercise.key]}
		<p class="mt-1 text-sm text-red-700">{errors[exercise.key]}</p>
	{:else if exercise.sets.some((r) => errors[`${r.key}.kg`] || errors[`${r.key}.reps`])}
		<p class="mt-1 text-sm text-red-700">{m.set_invalid()}</p>
	{/if}

	<button
		type="button"
		class="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-tile px-2 text-sm font-semibold text-green hover:bg-mint"
		onclick={addSet}
		disabled={exercise.sets.length >= 50}
	>
		<Plus class="size-4" aria-hidden="true" />
		{m.add_set()}
	</button>
</div>
