import { fail, redirect } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import {
	authErrorCode,
	Credentials,
	EmailOnly,
	safeNext,
	setLocaleCookie,
	type AuthErrorCode
} from '#lib/server/auth.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => ({
	next: safeNext(url.searchParams.get('next')),
	linkError: url.searchParams.get('error') === 'link'
});

const field = (form: FormData, name: string) => String(form.get(name) ?? '').trim();

export const actions: Actions = {
	password: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const email = field(form, 'email');
		const next = safeNext(field(form, 'next'));
		const parsed = Credentials.safeParse({ email, password: form.get('password') });
		if (!parsed.success) {
			return fail(400, { email, error: 'invalid_credentials' as AuthErrorCode });
		}

		const { data, error } = await locals.supabase.auth.signInWithPassword(parsed.data);
		if (error)
			return fail(error.status === 429 ? 429 : 400, { email, error: authErrorCode(error) });

		// Use the language saved in the profile on this device too.
		const { data: profile } = await locals.supabase
			.from('profiles')
			.select('locale')
			.eq('id', data.user.id)
			.maybeSingle();
		setLocaleCookie(cookies, profile?.locale);

		redirect(303, next);
	},

	magic: async ({ request, locals, url }) => {
		const form = await request.formData();
		const email = field(form, 'email');
		const next = safeNext(field(form, 'next'));
		const parsed = EmailOnly.safeParse({ email });
		if (!parsed.success) return fail(400, { email, error: 'invalid_email' as AuthErrorCode });

		const callback = new URL('/auth/callback', url.origin);
		callback.searchParams.set('next', next);
		const { error } = await locals.supabase.auth.signInWithOtp({
			email: parsed.data.email,
			options: {
				emailRedirectTo: callback.href,
				// A magic link can also create the account; the trigger stores the language.
				shouldCreateUser: true,
				data: { locale: getLocale() }
			}
		});
		if (error)
			return fail(error.status === 429 ? 429 : 400, { email, error: authErrorCode(error) });

		return { sent: true as const, email: parsed.data.email };
	}
};
