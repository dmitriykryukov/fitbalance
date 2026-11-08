import { createServerClient } from '@supabase/ssr';
import type { RequestEvent } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$app/env/public';
import type { Database } from '#lib/types/database.js';

/**
 * Supabase client bound to the current request's cookies. Queries run as the
 * signed-in user, so Row Level Security applies to every call.
 * Create one per request — never share it between requests.
 */
export function createSupabaseServerClient(event: RequestEvent) {
	return createServerClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet, headers) => {
				for (const { name, value, options } of cookiesToSet) {
					event.cookies.set(name, value, { ...options, path: '/' });
				}
				// Supabase asks for no-cache headers whenever auth cookies change, so a
				// CDN never serves one user's session to someone else.
				try {
					event.setHeaders(headers);
				} catch {
					// Headers were already set for this response (e.g. by a load function).
				}
			}
		}
	});
}

export type SupabaseServerClient = ReturnType<typeof createSupabaseServerClient>;

/** Identity taken from a verified access token. */
export type AuthUser = { id: string; email: string | null };
