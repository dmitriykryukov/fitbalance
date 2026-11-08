import { getProfileOverview } from '#lib/server/services/overview.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent, depends }) => {
	depends('app:profile');
	// The layout resolves (or redirects) the profile first.
	const { profile } = await parent();
	return { overview: await getProfileOverview(locals.supabase, profile) };
};
