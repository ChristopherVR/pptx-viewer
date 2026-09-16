import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { chartAreaCornerRadius, chartAreaFill, plotAreaFill } from './chart-area-fill';

function chart(roundedCorners?: boolean): PptxChartData {
	return {
		chartType: 'bar',
		categories: [],
		series: [],
		...(roundedCorners !== undefined ? { roundedCorners } : {}),
	} as PptxChartData;
}

describe('chartAreaCornerRadius', () => {
	it('returns a corner radius when c:chartSpace/c:roundedCorners is set', () => {
		expect(chartAreaCornerRadius(chart(true))).toBeGreaterThan(0);
	});

	it('returns undefined (square corners) when roundedCorners is false or absent', () => {
		expect(chartAreaCornerRadius(chart(false))).toBeUndefined();
		expect(chartAreaCornerRadius(chart())).toBeUndefined();
		expect(chartAreaCornerRadius(undefined)).toBeUndefined();
	});
});

describe('chartAreaFill', () => {
	// Real-world repro: a chart whose `c:chartSpace` has NO `c:spPr` at all (the
	// common case: only a deliberately-styled chart writes one). PowerPoint's
	// own export of such a chart shows no fill anywhere, transparent like an
	// explicit `<a:noFill/>`. The bindings used to paint a synthetic
	// `#0f172a11` wash in this case, boxing every plain chart in a grey panel
	// that is not in the source.
	it('is transparent (undefined) when the chart records no chartAreaFill at all', () => {
		expect(chartAreaFill(chart())).toBeUndefined();
	});

	it('is transparent (undefined) when the source declared an explicit noFill', () => {
		expect(chartAreaFill({ ...chart(), style: { chartAreaFill: 'none' } })).toBeUndefined();
	});

	it('honours an explicit authored fill colour', () => {
		expect(chartAreaFill({ ...chart(), style: { chartAreaFill: '#ff0000' } })).toBe('#ff0000');
	});

	it('is transparent (undefined) for a chart with no style block at all', () => {
		expect(chartAreaFill(undefined)).toBeUndefined();
	});
});

describe('plotAreaFill', () => {
	it('is transparent (undefined) when the chart records no plotAreaFill', () => {
		expect(plotAreaFill(chart())).toBeUndefined();
	});

	it('honours an explicit authored fill colour', () => {
		expect(plotAreaFill({ ...chart(), style: { plotAreaFill: '#00ff00' } })).toBe('#00ff00');
	});
});
