import { describe, expect, it } from 'vitest';

import {
	buildSurfaceLegend,
	buildSurfaceValueBands,
	surfaceBandColorAt,
} from './chart-surface-legend';
import type { ValueRange } from './chart-view-model-scale';

describe('buildSurfaceValueBands', () => {
	it('divides the range into majorUnit-wide bands (COM: 0-5 by 0.5 = 10 bands)', () => {
		const range: ValueRange = { min: 0, max: 5, span: 5, majorUnit: 0.5 };
		const bands = buildSurfaceValueBands(range, undefined);
		expect(bands).toHaveLength(10);
		expect(bands[0]).toMatchObject({ min: 0, max: 0.5 });
		expect(bands[9]).toMatchObject({ min: 4.5, max: 5 });
	});

	it('divides into a coarser step for a different majorUnit (COM: 0-5 by 1 = 5 bands)', () => {
		const range: ValueRange = { min: 0, max: 5, span: 5, majorUnit: 1 };
		const bands = buildSurfaceValueBands(range, undefined);
		expect(bands).toHaveLength(5);
	});

	it('uses authored bandFmts colours over the continuous ramp', () => {
		const range: ValueRange = { min: 0, max: 5, span: 5, majorUnit: 2.5 };
		const bands = buildSurfaceValueBands(range, [
			{ index: 0, spPr: { fillColor: '#FF0000' } },
			{ index: 1, spPr: { fillColor: '#00FF00' } },
		]);
		expect(bands).toHaveLength(2);
		expect(bands[0].color).toBe('#FF0000');
		expect(bands[1].color).toBe('#00FF00');
	});

	it('does not throw or produce inverted bands for a flat (no-span) range', () => {
		const range: ValueRange = { min: 0, max: 0, span: 0 };
		const bands = buildSurfaceValueBands(range, undefined);
		expect(bands.length).toBeGreaterThan(0);
		for (const band of bands) {
			expect(band.max).toBeGreaterThanOrEqual(band.min);
		}
	});
});

describe('buildSurfaceLegend', () => {
	it('labels each entry as a "min-max" range, never a series name', () => {
		const range: ValueRange = { min: 0, max: 5, span: 5, majorUnit: 2.5 };
		const bands = buildSurfaceValueBands(range, undefined);
		const { legend } = buildSurfaceLegend(bands, 400, 'b', 300, 20);
		expect(legend).toHaveLength(bands.length);
		expect(legend[0].label).toBe('0-2.5');
		expect(legend[1].label).toBe('2.5-5');
	});

	it('positions the legend the same way a series legend would for the same side', () => {
		const range: ValueRange = { min: 0, max: 5, span: 5, majorUnit: 2.5 };
		const bands = buildSurfaceValueBands(range, undefined);
		const right = buildSurfaceLegend(bands, 400, 'r', 300, 20);
		expect(right.legendAnchor).toBe('start');
		expect(right.legendX).toBe(400 - 75);
		expect(right.legendY).toBe(20);
	});
});

describe('surfaceBandColorAt', () => {
	it('falls back to the continuous ramp when there are no bands', () => {
		expect(surfaceBandColorAt([], 0.5)).toMatch(/^rgb\(/u);
	});

	it('buckets t into the matching equal-width band', () => {
		const range: ValueRange = { min: 0, max: 10, span: 10, majorUnit: 5 };
		const bands = buildSurfaceValueBands(range, [
			{ index: 0, spPr: { fillColor: '#111111' } },
			{ index: 1, spPr: { fillColor: '#222222' } },
		]);
		expect(surfaceBandColorAt(bands, 0.1)).toBe('#111111');
		expect(surfaceBandColorAt(bands, 0.9)).toBe('#222222');
	});

	it('clamps t=1 into the last band rather than overflowing', () => {
		const range: ValueRange = { min: 0, max: 10, span: 10, majorUnit: 5 };
		const bands = buildSurfaceValueBands(range, [
			{ index: 0, spPr: { fillColor: '#111111' } },
			{ index: 1, spPr: { fillColor: '#222222' } },
		]);
		expect(surfaceBandColorAt(bands, 1)).toBe('#222222');
	});
});
