import type {
	CoachMessage,
	CoachReply,
	CoachRequest,
	ConversationSummary
} from '#lib/schemas/coach.js';
import { unwrap, unwrapFound } from '../db.js';
import type { Profile } from '../services/profile.js';
import type { SupabaseServerClient } from '../supabase.js';
import { buildCoachContext, loadCoachRaw } from './coach-context.js';
import { aiApiError, recordFailure } from './errors.js';
import { AI_SETTINGS, getAIProvider } from './index.js';
import { COACH_SYSTEM, coachUserMessage } from './prompts/coach.js';
import type { AIMessage } from './provider.js';
import { assertWithinDailyLimit, logUsage } from './rate-limit.js';

const MESSAGE_FIELDS = 'id, role, content, created_at';
const CONVERSATION_FIELDS = 'id, title, created_at, updated_at';
/** `ai_messages.content` limit in the database. */
const MAX_CONTENT = 20_000;
/** `ai_conversations.title` limit in the database. */
const MAX_TITLE = 120;

/** The first question, on one line and cut to the title limit (no extra AI call). */
export function conversationTitle(question: string): string {
	const line = question.replace(/\s+/g, ' ').trim();
	return line.length <= MAX_TITLE ? line : `${line.slice(0, MAX_TITLE - 1).trimEnd()}…`;
}

/**
 * The last `limit` messages, oldest first, starting with a user message so the
 * roles alternate (messages are stored in user/assistant pairs).
 */
export function historyWindow(messages: CoachMessage[], limit: number): AIMessage[] {
	const recent = messages.slice(-limit);
	while (recent.length && recent[0].role !== 'user') recent.shift();
	return recent.map(({ role, content }) => ({ role, content }));
}

export async function listConversations(
	sb: SupabaseServerClient,
	userId: string,
	limit = 100
): Promise<ConversationSummary[]> {
	return (
		unwrap(
			await sb
				.from('ai_conversations')
				.select(CONVERSATION_FIELDS)
				.eq('user_id', userId)
				.order('updated_at', { ascending: false })
				.limit(limit)
		) ?? []
	);
}

async function loadMessages(
	sb: SupabaseServerClient,
	userId: string,
	conversationId: string
): Promise<CoachMessage[]> {
	const rows =
		unwrap(
			await sb
				.from('ai_messages')
				.select(MESSAGE_FIELDS)
				.eq('user_id', userId)
				.eq('conversation_id', conversationId)
				.order('created_at', { ascending: true })
				.limit(500)
		) ?? [];
	return rows as CoachMessage[];
}

/** One conversation with its messages (NOT_FOUND for another user's or a missing id). */
export async function getConversation(
	sb: SupabaseServerClient,
	userId: string,
	id: string
): Promise<ConversationSummary & { messages: CoachMessage[] }> {
	const conversation = unwrapFound(
		await sb
			.from('ai_conversations')
			.select(CONVERSATION_FIELDS)
			.eq('user_id', userId)
			.eq('id', id)
			.maybeSingle()
	);
	return { ...conversation, messages: await loadMessages(sb, userId, id) };
}

/** Deletes a conversation; its messages cascade. */
export async function deleteConversation(sb: SupabaseServerClient, userId: string, id: string) {
	unwrapFound(
		await sb
			.from('ai_conversations')
			.delete()
			.eq('user_id', userId)
			.eq('id', id)
			.select('id')
			.maybeSingle()
	);
}

/**
 * POST /api/ai/coach pipeline (AI_SPEC.md): daily limit → load the
 * conversation → build the context pack → ask the model → store the question
 * and the reply → log usage. If the AI call fails nothing is stored (no new
 * conversation, no message), so the UI can keep the text and offer a retry.
 */
export async function sendCoachMessage(
	sb: SupabaseServerClient,
	userId: string,
	input: CoachRequest,
	profile: Profile,
	today: string,
	now: () => Date = () => new Date()
): Promise<CoachReply> {
	const settings = AI_SETTINGS.coach;
	await assertWithinDailyLimit(sb, userId, 'coach', settings.dailyLimit);

	// Checked before the AI call so a wrong id costs nothing.
	const previous = input.conversation_id
		? (await getConversation(sb, userId, input.conversation_id)).messages
		: [];

	const askedAt = now();
	const raw = await loadCoachRaw(sb, userId, profile, today, askedAt);
	const locale = profile.locale === 'ru' ? 'ru' : 'en';

	let text: string;
	let model: string;
	let provider: string;
	try {
		const ai = getAIProvider();
		const result = await ai.generateText({
			system: COACH_SYSTEM,
			messages: [
				...historyWindow(previous, settings.historyMessages),
				{ role: 'user', content: coachUserMessage(input.message, buildCoachContext(raw), locale) }
			],
			model: settings.model,
			effort: settings.effort,
			maxTokens: settings.maxTokens,
			timeoutMs: settings.timeoutMs,
			fallback: true
		});
		await logUsage(sb, userId, 'coach', result.usage, 'ok');
		text = result.text.trim().slice(0, MAX_CONTENT);
		model = result.usage.model;
		provider = result.usage.provider;
	} catch (error) {
		throw aiApiError(await recordFailure(sb, userId, 'coach', error));
	}

	const isNew = input.conversation_id === null;
	const conversationId =
		input.conversation_id ??
		unwrapFound(
			await sb
				.from('ai_conversations')
				.insert({ user_id: userId, title: conversationTitle(input.message) })
				.select('id')
				.maybeSingle()
		).id;

	// One statement, so the question is never stored without its reply. Explicit
	// timestamps keep the order (both rows would otherwise get the same now()).
	const answeredAt = new Date(Math.max(now().getTime(), askedAt.getTime() + 1));
	const inserted = await sb
		.from('ai_messages')
		.insert([
			{
				conversation_id: conversationId,
				user_id: userId,
				role: 'user',
				content: input.message,
				created_at: askedAt.toISOString()
			},
			{
				conversation_id: conversationId,
				user_id: userId,
				role: 'assistant',
				content: text,
				provider,
				model,
				created_at: answeredAt.toISOString()
			}
		])
		.select(MESSAGE_FIELDS);
	if (inserted.error && isNew) {
		// Don't leave an empty conversation behind.
		await sb.from('ai_conversations').delete().eq('user_id', userId).eq('id', conversationId);
	}
	const rows = unwrap(inserted) ?? [];

	const reply = rows.find((r) => r.role === 'assistant') as CoachMessage | undefined;
	if (!reply) throw new Error('[ai] coach reply was not stored');
	return { conversation_id: conversationId, message: reply };
}
