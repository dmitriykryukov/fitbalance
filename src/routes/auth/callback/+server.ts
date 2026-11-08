import { redirect } from '@sveltejs/kit';
import type { EmailOtpType } from '@supabase/supabase-js';
import { safeNext, setLocaleCookie } from '#lib/server/auth.js';
import type { RequestHandler } from './$types';

const OTP_TYPES = new Set<EmailOtpType>([
	'signup',
	'invite',
	'magiclink',
	'recovery',
	'email_change',
	'email'
]);

/**
 * Landing page for magic links and email confirmation. Supports both the PKCE
 * `?code=` flow (default email templates) and `?token_hash=&type=` links.
 */
export const GET: RequestHandler = async ({ url, locals, cookies }) => {
	const next = safeNext(url.searchParams.get('next'));
	const code = url.searchParams.get('code');
	const tokenHash = url.searchParams.get('token_hash');
	const type = url.searchParams.get('type') as EmailOtpType | null;

	let userId: string | null = null;
	if (code) {
		const { data, error } = await locals.supabase.auth.exchangeCodeForSession(code);
		if (!error) userId = data.user?.id ?? null;
	} else if (tokenHash && type && OTP_TYPES.has(type)) {
		const { data, error } = await locals.supabase.auth.verifyOtp({ token_hash: tokenHash, type });
		if (!error) userId = data.user?.id ?? null;
	}

	if (!userId) redirect(303, '/login?error=link');

	const { data: profile } = await locals.supabase
		.from('profiles')
		.select('locale')
		.eq('id', userId)
		.maybeSingle();
	setLocaleCookie(cookies, profile?.locale);

	redirect(303, next);
};
