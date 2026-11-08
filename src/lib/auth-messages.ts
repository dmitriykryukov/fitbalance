import { m } from '#lib/paraglide/messages.js';
import type { AuthErrorCode } from '#lib/server/auth.js';

/** Localised text for an auth error code returned by a form action. */
export function authErrorMessage(code: AuthErrorCode | null | undefined): string | null {
	switch (code) {
		case null:
		case undefined:
			return null;
		case 'invalid_credentials':
			return m.auth_error_invalid_credentials();
		case 'email_not_confirmed':
			return m.auth_error_email_not_confirmed();
		case 'weak_password':
			return m.auth_error_weak_password();
		case 'invalid_email':
			return m.auth_error_invalid_email();
		case 'rate_limited':
			return m.auth_error_rate_limited();
		case 'link_invalid':
			return m.auth_error_link_invalid();
		default:
			return m.error_generic();
	}
}
