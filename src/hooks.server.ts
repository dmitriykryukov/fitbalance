import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { getTextDirection } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { createSupabaseServerClient, type AuthUser } from '#lib/server/supabase.js';

/**
 * Attaches a per-request Supabase client and a verified session lookup.
 * `getClaims()` verifies the access token's signature (refreshing it if it is
 * about to expire), so the user ID can be trusted — unlike `getSession()`,
 * which only reads the cookie.
 */
const handleSupabase: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createSupabaseServerClient(event);

	let cached: Promise<AuthUser | null> | undefined;
	event.locals.getUser = () => {
		cached ??= event.locals.supabase.auth.getClaims().then(({ data, error }) => {
			if (error || !data?.claims?.sub) return null;
			return { id: data.claims.sub, email: data.claims.email ?? null };
		});
		return cached;
	};

	return resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		return resolve(
			{ ...event, request },
			{
				transformPageChunk: ({ html }) =>
					html
						.replace('%paraglide.lang%', locale)
						.replace('%paraglide.dir%', getTextDirection(locale))
			}
		);
	});

export const handle: Handle = sequence(handleSupabase, handleParaglide);
