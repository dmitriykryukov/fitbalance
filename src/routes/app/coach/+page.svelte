<script lang="ts">
	import { MessagesSquare, SendHorizontal, SquarePen } from '@lucide/svelte';
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { api, ApiClientError } from '#lib/api/client.js';
	import CoachOverview from '#lib/components/coach/CoachOverview.svelte';
	import MessageBubble from '#lib/components/coach/MessageBubble.svelte';
	import SuggestedQuestions from '#lib/components/coach/SuggestedQuestions.svelte';
	import TypingIndicator from '#lib/components/coach/TypingIndicator.svelte';
	import InsightCard from '#lib/components/dashboard/InsightCard.svelte';
	import PageHeader from '#lib/components/layout/PageHeader.svelte';
	import ErrorBanner from '#lib/components/shared/ErrorBanner.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { CoachMessage, CoachReply } from '#lib/schemas/coach.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Reset whenever another conversation (or a new one) is opened.
	let conversationId = $derived(data.conversation?.id ?? null);
	let messages = $derived<CoachMessage[]>(data.conversation?.messages ?? []);

	let text = $state('');
	let sending = $state(false);
	let error = $state<string | null>(null);
	let input: HTMLTextAreaElement | undefined = $state();
	let thread: HTMLOListElement | undefined = $state();
	let errorBox: HTMLDivElement | undefined = $state();

	const newHref = `${resolve('/app/coach')}?new` as ResolvedPathname;

	function errorMessage(e: unknown): string {
		if (e instanceof ApiClientError) {
			if (e.code === 'AI_REFUSED') return m.coach_error_refused();
			if (e.code === 'RATE_LIMITED' || e.code === 'AI_PROVIDER_ERROR') return e.message;
		}
		return m.coach_error_failed();
	}

	async function scrollToEnd() {
		await tick();
		thread?.lastElementChild?.scrollIntoView({ block: 'start', behavior: 'smooth' });
	}

	function resize() {
		if (!input) return;
		input.style.height = 'auto';
		input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
	}

	async function send(question?: string) {
		const content = (question ?? text).trim();
		if (!content || sending) return;
		error = null;
		sending = true;
		text = '';
		await tick();
		resize();

		const pendingId = `pending-${Date.now()}`;
		messages = [
			...messages,
			{ id: pendingId, role: 'user', content, created_at: new Date().toISOString() }
		];
		void scrollToEnd();
		try {
			const reply = await api<CoachReply>('POST', '/api/ai/coach', {
				conversation_id: conversationId,
				message: content
			});
			conversationId = reply.conversation_id;
			messages = [...messages, reply.message];
		} catch (e) {
			// Nothing was stored: take the question back into the field for a retry.
			messages = messages.filter((msg) => msg.id !== pendingId);
			text = content;
			error = errorMessage(e);
			await tick();
			resize();
			errorBox?.scrollIntoView({ block: 'center', behavior: 'smooth' });
			return;
		} finally {
			sending = false;
		}
		void scrollToEnd();
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			void send();
		}
	}
</script>

<svelte:head><title>{m.coach_title()} · {m.app_name()}</title></svelte:head>

<PageHeader title={m.coach_title()} subtitle={m.coach_subtitle()}>
	{#snippet actions()}
		<a
			href={resolve('/app/coach/history')}
			class="grid size-10 place-items-center rounded-full border border-line bg-white text-ink hover:bg-mint"
			aria-label={m.coach_history()}
			title={m.coach_history()}
		>
			<MessagesSquare class="size-5" aria-hidden="true" />
		</a>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built from resolve() -->
		<a
			href={newHref}
			class="grid size-10 place-items-center rounded-full bg-green text-white hover:bg-green-dark"
			aria-label={m.coach_new()}
			title={m.coach_new()}
		>
			<SquarePen class="size-5" aria-hidden="true" />
		</a>
	{/snippet}
</PageHeader>

<div class="space-y-5 px-4 pb-28">
	<CoachOverview stats={data.stats} highlights={data.highlights} />

	{#await data.insight then insight}
		{#if insight}
			<InsightCard {insight} label={m.coach_recommendation()} />
		{/if}
	{/await}

	{#if messages.length === 0 && !sending}
		<section class="rounded-card border border-line bg-white p-5 shadow-card">
			<p class="heading text-lg font-bold">{m.coach_empty_title()}</p>
			<p class="mt-1 text-sm text-muted">{m.coach_empty_body()}</p>
			<div class="mt-4">
				<SuggestedQuestions onpick={(q) => send(q)} disabled={sending} />
			</div>
		</section>
	{/if}

	{#if messages.length}
		<ol bind:this={thread} class="space-y-4" aria-live="polite" aria-label={m.coach_title()}>
			{#each messages as message (message.id)}
				<MessageBubble role={message.role} content={message.content} />
			{/each}
			{#if sending}
				<TypingIndicator />
			{/if}
		</ol>
	{/if}

	{#if error}
		<div bind:this={errorBox}>
			<ErrorBanner message={error} onretry={() => send()} />
		</div>
	{/if}

	<p class="px-1 text-center text-xs text-muted">
		{m.coach_disclaimer()}
		{m.coach_privacy()}
	</p>
</div>

<form
	class="fixed inset-x-0 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[480px] px-4"
	onsubmit={(event) => {
		event.preventDefault();
		void send();
	}}
>
	<div
		class="flex items-end gap-2 rounded-card border border-line bg-white/95 p-2 pl-4 shadow-card backdrop-blur"
	>
		<label class="sr-only" for="coach-input">{m.coach_input_label()}</label>
		<textarea
			id="coach-input"
			bind:this={input}
			bind:value={text}
			oninput={resize}
			{onkeydown}
			rows="1"
			maxlength="2000"
			enterkeyhint="send"
			placeholder={m.coach_input_placeholder()}
			class="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 text-base outline-none placeholder:text-muted/70"
		></textarea>
		<button
			type="submit"
			disabled={sending || !text.trim()}
			class="grid size-10 shrink-0 place-items-center rounded-full bg-green text-white hover:bg-green-dark disabled:bg-line disabled:text-muted"
			aria-label={m.coach_send()}
		>
			<SendHorizontal class="size-5" aria-hidden="true" />
		</button>
	</div>
</form>
