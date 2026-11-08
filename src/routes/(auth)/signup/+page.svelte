<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import AuthLayout from '#lib/components/auth/AuthLayout.svelte';
	import CheckEmail from '#lib/components/auth/CheckEmail.svelte';
	import Button from '#lib/components/shared/Button.svelte';
	import ErrorBanner from '#lib/components/shared/ErrorBanner.svelte';
	import TextField from '#lib/components/shared/TextField.svelte';
	import { authErrorMessage } from '#lib/auth-messages.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();

	let pending = $state(false);
	let dismissedSent = $state(false);

	const sentTo = $derived(form && 'sent' in form && !dismissedSent ? form.email : null);
	const errorText = $derived(authErrorMessage(form && 'error' in form ? form.error : null));
	const formEmail = $derived(form && 'email' in form ? form.email : '');
</script>

<svelte:head><title>{m.auth_signup_title()} · {m.app_name()}</title></svelte:head>

<AuthLayout title={m.auth_signup_title()} subtitle={m.auth_signup_subtitle()}>
	{#if sentTo}
		<CheckEmail email={sentTo} onreset={() => (dismissedSent = true)} />
	{:else}
		<form
			method="POST"
			class="space-y-4"
			use:enhance={() => {
				pending = true;
				dismissedSent = false;
				return async ({ update }) => {
					await update({ reset: false, navigate: false });
					pending = false;
				};
			}}
		>
			{#if errorText}
				<ErrorBanner message={errorText} />
			{/if}
			<input type="hidden" name="locale" value={getLocale()} />
			<TextField
				label={m.auth_email()}
				name="email"
				type="email"
				autocomplete="email"
				inputmode="email"
				autocapitalize="none"
				spellcheck="false"
				required
				value={formEmail}
			/>
			<TextField
				label={m.auth_password()}
				name="password"
				type="password"
				autocomplete="new-password"
				minlength={8}
				maxlength={72}
				required
				hint={m.auth_password_hint()}
			/>
			<Button type="submit" full size="lg" loading={pending} disabled={pending}>
				{m.auth_sign_up()}
			</Button>
		</form>
	{/if}

	{#snippet footer()}
		{m.auth_have_account()}
		<a href={resolve('/(auth)/login')} class="font-semibold text-green">{m.auth_sign_in()}</a>
	{/snippet}
</AuthLayout>
