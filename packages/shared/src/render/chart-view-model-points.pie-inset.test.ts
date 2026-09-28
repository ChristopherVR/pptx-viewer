import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { computePieLayout, PIE_AUTO_INSET_PX } from './chart-view-model-points';

const data: PptxChartData = {
	chartType: 'pie',
	categories: ['a'],
	series: [{ name: 's', values: [1] }],
};

describe('computePieLayout automatic inset', () => {
	it('shrinks a small pie by up to about 8% and a large one by under 2%', () => {
		const small = computePieLayout(200, 200, data, false).outerR;
		const large = computePieLayout(1000, 1000, data, false).outerR;
		expect(small).toBeCloseTo(200 * 0.42 - PIE_AUTO_INSET_PX);
		expect(1 - small / (200 * 0.42)).toBeGreaterThan(0.06);
		expect(1 - small / (200 * 0.42)).toBeLessThan(0.09);
		expect(1 - large / (1000 * 0.42)).toBeLessThan(0.02);
	});
});
