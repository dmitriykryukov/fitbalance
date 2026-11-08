<script lang="ts">
	let { class: className = 'h-4 w-full' }: { class?: string } = $props();
</script>

<div class={['animate-pulse rounded-field bg-line/70', className]} aria-hidden="true"></div>
