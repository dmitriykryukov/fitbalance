import type { AuthUser, SupabaseServerClient } from '#lib/server/supabase.js';

// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			/** Request-scoped Supabase client (RLS applies). */
			supabase: SupabaseServerClient;
			/** Verified signed-in user, or null. Memoised per request. */
			getUser: () => Promise<AuthUser | null>;
		}
		interface Error {
			code?: string;
		}
	}
}

export {};
