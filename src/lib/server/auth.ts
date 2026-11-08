import type { Cookies } from '@sveltejs/kit';
import { z } from 'zod';
import { cookieMaxAge, cookieName, isLocale } from '#lib/paraglide/runtime.js';

/** Paths that need a signed-in user. */
export function isProtectedPath(pathname: string): boolean {
	return (
		pathname === '/app' ||
		pathname.startsWith('/app/') ||
		pathname === '/onboarding' ||
		pathname.startsWith('/onboarding/')
	);
}

/**
 * Where to go after signing in. Only same-site app paths are allowed, so a
 * crafted `?next=` can never send the user to another site.
 */
export function safeNext(next: string | null | undefined, fallback = '/app'): string {
	if (!next) return fallback;
	let url: URL;
	try {
		url = new URL(next, 'http://local.invalid');
	} catch {
		return fallback;
	}
	if (url.origin !== 'http://local.invalid' || !isProtectedPath(url.pathname)) return fallback;
	return url.pathname + url.search;
}

export const Credentials = z.object({
	email: z.email().max(254),
	password: z.string().min(8).max(72)
});

export const EmailOnly = z.object({ email: z.email().max(254) });

export type AuthErrorCode =
	| 'invalid_credentials'
	| 'email_not_confirmed'
	| 'weak_password'
	| 'invalid_email'
	| 'rate_limited'
	| 'link_invalid'
	| 'generic';

/** Maps a Supabase Auth error to a code the page turns into a localised message. */
export function authErrorCode(error: { code?: string; status?: number }): AuthErrorCode {
	switch (error.code) {
		case 'invalid_credentials':
			return 'invalid_credentials';
		case 'email_not_confirmed':
			return 'email_not_confirmed';
		case 'weak_password':
			return 'weak_password';
		case 'email_address_invalid':
		case 'email_address_not_authorized':
		case 'validation_failed':
			return 'invalid_email';
		case 'over_email_send_rate_limit':
		case 'over_request_rate_limit':
			return 'rate_limited';
	}
	return error.status === 429 ? 'rate_limited' : 'generic';
}

/** Writes the UI language cookie Paraglide reads on the next request. */
export function setLocaleCookie(cookies: Cookies, locale: string | null | undefined) {
	if (!isLocale(locale)) return;
	cookies.set(cookieName, locale, {
		path: '/',
		maxAge: cookieMaxAge,
		sameSite: 'lax',
		httpOnly: false
	});
}
