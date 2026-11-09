/** Small helpers shared by the SVG charts. */

/** A "nice" step (1, 2, 2.5 or 5 × 10ⁿ) for about `count` gridlines over `span`. */
export function niceStep(span: number, count = 3): number {
	if (!(span > 0)) return 1;
	const raw = span / count;
	const power = 10 ** Math.floor(Math.log10(raw));
	const n = raw / power;
	const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
	return nice * power;
}

/** Y domain and gridline values covering `values`, optionally anchored at 0. */
export function yScale(values: number[], fromZero: boolean, count = 3) {
	const present = values.filter((v) => Number.isFinite(v));
	let min = present.length ? Math.min(...present) : 0;
	let max = present.length ? Math.max(...present) : 1;
	if (fromZero) min = Math.min(0, min);
	if (max === min) {
		max += fromZero ? 1 : 1;
		if (!fromZero) min -= 1;
	}
	const step = niceStep(max - min, count);
	const lo = Math.floor(min / step) * step;
	const hi = Math.ceil(max / step) * step;
	const ticks: number[] = [];
	for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
	return { min: lo, max: hi, ticks };
}

/** Splits values into runs of consecutive non-null indexes (gaps break a line). */
export function runs(values: (number | null)[]): number[][] {
	const out: number[][] = [];
	let current: number[] = [];
	values.forEach((v, i) => {
		if (v === null) {
			if (current.length) out.push(current);
			current = [];
		} else current.push(i);
	});
	if (current.length) out.push(current);
	return out;
}
