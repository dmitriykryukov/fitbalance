import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Phase 1 sends signed-out visitors to /login instead.
export const load: PageServerLoad = () => {
	redirect(307, '/app');
};
