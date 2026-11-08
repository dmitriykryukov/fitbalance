<script lang="ts">
	import { MailCheck } from '@lucide/svelte';
	import Card from '#lib/components/shared/Card.svelte';
	import { m } from '#lib/paraglide/messages.js';

	type Props = { email: string; onreset: () => void };

	let { email, onreset }: Props = $props();
</script>

<Card>
	<div class="flex flex-col items-center text-center" role="status">
		<span class="grid size-12 place-items-center rounded-tile bg-mint text-green">
			<MailCheck class="size-6" aria-hidden="true" />
		</span>
		<h2 class="mt-4 heading text-lg font-bold">{m.auth_check_email_title()}</h2>
		<p class="mt-1.5 text-sm text-muted">{m.auth_check_email_body({ email })}</p>
		<p class="mt-3 text-xs text-muted">{m.auth_pwa_hint()}</p>
		<button
			type="button"
			class="mt-5 text-sm font-semibold text-green underline-offset-2 hover:underline"
			onclick={onreset}
		>
			{m.auth_use_other_email()}
		</button>
	</div>
</Card>
