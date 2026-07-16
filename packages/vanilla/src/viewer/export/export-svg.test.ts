import type { PptxData, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { exportAllSlidesToSvg, exportSlideToSvg } from './export-svg';

const chartSlide: PptxSlide = {
	id: 'slide-1',
	rId: 'rId1',
	slideNumber: 1,
	elements: [
		{
			id: 'chart-1',
			type: 'chart',
			x: 20,
			y: 20,
			width: 400,
			height: 240,
			chartData: {
				chartType: 'bar',
				categories: ['Q1', 'Q2'],
				series: [{ name: 'Revenue', values: [12, 18] }],
			},
		},
	],
};

describe('svg export', () => {
	it('exports rich chart structure through the core SVG exporter', () => {
		const svg = exportSlideToSvg(chartSlide, 960, 540);

		expect(svg).toContain('<svg');
		expect(svg).toContain('data-chart-mark="bar"');
		expect(svg).not.toContain('>Chart<');
	});

	it('exports all selected presentation slides', () => {
		const data: PptxData = { slides: [chartSlide], width: 960, height: 540 };

		expect(exportAllSlidesToSvg(data)).toHaveLength(1);
	});
});
