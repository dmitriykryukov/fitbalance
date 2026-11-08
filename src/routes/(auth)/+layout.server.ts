import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/** Signed-in users skip the login and sign-up pages. */
export const load: LayoutServerLoad = async ({ locals }) => {
	if (await locals.getUser()) redirect(303, '/app');
};
