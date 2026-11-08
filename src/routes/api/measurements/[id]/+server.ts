import { authed, noContent, ok, parseBody, routeId } from '#lib/server/api.js';
import { MeasurementPatch } from '#lib/schemas/profile.js';
import {
	assertNotFuture,
	deleteMeasurement,
	updateMeasurement
} from '#lib/server/services/measurements.js';
import { getProfile, profileToday } from '#lib/server/services/profile.js';
import type { RequestHandler } from './$types';

type Event = Parameters<RequestHandler>[0];

export const PATCH: RequestHandler = authed<Event>(async ({ locals, user, request, params }) => {
	const id = routeId(params.id);
	const patch = await parseBody(request, MeasurementPatch);
	if (patch.local_date) {
		assertNotFuture(patch.local_date, profileToday(await getProfile(locals.supabase, user.id)));
	}
	return ok({ measurement: await updateMeasurement(locals.supabase, user.id, id, patch) });
});

export const DELETE: RequestHandler = authed<Event>(async ({ locals, user, params }) => {
	await deleteMeasurement(locals.supabase, user.id, routeId(params.id));
	return noContent();
});
