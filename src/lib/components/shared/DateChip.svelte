<script lang="ts">
	import { CalendarDays } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import type { ResolvedPathname } from '$app/types';
	import { addDays, MIN_LOCAL_DATE } from '#lib/dates.js';
	import { formatShortDate } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';

	type Props = {
		date: string;
		today: string;
		/** URL showing another date. */
		hrefFor: (date: string) => ResolvedPathname;
	};

	let { date, today, hrefFor }: Props = $props();

	const label = $derived(
		date === today
			? m.date_today()
			: date === addDays(today, -1)
				? m.date_yesterday()
				: formatShortDate(date)
	);

	function pick(event: Event) {
		const value = (event.currentTarget as HTMLInputElement).value;
		if (value && value !== date && value <= today && value >= MIN_LOCAL_DATE) {
			void goto(hrefFor(value));
		}
	}
</script>

<!-- The native date input sits on top of the chip (invisible), so a tap opens the
     system date picker on iOS and Android without any JavaScript picker. -->
<label
	class="relative inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-sm font-bold whitespace-nowrap shadow-card focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-green"
>
	<CalendarDays class="size-4 text-green" aria-hidden="true" />
	<span aria-hidden="true">{label}</span>
	<input
		type="date"
		value={date}
		min={MIN_LOCAL_DATE}
		max={today}
		onchange={pick}
		onclick={(event) => {
			// Desktop browsers only open the calendar from its icon otherwise.
			try {
				event.currentTarget.showPicker();
			} catch {
				// Not supported: the input stays focused and editable.
			}
		}}
		aria-label={m.date_pick()}
		class="absolute inset-0 cursor-pointer opacity-0"
	/>
</label>
