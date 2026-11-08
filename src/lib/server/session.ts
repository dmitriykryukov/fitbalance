import { redirect, type RequestEvent } from '@sveltejs/kit';
import { getProfile, type Profile } from './services/profile.js';
import { ApiError } from './api.js';

/**
 * Profile of the signed-in user for page loads. If the account was deleted
 * while this browser still holds a valid token, the profile is gone: sign
 * out locally and start again at /login instead of showing an error page.
 */
export async function requireProfile(event: Pick<RequestEvent, 'locals'>): Promise<Profile> {
	const user = await event.locals.getUser();
	if (!user) redirect(303, '/login');
	try {
		return await getProfile(event.locals.supabase, user.id);
	} catch (error) {
		if (error instanceof ApiError && error.code === 'NOT_FOUND') {
			await event.locals.supabase.auth.signOut({ scope: 'local' });
			redirect(303, '/login');
		}
		throw error;
	}
}
