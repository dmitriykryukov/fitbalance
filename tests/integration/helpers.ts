import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RequestEvent } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$app/env/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$app/env/private';
import type { Database } from '#lib/types/database.js';

export type TestUser = {
	id: string;
	email: string;
	client: SupabaseClient<Database>;
};

const noPersist = { auth: { persistSession: false, autoRefreshToken: false } } as const;

function admin() {
	if (!SUPABASE_SERVICE_ROLE_KEY) {
		throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for integration tests (.env).');
	}
	return createClient<Database>(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, noPersist);
}

/**
 * Creates a confirmed throwaway user (no email is sent) and signs in with the
 * public key, exactly like the app does. Delete with `deleteTestUser`.
 */
export async function createTestUser(label: string): Promise<TestUser> {
	const email = `it-${label}-${crypto.randomUUID().slice(0, 8)}@fitbalance.test`;
	const password = crypto.randomUUID();
	const { data, error } = await admin().auth.admin.createUser({
		email,
		password,
		email_confirm: true
	});
	if (error || !data.user) throw error ?? new Error('createUser returned no user');

	const client = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, noPersist);
	const signIn = await client.auth.signInWithPassword({ email, password });
	if (signIn.error) throw signIn.error;
	return { id: data.user.id, email, client };
}

/** Deleting the auth user cascades to every row the user owns. */
export async function deleteTestUser(user: TestUser | undefined) {
	if (!user) return;
	await user.client.auth.signOut({ scope: 'local' });
	const { error } = await admin().auth.admin.deleteUser(user.id);
	if (error) throw error;
}

type Handler = (event: RequestEvent) => Promise<Response> | Response;

/**
 * Calls a `+server.ts` handler as `user` (or signed out when null), the same
 * way SvelteKit would after `hooks.server.ts` ran.
 */
export async function call(
	handler: Handler | undefined,
	user: TestUser | null,
	options: { url?: string; body?: unknown; params?: Record<string, string> } = {}
) {
	if (!handler) throw new Error('handler not exported');
	const url = new URL(options.url ?? '/api/test', 'http://localhost');
	const request = new Request(url, {
		method: options.body === undefined ? 'GET' : 'POST',
		headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
		body: options.body === undefined ? undefined : JSON.stringify(options.body)
	});
	const event = {
		request,
		url,
		params: options.params ?? {},
		locals: {
			supabase: (user?.client ?? null) as never,
			getUser: async () => (user ? { id: user.id, email: user.email } : null)
		}
	} as unknown as RequestEvent;

	const response = await handler(event);
	const text = await response.text();
	return { status: response.status, body: text ? JSON.parse(text) : null };
}
