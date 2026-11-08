import { ApiClientError } from '#lib/api/client.js';
import { m } from '#lib/paraglide/messages.js';

/**
 * Parses a number typed by the user. Accepts "72,5" as well as "72.5".
 * Returns null for an empty field and undefined when the text is not a number.
 */
export function parseDecimal(input: string | number | null | undefined): number | null | undefined {
	if (input === null || input === undefined) return null;
	const text = String(input).trim().replace(/\s/g, '').replace(',', '.');
	if (text === '') return null;
	if (!/^-?\d+(\.\d+)?$/.test(text)) return undefined;
	return Number(text);
}

/** Shows a stored number in an input (no trailing zeros). */
export function numberToInput(value: number | null | undefined): string {
	return value === null || value === undefined ? '' : String(value);
}

export type FieldErrors = Record<string, string>;

/**
 * Turns a failed API call into page-level and per-field messages. Field
 * details from the server are not shown verbatim (they are English).
 */
export function apiErrorToForm(error: unknown): { message: string; fields: FieldErrors } {
	if (error instanceof ApiClientError) {
		const fields: FieldErrors = {};
		for (const key of Object.keys(error.fields ?? {})) {
			fields[key.split('.')[0]] = m.field_invalid();
		}
		return { message: error.message || m.error_generic(), fields };
	}
	return { message: m.error_generic(), fields: {} };
}
