<script lang="ts">
	import TextField from '#lib/components/shared/TextField.svelte';
	import { m } from '#lib/paraglide/messages.js';

	type Props = {
		/** Text typed by the user (used when `edited`). */
		value: string;
		edited: boolean;
		/** MET estimate for the current inputs; null without a weight or duration. */
		estimate: number | null;
		hasWeight: boolean;
		error?: string | null;
	};

	let { value = $bindable(), edited = $bindable(), estimate, hasWeight, error }: Props = $props();

	// Not edited: the field shows the live estimate. Typing makes it the user's
	// number; clearing it goes back to the estimate.
	const shown = $derived(edited ? value : estimate === null ? '' : String(estimate));

	function input(event: Event) {
		const text = (event.currentTarget as HTMLInputElement).value;
		value = text;
		edited = text.trim() !== '';
	}

	const hint = $derived(
		edited
			? m.kcal_hint_user()
			: estimate !== null
				? m.kcal_hint_estimated()
				: hasWeight
					? m.kcal_hint_need_duration()
					: m.kcal_hint_no_weight()
	);
</script>

<TextField
	label={m.active_kcal_label()}
	value={shown}
	oninput={input}
	inputmode="numeric"
	suffix={m.kcal()}
	placeholder="—"
	{hint}
	{error}
/>
