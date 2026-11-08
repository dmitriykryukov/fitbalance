<script lang="ts">
	import { Activity, Apple, House, Sparkles, UserRound } from '@lucide/svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';

	const tabs = [
		{ href: resolve('/app'), label: m.nav_today, icon: House, exact: true },
		{ href: resolve('/app/nutrition'), label: m.nav_nutrition, icon: Apple, exact: false },
		{ href: resolve('/app/activity'), label: m.nav_activity, icon: Activity, exact: false },
		{ href: resolve('/app/coach'), label: m.nav_coach, icon: Sparkles, exact: false },
		{ href: resolve('/app/profile'), label: m.nav_profile, icon: UserRound, exact: false }
	];

	function isActive(href: string, exact: boolean) {
		const path = page.url.pathname;
		return exact ? path === href : path === href || path.startsWith(`${href}/`);
	}
</script>

<nav
	class="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
	aria-label={m.nav_main()}
>
	<ul class="grid grid-cols-5">
		{#each tabs as tab (tab.href)}
			{@const active = isActive(tab.href, tab.exact)}
			<li>
				<a
					href={tab.href}
					class="flex flex-col items-center gap-1 pt-2 pb-2.5 text-[11px] font-semibold"
					class:text-green={active}
					class:text-muted={!active}
					aria-current={active ? 'page' : undefined}
				>
					<span
						class="grid h-8 w-12 place-items-center rounded-full transition-colors"
						class:bg-mint={active}
					>
						<tab.icon class="size-5" strokeWidth={active ? 2.25 : 1.75} />
					</span>
					{tab.label()}
				</a>
			</li>
		{/each}
	</ul>
</nav>
