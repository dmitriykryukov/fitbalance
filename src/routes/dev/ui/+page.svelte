<script lang="ts">
	import { Plus, Sparkles } from '@lucide/svelte';
	import EnergyHero from '#lib/components/dashboard/EnergyHero.svelte';
	import MacroCard from '#lib/components/dashboard/MacroCard.svelte';
	import Button from '#lib/components/shared/Button.svelte';
	import Card from '#lib/components/shared/Card.svelte';
	import Chip from '#lib/components/shared/Chip.svelte';
	import ErrorBanner from '#lib/components/shared/ErrorBanner.svelte';
	import LanguageSwitch from '#lib/components/shared/LanguageSwitch.svelte';
	import Skeleton from '#lib/components/shared/Skeleton.svelte';
	import { formatLongDate } from '#lib/format.js';
</script>

<!-- Sample values only; this route returns 404 outside `npm run dev`. -->
<div class="mx-auto max-w-[480px] pb-10">
	<section
		class="rounded-b-[32px] bg-linear-to-br from-green-dark to-green px-5 pt-10 pb-16 text-white"
	>
		<p class="eyebrow text-white/80!">{formatLongDate('2026-11-07')}</p>
		<h1 class="mt-1 mb-6 heading text-[28px] font-bold text-white!">Good morning, Maya</h1>
		<EnergyHero consumedKcal={1250} goalKcal={2000} activeKcal={310} />
	</section>

	<div class="-mt-10 space-y-4 px-4">
		<div>
			<MacroCard
				protein={{ value: 95, target: 150 }}
				carbs={{ value: 120, target: 210 }}
				fat={{ value: 42, target: 65 }}
			/>
		</div>

		<div class="flex items-center justify-between px-1">
			<p class="eyebrow">Today's targets</p>
			<Chip>On track</Chip>
		</div>

		<Card>
			<p class="eyebrow">Buttons</p>
			<div class="mt-3 flex flex-wrap gap-2">
				<Button><Plus class="size-4" /> Add food</Button>
				<Button variant="soft"><Sparkles class="size-4" /> Log with AI</Button>
				<Button variant="outline">Today</Button>
				<Button variant="ghost">View all</Button>
				<Button loading>Saving</Button>
			</div>
			<div class="mt-3 flex flex-wrap gap-2">
				<Chip>On track</Chip>
				<Chip tone="amber">Estimated</Chip>
				<Chip tone="neutral">Not logged</Chip>
				<Chip tone="blue">Walking</Chip>
			</div>
		</Card>

		<Card>
			<p class="eyebrow">Typography · Кириллица</p>
			<h2 class="mt-2 heading text-[19px] font-bold">Today's meals · Сегодняшние приёмы пищи</h2>
			<p class="mt-1 text-sm text-muted">
				Greek yogurt, blueberries, almonds · Греческий йогурт, черника, миндаль
			</p>
		</Card>

		<Card><LanguageSwitch /></Card>
		<ErrorBanner message="Couldn't analyze the meal. Your text is saved." onretry={() => {}} />
		<Card>
			<Skeleton class="mb-2 h-5 w-1/2" />
			<Skeleton class="h-4 w-full" />
		</Card>
	</div>
</div>
