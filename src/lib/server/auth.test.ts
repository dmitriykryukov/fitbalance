import { describe, expect, it } from 'vitest';
import { authErrorCode, isProtectedPath, safeNext } from './auth.js';

describe('safeNext', () => {
	it('keeps app paths with their query', () => {
		expect(safeNext('/app/profile?tab=goals')).toBe('/app/profile?tab=goals');
		expect(safeNext('/onboarding')).toBe('/onboarding');
	});

	it('falls back for other sites and non-app paths', () => {
		for (const next of [
			'https://evil.example/app',
			'//evil.example/app',
			'/\\evil.example',
			'/login',
			'/api/profile',
			'javascript:alert(1)',
			'',
			null
		]) {
			expect(safeNext(next)).toBe('/app');
		}
	});
});

describe('isProtectedPath', () => {
	it('matches /app and /onboarding trees only', () => {
		expect(isProtectedPath('/app')).toBe(true);
		expect(isProtectedPath('/app/profile/goals')).toBe(true);
		expect(isProtectedPath('/onboarding')).toBe(true);
		expect(isProtectedPath('/apple')).toBe(false);
		expect(isProtectedPath('/login')).toBe(false);
	});
});

describe('authErrorCode', () => {
	it('maps known Supabase codes and rate limits', () => {
		expect(authErrorCode({ code: 'invalid_credentials' })).toBe('invalid_credentials');
		expect(authErrorCode({ code: 'over_email_send_rate_limit' })).toBe('rate_limited');
		expect(authErrorCode({ status: 429 })).toBe('rate_limited');
		expect(authErrorCode({ code: 'something_new' })).toBe('generic');
	});
});
