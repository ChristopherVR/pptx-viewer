import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { chartAreaCornerRadius } from './chart-area-fill';

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
