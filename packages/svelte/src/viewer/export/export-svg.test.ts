import type { PptxData, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	exportAllSlidesToSvg,
	exportAllSlidesToSvgBlobs,
	exportSlideToSvg,
	exportSlideToSvgBlob,
} from './export-svg';

function makeChartSlide(id = 'slide-1'): PptxSlide {
	return {
		id,
		elements: [
			{
				type: 'chart',
				id: 'chart-1',
				x: 10,
				y: 20,
				width: 400,
				height: 240,
				chartData: {
					chartType: 'bar',
					categories: ['Q1', 'Q2'],
					series: [{ name: 'Revenue', values: [12, 18], color: '#123456' }],
				},
			},
		],
	} as PptxSlide;
}

describe('svelte SVG export', () => {
	it('exports rich chart marks through the core SvgExporter', () => {
		const svg = exportSlideToSvg(makeChartSlide(), 960, 540);

		expect(svg).toContain('data-pptx-element="chart"');
		expect(svg).toContain('data-chart-mark="bar"');
		expect(svg).toContain('fill="#123456"');
	});

	it('provides single and multi-slide SVG blobs', async () => {
		const slide = makeChartSlide();
		const data = { width: 960, height: 540, slides: [slide] } as PptxData;
		const single = exportSlideToSvgBlob(slide, data.width, data.height);
		const all = exportAllSlidesToSvg(data);
		const blobs = exportAllSlidesToSvgBlobs(data);

		expect(single.type).toBe('image/svg+xml;charset=utf-8');
		await expect(single.text()).resolves.toBe(all[0]);
		expect(blobs).toHaveLength(1);
		expect(blobs[0]?.type).toBe('image/svg+xml;charset=utf-8');
	});
});
