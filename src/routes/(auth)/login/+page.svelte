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
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let pending = $state<'password' | 'magic' | null>(null);
	let dismissedSent = $state(false);

	const sentTo = $derived(form && 'sent' in form && !dismissedSent ? form.email : null);
	const errorText = $derived(
		authErrorMessage(form && 'error' in form ? form.error : data.linkError ? 'link_invalid' : null)
	);
	const formEmail = $derived(form && 'email' in form ? form.email : '');
</script>

<svelte:head><title>{m.auth_login_title()} · {m.app_name()}</title></svelte:head>

<AuthLayout title={m.auth_login_title()} subtitle={m.auth_login_subtitle()}>
	{#if sentTo}
		<CheckEmail email={sentTo} onreset={() => (dismissedSent = true)} />
	{:else}
		<form
			method="POST"
			action="?/password"
			class="space-y-4"
			use:enhance={({ action }) => {
				pending = action.search.includes('magic') ? 'magic' : 'password';
				dismissedSent = false;
				return async ({ update }) => {
					await update({ reset: false, navigate: false });
					pending = null;
				};
			}}
		>
			{#if errorText}
				<ErrorBanner message={errorText} />
			{/if}
			<input type="hidden" name="next" value={data.next} />
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
				autocomplete="current-password"
				minlength={8}
			/>
			<Button type="submit" full size="lg" loading={pending === 'password'} disabled={!!pending}>
				{m.auth_sign_in()}
			</Button>

			<div class="flex items-center gap-3 text-xs font-semibold text-muted uppercase">
				<span class="h-px flex-1 bg-line"></span>{m.auth_or()}<span class="h-px flex-1 bg-line"
				></span>
			</div>

			<Button
				type="submit"
				variant="outline"
				full
				size="lg"
				formaction="?/magic"
				formnovalidate
				loading={pending === 'magic'}
				disabled={!!pending}
			>
				{m.auth_magic_link()}
			</Button>
		</form>
	{/if}

	{#snippet footer()}
		{m.auth_no_account()}
		<a href={resolve('/(auth)/signup')} class="font-semibold text-green"
			>{m.auth_create_account()}</a
		>
	{/snippet}
</AuthLayout>
