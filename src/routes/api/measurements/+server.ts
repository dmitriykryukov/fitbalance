import { authed, ok, parseBody, parseQuery } from '#lib/server/api.js';
import { MeasurementCreate, MeasurementsQuery } from '#lib/schemas/profile.js';
import {
	assertNotFuture,
	createMeasurement,
	listMeasurements
} from '#lib/server/services/measurements.js';
import { getProfile, profileToday } from '#lib/server/services/profile.js';
import type { RequestHandler } from './$types';

/** Measurements in `?from=&to=` (inclusive), newest first. */
export const GET: RequestHandler = authed(async ({ locals, user, url }) => {
	const range = parseQuery(url, MeasurementsQuery);
	return ok({ measurements: await listMeasurements(locals.supabase, user.id, range) });
});

export const POST: RequestHandler = authed(async ({ locals, user, request }) => {
	const input = await parseBody(request, MeasurementCreate);
	assertNotFuture(input.local_date, profileToday(await getProfile(locals.supabase, user.id)));
	return ok({ measurement: await createMeasurement(locals.supabase, user.id, input) }, 201);
});
