import { describe, expect, it } from 'vitest';
import { addDays, ageOn, daysBetween, isValidTimeZone, localDate } from './dates.js';

describe('localDate', () => {
	const at = new Date('2026-11-07T23:30:00Z');

	it('returns the calendar date in the given time zone', () => {
		expect(localDate('UTC', at)).toBe('2026-11-07');
		expect(localDate('Europe/Moscow', at)).toBe('2026-11-08');
		expect(localDate('America/Los_Angeles', at)).toBe('2026-11-07');
	});
});

describe('isValidTimeZone', () => {
	it('accepts IANA names and rejects junk', () => {
		expect(isValidTimeZone('Europe/Berlin')).toBe(true);
		expect(isValidTimeZone('UTC')).toBe(true);
		expect(isValidTimeZone('Mars/Base')).toBe(false);
		expect(isValidTimeZone('')).toBe(false);
	});
});

describe('date arithmetic', () => {
	it('adds days across month and leap-year boundaries', () => {
		expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
		expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
		expect(daysBetween('2026-11-01', '2026-11-08')).toBe(7);
	});

	it('computes age in whole years', () => {
		expect(ageOn('1990-11-08', '2026-11-07')).toBe(35);
		expect(ageOn('1990-11-07', '2026-11-07')).toBe(36);
		expect(ageOn('2000-02-29', '2027-02-28')).toBe(26);
	});
});
