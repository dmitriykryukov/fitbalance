import { m } from '#lib/paraglide/messages.js';
import { ApiError, authed, noContent, ok, parseBody } from '#lib/server/api.js';
import { IdParam, MeasurementPatch } from '#lib/schemas/profile.js';
import {
	assertNotFuture,
	deleteMeasurement,
	updateMeasurement
} from '#lib/server/services/measurements.js';
import { getProfile, profileToday } from '#lib/server/services/profile.js';
import type { RequestHandler } from './$types';

type Event = Parameters<RequestHandler>[0];

/** A malformed ID can never match a row, so it is reported like a missing one. */
function measurementId(params: Event['params']): string {
	const result = IdParam.safeParse(params.id);
	if (!result.success) throw new ApiError('NOT_FOUND', m.error_not_found());
	return result.data;
}

export const PATCH: RequestHandler = authed<Event>(async ({ locals, user, request, params }) => {
	const id = measurementId(params);
	const patch = await parseBody(request, MeasurementPatch);
	if (patch.local_date) {
		assertNotFuture(patch.local_date, profileToday(await getProfile(locals.supabase, user.id)));
	}
	return ok({ measurement: await updateMeasurement(locals.supabase, user.id, id, patch) });
});

export const DELETE: RequestHandler = authed<Event>(async ({ locals, user, params }) => {
	await deleteMeasurement(locals.supabase, user.id, measurementId(params));
	return noContent();
});
