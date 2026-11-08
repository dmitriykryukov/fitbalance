import { redirect } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import { setLocaleCookie } from '#lib/server/auth.js';
import { requireProfile } from '#lib/server/session.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies, depends }) => {
	depends('app:profile');
	const profile = await requireProfile({ locals });
	const user = (await locals.getUser())!;
	if (!profile.onboarded_at) redirect(303, '/onboarding');

	// Language changed on another device: use it from the next page load.
	if (profile.locale !== getLocale()) setLocaleCookie(cookies, profile.locale);

	return { profile, email: user.email };
};
