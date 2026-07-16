import type { ChartPptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { exportSlideToSvg } from './export-svg';

export function richChartSlide(): PptxSlide {
	const chart: ChartPptxElement = {
		id: 'chart-1',
		type: 'chart',
		x: 20,
		y: 20,
		width: 400,
		height: 240,
		chartData: {
			chartType: 'bar',
			title: 'Quarterly revenue',
			categories: ['Q1', 'Q2'],
			series: [{ name: 'Revenue', values: [12, 18], color: '#123456' }],
		},
	};
	return {
		id: 'slide-1',
		rId: 'rId1',
		slideNumber: 1,
		elements: [chart],
	};
}

describe('angular SVG export', () => {
	it('uses core rich chart geometry instead of a chart placeholder', () => {
		const svg = exportSlideToSvg(richChartSlide(), 960, 540);

		expect(svg).toContain('data-pptx-element="chart"');
		expect(svg).toContain('data-chart-mark="bar"');
		expect(svg).toContain('fill="#123456"');
		expect(svg).toContain('Quarterly revenue');
		expect(svg).not.toContain('>chart</text>');
	});
});
