<script lang="ts">
	import { ChevronRight, Languages, Plus, SquarePen, Target } from '@lucide/svelte';
	import { refreshAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { api } from '#lib/api/client.js';
	import PageHeader from '#lib/components/layout/PageHeader.svelte';
	import GoalSelector from '#lib/components/profile/GoalSelector.svelte';
	import MeasurementTiles from '#lib/components/profile/MeasurementTiles.svelte';
	import PreferenceChips from '#lib/components/profile/PreferenceChips.svelte';
	import TargetsCard from '#lib/components/profile/TargetsCard.svelte';
	import Button from '#lib/components/shared/Button.svelte';
	import Card from '#lib/components/shared/Card.svelte';
	import ErrorBanner from '#lib/components/shared/ErrorBanner.svelte';
	import type { ActivityPreference, FitnessGoal } from '#lib/goals.js';
	import { m } from '#lib/paraglide/messages.js';
	import { draftFromGoal, draftToInput } from '#lib/profile-form.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const profile = $derived(data.overview.profile);
	const initials = $derived(
		(profile.display_name ?? '')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]!.toUpperCase())
			.join('') || '·'
	);

	let saving = $state<'goal' | 'prefs' | null>(null);
	let failed = $state(false);
	// Optimistic copies so taps respond instantly; reset from data after refresh.
	let goal = $derived(draftFromGoal(data.overview.goal).fitness_goal);
	let prefs = $derived(profile.activity_preferences as ActivityPreference[]);

	async function save(kind: 'goal' | 'prefs', run: () => Promise<unknown>) {
		saving = kind;
		failed = false;
		try {
			await run();
			await refreshAll();
		} catch {
			failed = true;
			await refreshAll();
		} finally {
			saving = null;
		}
	}

	function changeGoal(next: FitnessGoal) {
		const { input } = draftToInput({ ...draftFromGoal(data.overview.goal), fitness_goal: next });
		void save('goal', () => api('PUT', '/api/goals', input));
	}

	function changePrefs(next: ActivityPreference[]) {
		prefs = next;
		void save('prefs', () => api('PATCH', '/api/profile', { activity_preferences: next }));
	}
</script>

<svelte:head><title>{m.profile_title()} · {m.app_name()}</title></svelte:head>

<PageHeader title={m.profile_title()} />

<div class="space-y-4 px-4">
	{#if failed}<ErrorBanner message={m.error_generic()} />{/if}

	<Card>
		<div class="flex items-center gap-4">
			<span
				class="grid size-16 shrink-0 place-items-center rounded-full bg-green heading text-xl font-bold text-white"
				aria-hidden="true">{initials}</span
			>
			<div class="min-w-0 flex-1">
				<p class="truncate heading text-xl font-bold">{profile.display_name}</p>
				{#if data.email}<p class="truncate text-sm text-muted">{data.email}</p>{/if}
			</div>
			<Button
				variant="ghost"
				size="sm"
				class="size-11 shrink-0 px-0"
				href={resolve('/app/profile/edit')}
				aria-label={m.profile_edit_details()}
			>
				<SquarePen class="size-5" aria-hidden="true" />
			</Button>
		</div>
	</Card>

	<Card>
		<div class="mb-3 flex items-center justify-between">
			<h2 class="eyebrow">{m.profile_body_title()}</h2>
			<Button variant="ghost" size="sm" href={resolve('/app/profile/measurements')}>
				<Plus class="size-4" aria-hidden="true" />
				{m.measurement_add()}
			</Button>
		</div>
		<MeasurementTiles overview={data.overview} />
	</Card>

	<Card>
		<h2 class="mb-3 eyebrow">{m.goal_title()}</h2>
		<GoalSelector bind:value={goal} disabled={saving === 'goal'} onchange={changeGoal} />
	</Card>

	<Card>
		<div class="mb-3 flex items-center justify-between">
			<h2 class="eyebrow">{m.targets_title()}</h2>
			<Button variant="ghost" size="sm" href={resolve('/app/profile/goals')}>
				<Target class="size-4" aria-hidden="true" />
				{m.edit()}
			</Button>
		</div>
		<TargetsCard goal={data.overview.goal} />
	</Card>

	<Card>
		<h2 class="mb-3 eyebrow">{m.prefs_title()}</h2>
		<PreferenceChips value={prefs} disabled={saving === 'prefs'} onchange={changePrefs} />
	</Card>

	<Card padding="none">
		<a
			href={resolve('/app/profile/account')}
			class="flex min-h-14 items-center gap-3 px-5 text-[15px] font-semibold"
		>
			<Languages class="size-5 text-green" aria-hidden="true" />
			<span class="flex-1">{m.account_title()}</span>
			<ChevronRight class="size-5 text-muted" aria-hidden="true" />
		</a>
	</Card>
</div>
