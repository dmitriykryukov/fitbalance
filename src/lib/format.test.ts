import { describe, expect, it } from 'vitest';
import { formatLongDate, formatNumber } from './format.js';

describe('formatNumber', () => {
	it('uses English grouping', () => {
		expect(formatNumber(1250, 0, 'en')).toBe('1,250');
	});

	it('uses Russian grouping (non-breaking space)', () => {
		expect(formatNumber(1250, 0, 'ru')).toMatch(/^1\s250$/u);
	});

	it('limits fraction digits', () => {
		expect(formatNumber(72.456, 1, 'en')).toBe('72.5');
		expect(formatNumber(72.456, 1, 'ru')).toBe('72,5');
	});
});

describe('formatLongDate', () => {
	it('formats a calendar day without timezone drift', () => {
		expect(formatLongDate('2026-11-07', 'en')).toBe('Saturday, November 7');
		expect(formatLongDate('2026-11-07', 'ru')).toBe('суббота, 7 ноября');
	});
});
