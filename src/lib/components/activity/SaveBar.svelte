<script lang="ts">
	import Button from '#lib/components/shared/Button.svelte';

	type Props = {
		/** Small summary line above the main one (e.g. "3 sets · 45 min"). */
		label: string;
		value: string;
		saveLabel: string;
		saving: boolean;
		onsave: () => void;
	};

	let { label, value, saveLabel, saving, onsave }: Props = $props();
</script>

<div
	class="fixed inset-x-0 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[480px] px-4"
>
	<div
		class="flex items-center gap-3 rounded-card border border-line bg-white/95 p-2.5 pl-4 shadow-card backdrop-blur"
	>
		<div class="min-w-0 flex-1">
			<p class="truncate text-xs text-muted">{label}</p>
			<p class="truncate font-bold tabular-nums">{value}</p>
		</div>
		<Button onclick={onsave} loading={saving}>{saveLabel}</Button>
	</div>
</div>
