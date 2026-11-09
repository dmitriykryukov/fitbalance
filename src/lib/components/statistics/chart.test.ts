import { describe, expect, it } from 'vitest';
import { niceStep, runs, yScale } from './chart.js';

describe('chart helpers', () => {
	it('picks nice steps', () => {
		expect(niceStep(2500)).toBe(1000);
		expect(niceStep(6)).toBe(2);
		expect(niceStep(0.9)).toBe(0.5);
	});

	it('covers the data with clean ticks', () => {
		expect(yScale([1800, 2200, 2000], true)).toEqual({
			min: 0,
			max: 3000,
			ticks: [0, 1000, 2000, 3000]
		});
		const body = yScale([82, 81.2, 81], false);
		expect(body.min).toBeLessThanOrEqual(81);
		expect(body.max).toBeGreaterThanOrEqual(82);
	});

	it('breaks lines at missing days', () => {
		expect(runs([1, null, 2, 3, null, null, 4])).toEqual([[0], [2, 3], [6]]);
		expect(runs([null, null])).toEqual([]);
	});
});
