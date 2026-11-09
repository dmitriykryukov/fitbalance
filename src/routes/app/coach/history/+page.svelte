<script lang="ts">
	import { ChevronRight, MessagesSquare, Trash2 } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { api } from '#lib/api/client.js';
	import PageHeader from '#lib/components/layout/PageHeader.svelte';
	import Button from '#lib/components/shared/Button.svelte';
	import ConfirmDialog from '#lib/components/shared/ConfirmDialog.svelte';
	import EmptyState from '#lib/components/shared/EmptyState.svelte';
	import ErrorBanner from '#lib/components/shared/ErrorBanner.svelte';
	import { localDate } from '#lib/dates.js';
	import { formatShortDate, formatTime } from '#lib/format.js';
	import { apiErrorToForm } from '#lib/forms.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { ConversationSummary } from '#lib/schemas/coach.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let conversations = $derived<ConversationSummary[]>(data.conversations);
	let deleting = $state<ConversationSummary | null>(null);
	let confirmOpen = $state(false);
	let busy = $state(false);
	let error = $state<string | null>(null);

	const timeZone = $derived(data.profile.timezone);
	const today = $derived(localDate(timeZone));
	const when = (iso: string) => {
		const day = localDate(timeZone, new Date(iso));
		return day === today ? formatTime(iso, timeZone) : formatShortDate(day);
	};
	const openHref = (id: string) => `${resolve('/app/coach')}?c=${id}` as ResolvedPathname;

	function askDelete(conversation: ConversationSummary) {
		deleting = conversation;
		confirmOpen = true;
	}

	async function confirmDelete() {
		if (!deleting) return;
		busy = true;
		error = null;
		try {
			await api('DELETE', `/api/ai/conversations/${deleting.id}`);
			const id = deleting.id;
			conversations = conversations.filter((c) => c.id !== id);
			confirmOpen = false;
		} catch (e) {
			error = apiErrorToForm(e).message;
			confirmOpen = false;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>{m.coach_history_title()} · {m.app_name()}</title></svelte:head>

<PageHeader title={m.coach_history_title()} backHref={resolve('/app/coach')} />

<div class="space-y-4 px-4 pb-8">
	{#if error}
		<ErrorBanner message={error} />
	{/if}

	{#if conversations.length === 0}
		<EmptyState
			title={m.coach_history_empty_title()}
			body={m.coach_history_empty_body()}
			icon={MessagesSquare}
		>
			{#snippet action()}
				<Button href={`${resolve('/app/coach')}?new` as ResolvedPathname}>{m.coach_ask()}</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<ul
			class="divide-y divide-line overflow-hidden rounded-card border border-line bg-white shadow-card"
		>
			{#each conversations as conversation (conversation.id)}
				<li class="flex items-center">
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built from resolve() -->
					<a
						href={openHref(conversation.id)}
						class="flex min-w-0 flex-1 items-center gap-3 py-3.5 pl-4 hover:bg-paper"
					>
						<div class="min-w-0 flex-1">
							<p class="truncate font-semibold">{conversation.title ?? m.coach_untitled()}</p>
							<p class="text-xs text-muted">
								{m.coach_updated({ date: when(conversation.updated_at) })}
							</p>
						</div>
						<ChevronRight class="size-4 shrink-0 text-muted" aria-hidden="true" />
					</a>
					<button
						type="button"
						class="mx-1 grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-red-50 hover:text-red-700"
						aria-label="{m.coach_delete_conversation()}: {conversation.title ?? m.coach_untitled()}"
						onclick={() => askDelete(conversation)}
					>
						<Trash2 class="size-4" aria-hidden="true" />
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<ConfirmDialog
	bind:open={confirmOpen}
	title={m.coach_delete_title()}
	body={m.coach_delete_body()}
	confirmLabel={m.delete()}
	{busy}
	onconfirm={confirmDelete}
/>
