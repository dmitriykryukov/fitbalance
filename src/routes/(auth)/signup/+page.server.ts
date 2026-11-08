import { fail, redirect } from '@sveltejs/kit';
import { getLocale, isLocale } from '#lib/paraglide/runtime.js';
import { authErrorCode, Credentials, type AuthErrorCode } from '#lib/server/auth.js';
import type { Actions } from './$types';

type Field = 'email' | 'password';

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const localeInput = form.get('locale');
		const locale = isLocale(localeInput) ? localeInput : getLocale();

		const parsed = Credentials.safeParse({ email, password: form.get('password') });
		if (!parsed.success) {
			const field = parsed.error.issues[0]?.path[0] as Field;
			const error: AuthErrorCode = field === 'password' ? 'weak_password' : 'invalid_email';
			return fail(400, { email, error });
		}

		const callback = new URL('/auth/callback', url.origin);
		callback.searchParams.set('next', '/onboarding');
		const { data, error } = await locals.supabase.auth.signUp({
			...parsed.data,
			options: { emailRedirectTo: callback.href, data: { locale } }
		});
		if (error)
			return fail(error.status === 429 ? 429 : 400, { email, error: authErrorCode(error) });

		// Projects without email confirmation return a session straight away.
		if (data.session) redirect(303, '/onboarding');

		// Same answer for new and already-registered emails (no account enumeration).
		return { sent: true as const, email: parsed.data.email };
	}
};
