import type { RequestEvent } from '@sveltejs/kit';
import type { z } from 'zod';
import { ERROR_STATUS, type ApiErrorBody, type ErrorCode } from '#lib/api/errors.js';
import { m } from '#lib/paraglide/messages.js';
import type { AuthUser } from './supabase.js';

/** Throw from a handler or service to return a specific error envelope. */
export class ApiError extends Error {
	constructor(
		readonly code: ErrorCode,
		message: string,
		readonly fields?: Record<string, string>,
		readonly retryAfterSeconds?: number
	) {
		super(message);
		this.name = 'ApiError';
	}
}

export function ok<T>(data: T, status = 200): Response {
	return Response.json({ data, error: null }, { status });
}

export function noContent(): Response {
	return new Response(null, { status: 204 });
}

export function errorResponse(err: ApiError): Response {
	const body: ApiErrorBody = { code: err.code, message: err.message };
	if (err.fields) body.fields = err.fields;
	const headers = new Headers();
	if (err.retryAfterSeconds !== undefined) {
		body.retry_after_seconds = err.retryAfterSeconds;
		headers.set('retry-after', String(err.retryAfterSeconds));
	}
	return Response.json({ data: null, error: body }, { status: ERROR_STATUS[err.code], headers });
}

/** Zod issues → { "items.1.grams": "Too small: expected number to be >0" }. */
export function zodFields(error: z.ZodError): Record<string, string> {
	const fields: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = issue.path.map(String).join('.') || '_';
		fields[key] ??= issue.message;
	}
	return fields;
}

function validate<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
	const result = schema.safeParse(value);
	if (!result.success) {
		throw new ApiError('VALIDATION_ERROR', m.error_validation(), zodFields(result.error));
	}
	return result.data;
}

/** Parses and validates a JSON request body. Rejects other content types. */
export async function parseBody<S extends z.ZodType>(
	request: Request,
	schema: S
): Promise<z.output<S>> {
	const type = request.headers.get('content-type') ?? '';
	if (!type.toLowerCase().startsWith('application/json')) {
		throw new ApiError('VALIDATION_ERROR', m.error_validation(), {
			_: 'Expected application/json'
		});
	}
	let json: unknown;
	try {
		json = await request.json();
	} catch {
		throw new ApiError('VALIDATION_ERROR', m.error_validation(), { _: 'Malformed JSON' });
	}
	return validate(schema, json);
}

/** Validates query parameters (all values arrive as strings; use z.coerce where needed). */
export function parseQuery<S extends z.ZodType>(url: URL, schema: S): z.output<S> {
	return validate(schema, Object.fromEntries(url.searchParams));
}

type AuthedEvent<E extends RequestEvent> = E & { user: AuthUser };

/**
 * Wraps a `+server.ts` handler: requires a verified user, and turns thrown
 * errors into the API envelope. Unexpected errors are logged server-side and
 * returned as INTERNAL_ERROR without details.
 */
export function authed<E extends RequestEvent>(
	handler: (event: AuthedEvent<E>) => Promise<Response> | Response
): (event: E) => Promise<Response> {
	return async (event) => {
		try {
			const user = await event.locals.getUser();
			if (!user) throw new ApiError('UNAUTHENTICATED', m.error_unauthenticated());
			return await handler(Object.assign(event, { user }));
		} catch (err) {
			if (err instanceof ApiError) return errorResponse(err);
			console.error(`[api] ${event.request.method} ${event.url.pathname}`, err);
			return errorResponse(new ApiError('INTERNAL_ERROR', m.error_generic()));
		}
	};
}
