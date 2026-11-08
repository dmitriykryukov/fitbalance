import type { ApiEnvelope, ApiErrorBody, ErrorCode } from './errors.js';

/** Thrown by `api()` for any non-success response. */
export class ApiClientError extends Error {
	readonly code: ErrorCode;
	readonly status: number;
	readonly fields?: Record<string, string>;
	readonly retryAfterSeconds?: number;

	constructor(status: number, body: ApiErrorBody) {
		super(body.message);
		this.name = 'ApiClientError';
		this.status = status;
		this.code = body.code;
		this.fields = body.fields;
		this.retryAfterSeconds = body.retry_after_seconds;
	}
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Typed call to a FitBalance `/api` route. Returns `data` from the envelope,
 * or throws ApiClientError (network failures become INTERNAL_ERROR).
 */
export async function api<T>(
	method: Method,
	path: `/api/${string}`,
	body?: unknown,
	fetcher: typeof fetch = fetch
): Promise<T> {
	let response: Response;
	try {
		response = await fetcher(path, {
			method,
			headers: body === undefined ? undefined : { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		});
	} catch {
		throw new ApiClientError(0, { code: 'INTERNAL_ERROR', message: 'Network error' });
	}

	if (response.status === 204) return undefined as T;

	let envelope: ApiEnvelope<T>;
	try {
		envelope = await response.json();
	} catch {
		throw new ApiClientError(response.status, {
			code: 'INTERNAL_ERROR',
			message: `Unexpected response (${response.status})`
		});
	}

	if (envelope.error) throw new ApiClientError(response.status, envelope.error);
	return envelope.data;
}
