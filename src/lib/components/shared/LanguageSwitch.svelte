<script lang="ts">
	import { getLocale, locales, setLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';

	const labels: Record<(typeof locales)[number], () => string> = {
		en: m.language_en,
		ru: m.language_ru
	};

	const current = getLocale();
</script>

<fieldset>
	<legend class="mb-2 eyebrow">{m.language()}</legend>
	<div class="grid grid-cols-2 gap-1 rounded-tile bg-line/60 p-1">
		{#each locales as locale (locale)}
			<button
				type="button"
				class="h-10 rounded-field text-sm font-semibold transition-colors"
				class:bg-white={locale === current}
				class:shadow-card={locale === current}
				class:text-ink={locale === current}
				class:text-muted={locale !== current}
				aria-pressed={locale === current}
				onclick={() => setLocale(locale)}
			>
				{labels[locale]()}
			</button>
		{/each}
	</div>
</fieldset>
