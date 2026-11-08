import { m } from '#lib/paraglide/messages.js';
import { ApiError } from './api.js';

type DbError = { code?: string; message: string; details?: string | null };

/** Postgres/PostgREST codes that mean "the input was not acceptable". */
const VALIDATION_CODES = new Set([
	'23502', // not_null_violation
	'23505', // unique_violation
	'23514', // check_violation
	'22003', // numeric_value_out_of_range
	'22007', // invalid_datetime_format
	'22008', // datetime_field_overflow
	'22023', // invalid_parameter_value (e.g. unknown time zone)
	'22P02' // invalid_text_representation
]);

/**
 * Maps a Supabase error to an ApiError. Unknown errors stay plain Errors so
 * `authed()` logs them and returns INTERNAL_ERROR without details.
 */
export function dbError(error: DbError): Error {
	if (error.code && VALIDATION_CODES.has(error.code)) {
		return new ApiError('VALIDATION_ERROR', m.error_validation());
	}
	if (error.code === 'PGRST116') return new ApiError('NOT_FOUND', m.error_not_found());
	if (error.code === '42501') return new ApiError('FORBIDDEN', m.error_generic());
	return new Error(`Supabase error ${error.code ?? '?'}: ${error.message}`);
}

/** Unwraps `{ data, error }`, throwing a mapped error. */
export function unwrap<T>(result: { data: T; error: DbError | null }): T {
	if (result.error) throw dbError(result.error);
	return result.data;
}

/** Like `unwrap`, but a missing row becomes NOT_FOUND (RLS hides other users' rows). */
export function unwrapFound<T>(result: { data: T | null; error: DbError | null }): T {
	const data = unwrap(result);
	if (data === null) throw new ApiError('NOT_FOUND', m.error_not_found());
	return data;
}
