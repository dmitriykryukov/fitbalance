<script lang="ts">
	import { getLocale, locales, setLocale, type Locale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';

	type Props = {
		/** Saves the choice (e.g. to the profile) before the page reloads in the new language. */
		persist?: (locale: Locale) => Promise<void>;
	};

	let { persist }: Props = $props();

	const labels: Record<Locale, () => string> = {
		en: m.language_en,
		ru: m.language_ru
	};

	const current = getLocale();
	let busy = $state(false);
	let failed = $state(false);

	async function choose(locale: Locale) {
		if (locale === current || busy) return;
		busy = true;
		failed = false;
		try {
			await persist?.(locale);
			setLocale(locale);
		} catch {
			failed = true;
			busy = false;
		}
	}
</script>

<fieldset>
	<legend class="mb-2 eyebrow">{m.language()}</legend>
	<div class="grid grid-cols-2 gap-1 rounded-tile bg-line/60 p-1" aria-busy={busy}>
		{#each locales as locale (locale)}
			<button
				type="button"
				lang={locale}
				class="h-10 rounded-field text-sm font-semibold transition-colors disabled:opacity-60"
				class:bg-white={locale === current}
				class:shadow-card={locale === current}
				class:text-ink={locale === current}
				class:text-muted={locale !== current}
				aria-pressed={locale === current}
				disabled={busy}
				onclick={() => choose(locale)}
			>
				{labels[locale]()}
			</button>
		{/each}
	</div>
	{#if failed}
		<p class="mt-2 text-sm text-red-700" role="alert">{m.error_generic()}</p>
	{/if}
</fieldset>
