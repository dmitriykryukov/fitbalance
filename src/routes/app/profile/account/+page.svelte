<script lang="ts">
	import { LogOut } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { api } from '#lib/api/client.js';
	import PageHeader from '#lib/components/layout/PageHeader.svelte';
	import Button from '#lib/components/shared/Button.svelte';
	import Card from '#lib/components/shared/Card.svelte';
	import LanguageSwitch from '#lib/components/shared/LanguageSwitch.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { Locale } from '#lib/paraglide/runtime.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let signingOut = $state(false);

	const saveLocale = async (locale: Locale) => {
		await api('PATCH', '/api/profile', { locale });
	};
</script>

<svelte:head><title>{m.account_title()} · {m.app_name()}</title></svelte:head>

<PageHeader title={m.account_title()} backHref={resolve('/app/profile')} />

<div class="space-y-4 px-4">
	<Card>
		<LanguageSwitch persist={saveLocale} />
		<p class="mt-3 text-sm text-muted">{m.account_units()}</p>
	</Card>

	<Card>
		<p class="eyebrow">{m.auth_email()}</p>
		<p class="mt-1 font-semibold break-all">{data.email}</p>
		<form
			method="POST"
			action="?/signout"
			class="mt-4"
			use:enhance={() => {
				signingOut = true;
				return async ({ update }) => {
					await update();
					signingOut = false;
				};
			}}
		>
			<Button type="submit" variant="outline" full loading={signingOut}>
				<LogOut class="size-4" aria-hidden="true" />
				{m.auth_sign_out()}
			</Button>
		</form>
	</Card>
</div>
