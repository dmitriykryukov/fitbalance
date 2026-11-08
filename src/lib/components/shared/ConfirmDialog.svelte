<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import Button from './Button.svelte';

	type Props = {
		open: boolean;
		title: string;
		body?: string;
		confirmLabel: string;
		busy?: boolean;
		onconfirm: () => void;
	};

	let { open = $bindable(), title, body, confirmLabel, busy = false, onconfirm }: Props = $props();

	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	onclose={() => (open = false)}
	aria-labelledby="confirm-title"
	class="m-auto w-[calc(100%-2rem)] max-w-sm rounded-card bg-white p-5 shadow-card backdrop:bg-ink/40"
>
	<h2 id="confirm-title" class="heading text-lg font-bold">{title}</h2>
	{#if body}<p class="mt-1.5 text-sm text-muted">{body}</p>{/if}
	<div class="mt-5 grid grid-cols-2 gap-2">
		<Button variant="outline" disabled={busy} onclick={() => (open = false)}>{m.cancel()}</Button>
		<Button variant="danger" loading={busy} onclick={onconfirm}>{confirmLabel}</Button>
	</div>
</dialog>
