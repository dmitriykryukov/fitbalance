/** Error codes shared by the server and the browser client (API_SPEC.md). */
export const ERROR_STATUS = {
	UNAUTHENTICATED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	VALIDATION_ERROR: 422,
	RATE_LIMITED: 429,
	AI_REFUSED: 422,
	AI_PROVIDER_ERROR: 502,
	AI_INVALID_RESPONSE: 502,
	INTERNAL_ERROR: 500
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export type ApiErrorBody = {
	code: ErrorCode;
	message: string;
	/** Field path ("items.1.grams") → problem. Only for VALIDATION_ERROR. */
	fields?: Record<string, string>;
	retry_after_seconds?: number;
};

export type ApiEnvelope<T> = { data: T; error: null } | { data: null; error: ApiErrorBody };
