import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	signout: async ({ locals }) => {
		// Ends this device's session only; other devices stay signed in.
		await locals.supabase.auth.signOut({ scope: 'local' });
		redirect(303, '/login');
	}
};
