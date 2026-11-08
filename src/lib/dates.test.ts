import { describe, expect, it } from 'vitest';
import {
	addDays,
	ageOn,
	daysBetween,
	isValidTimeZone,
	localDate,
	localHour,
	localTime,
	timeZoneOffsetMinutes,
	zonedIso
} from './dates.js';

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

describe('time zones', () => {
	it('offsets', () => {
		expect(timeZoneOffsetMinutes('Europe/Berlin', new Date('2026-01-15T12:00:00Z'))).toBe(60);
		expect(timeZoneOffsetMinutes('Europe/Berlin', new Date('2026-07-15T12:00:00Z'))).toBe(120);
		expect(timeZoneOffsetMinutes('America/New_York', new Date('2026-11-07T12:00:00Z'))).toBe(-300);
		expect(timeZoneOffsetMinutes('UTC', new Date())).toBe(0);
	});

	it('local wall-clock time', () => {
		const at = new Date('2026-11-07T23:30:00Z');
		expect(localTime('Europe/Moscow', at)).toBe('02:30');
		expect(localHour('Europe/Moscow', at)).toBe(2);
		expect(localTime('America/Los_Angeles', at)).toBe('15:30');
	});

	it('zonedIso round-trips through Date', () => {
		const iso = zonedIso('2026-11-07', '08:15', 'Europe/Berlin');
		expect(iso).toBe('2026-11-07T08:15:00+01:00');
		expect(new Date(iso).toISOString()).toBe('2026-11-07T07:15:00.000Z');
		expect(zonedIso('2026-07-01', '23:59', 'America/New_York')).toBe('2026-07-01T23:59:00-04:00');
		expect(zonedIso('2026-03-10', '12:00', 'Asia/Kolkata')).toBe('2026-03-10T12:00:00+05:30');
	});

	it('handles DST changes', () => {
		// Berlin 2026-03-29 02:30 does not exist (clocks jump 02:00 → 03:00).
		expect(new Date(zonedIso('2026-03-29', '02:30', 'Europe/Berlin')).toISOString()).toBe(
			'2026-03-29T01:30:00.000Z'
		);
		expect(zonedIso('2026-10-25', '12:00', 'Europe/Berlin')).toBe('2026-10-25T12:00:00+01:00');
	});
});
