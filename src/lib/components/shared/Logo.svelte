<script lang="ts">
	import logo from '#lib/assets/logo.svg';
	import { m } from '#lib/paraglide/messages.js';

	type Props = {
		/** Mark size in px. */
		size?: number;
		/** Show the "FitBalance" wordmark next to the mark. */
		wordmark?: boolean;
		class?: string;
	};

	let { size = 40, wordmark = true, class: className = '' }: Props = $props();
</script>

<span class={['inline-flex items-center gap-2.5', className]}>
	<img
		src={logo}
		width={size}
		height={size}
		alt={wordmark ? '' : m.app_name()}
		class="shrink-0"
		style:width="{size}px"
		style:height="{size}px"
	/>
	{#if wordmark}<span class="heading text-lg font-bold text-ink">{m.app_name()}</span>{/if}
</span>
