import { describe, it, expect } from 'vitest';

import { niceAxisStep, niceValueAxisBounds } from './chart-axis-nice';

describe('niceAxisStep', () => {
	it('rounds up to the 1 / 2 / 2.5 / 5 ladder', () => {
		expect(niceAxisStep(0.136)).toBeCloseTo(0.2, 10);
		expect(niceAxisStep(0.1)).toBeCloseTo(0.1, 10);
		expect(niceAxisStep(0.11)).toBeCloseTo(0.2, 10);
		expect(niceAxisStep(2.1)).toBeCloseTo(2.5, 10);
		expect(niceAxisStep(2.6)).toBeCloseTo(5, 10);
		expect(niceAxisStep(6)).toBeCloseTo(10, 10);
		expect(niceAxisStep(1234)).toBeCloseTo(2000, 10);
	});

	it('is defensive about junk input', () => {
		expect(niceAxisStep(0)).toBe(1);
		expect(niceAxisStep(-5)).toBe(1);
		expect(niceAxisStep(Number.NaN)).toBe(1);
	});
});

describe('niceValueAxisBounds', () => {
	/**
	 * The three charts in the issue #132 deck. PowerPoint labels every one of
	 * them `0% 20% 40% 60%`; the viewer ran the axis to the data maximum and
	 * divided by five, giving `0% 10% 21% 31% 42% 52%`.
	 */
	it.each([
		['slide 5 education', 0.04, 0.52],
		['slide 6 age', 0.07, 0.47],
		['slide 6 tenure', 0.1, 0.39],
	])('matches PowerPoint on the %s chart', (_name, dataMin, dataMax) => {
		const bounds = niceValueAxisBounds(dataMin, dataMax);
		expect(bounds.min).toBe(0);
		expect(bounds.max).toBeCloseTo(0.6, 10);
		expect(bounds.majorUnit).toBeCloseTo(0.2, 10);
	});

	it('anchors all-positive data at zero', () => {
		const bounds = niceValueAxisBounds(12, 87);
		expect(bounds.min).toBe(0);
		expect(bounds.max).toBeGreaterThanOrEqual(87);
	});

	it('lifts the floor when the data sits in a narrow high band', () => {
		// 95 is well above 5/6 of 100, so a zero-anchored axis would flatten the
		// difference between the bars into nothing.
		const bounds = niceValueAxisBounds(95, 100);
		expect(bounds.min).toBeGreaterThan(0);
		expect(bounds.max).toBeGreaterThanOrEqual(100);
	});

	it('mirrors the rule for all-negative data', () => {
		const bounds = niceValueAxisBounds(-87, -12);
		expect(bounds.max).toBe(0);
		expect(bounds.min).toBeLessThanOrEqual(-87);
	});

	it('keeps both ends data-driven when the data straddles zero', () => {
		const bounds = niceValueAxisBounds(-30, 70);
		expect(bounds.min).toBeLessThanOrEqual(-30);
		expect(bounds.max).toBeGreaterThanOrEqual(70);
	});

	it('always spans a whole number of major units', () => {
		for (const [low, high] of [
			[0, 1],
			[0.04, 0.52],
			[3, 3000],
			[-12, 44],
			[-500, -3],
			[0.0001, 0.0007],
		] as const) {
			const { min, max, majorUnit } = niceValueAxisBounds(low, high);
			const steps = (max - min) / majorUnit;
			expect(Math.abs(steps - Math.round(steps)), `${low}..${high}`).toBeLessThan(1e-6);
			expect(max, `${low}..${high}`).toBeGreaterThan(min);
		}
	});

	it('brackets flat data instead of collapsing the axis', () => {
		expect(niceValueAxisBounds(0, 0)).toStrictEqual({ min: 0, max: 1, majorUnit: 0.25 });
		const positive = niceValueAxisBounds(40, 40);
		expect(positive.min).toBe(0);
		expect(positive.max).toBeGreaterThanOrEqual(40);
		const negative = niceValueAxisBounds(-40, -40);
		expect(negative.max).toBe(0);
		expect(negative.min).toBeLessThanOrEqual(-40);
	});

	it('honours a requested interval count', () => {
		const coarse = niceValueAxisBounds(0, 100, 2);
		const fine = niceValueAxisBounds(0, 100, 10);
		expect(coarse.majorUnit).toBeGreaterThan(fine.majorUnit);
	});

	it('is defensive about junk input', () => {
		expect(niceValueAxisBounds(Number.NaN, 5)).toStrictEqual({ min: 0, max: 1, majorUnit: 0.5 });
	});
});
