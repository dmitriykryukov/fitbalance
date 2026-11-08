import { describe, expect, it } from 'vitest';
import { numberToInput, parseDecimal } from './forms.js';

describe('parseDecimal', () => {
	it('accepts comma and dot decimals', () => {
		expect(parseDecimal('72,5')).toBe(72.5);
		expect(parseDecimal(' 72.5 ')).toBe(72.5);
		expect(parseDecimal('1 850')).toBe(1850);
	});

	it('separates empty from invalid', () => {
		expect(parseDecimal('')).toBeNull();
		expect(parseDecimal(null)).toBeNull();
		expect(parseDecimal('abc')).toBeUndefined();
		expect(parseDecimal('7..2')).toBeUndefined();
	});

	it('round-trips numbers to inputs', () => {
		expect(numberToInput(72.5)).toBe('72.5');
		expect(numberToInput(null)).toBe('');
	});
});
