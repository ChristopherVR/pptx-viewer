import { describe, expect, it } from 'vitest';

import type { PptxChartData, PptxChartType } from '../types';
import { canGenerateChartEx } from './chart-cx-generator';

describe('canGenerateChartEx', () => {
	it('covers every supported generated ChartEx chart type', () => {
		const chartExTypes: PptxChartType[] = [
			'funnel',
			'waterfall',
			'treemap',
			'sunburst',
			'boxWhisker',
			'histogram',
			'regionMap',
		];
		for (const chartType of chartExTypes) {
			const chartData: PptxChartData = { chartType, categories: [], series: [] };
			expect(canGenerateChartEx(chartData)).toBeTruthy();
		}
	});

	it('does not route classic charts through the ChartEx writer', () => {
		const chartData: PptxChartData = { chartType: 'bar', categories: [], series: [] };
		expect(canGenerateChartEx(chartData)).toBeFalsy();
	});
});
