import type { PptxData, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { exportSlideToSvg as exportFromPackageEntry } from '../index';
import {
	exportAllSlidesToSvg,
	exportAllSlidesToSvgBlobs,
	exportSlideToSvg,
	exportSlideToSvgBlob,
} from './export-svg';
import { exportSlideToSvg as exportFromViewerEntry } from './index';

function chartSlide(id: string): PptxSlide {
	return {
		id,
		rId: `r-${id}`,
		slideNumber: 1,
		elements: [
			{
				type: 'chart',
				id: `chart-${id}`,
				x: 10,
				y: 10,
				width: 400,
				height: 240,
				chartData: {
					chartType: 'line',
					title: `Chart ${id}`,
					categories: ['Q1', 'Q2'],
					series: [{ name: 'Revenue', values: [12, 18], color: '#336699' }],
				},
			},
		],
	};
}

describe('vue SVG export API', () => {
	it('is exposed from the viewer and package entry points', () => {
		expect(exportFromViewerEntry).toBe(exportSlideToSvg);
		expect(exportFromPackageEntry).toBe(exportSlideToSvg);
	});

	it('delegates rich chart rendering to the core SvgExporter', () => {
		const svg = exportSlideToSvg(chartSlide('one'), 960, 540);

		expect(svg).toContain('data-pptx-element="chart"');
		expect(svg).toContain('data-chart-mark="line"');
		expect(svg).toContain('stroke="#336699"');
		expect(svg).not.toContain('>chart</text>');
	});

	it('returns SVG blobs with the expected MIME type', async () => {
		const blob = exportSlideToSvgBlob(chartSlide('one'), 960, 540);

		expect(blob.type).toBe('image/svg+xml;charset=utf-8');
		await expect(blob.text()).resolves.toContain('data-chart-mark="line"');
	});

	it('exports selected slides and blob variants', () => {
		const data: PptxData = {
			width: 960,
			height: 540,
			slides: [chartSlide('one'), chartSlide('two')],
		};
		const svgs = exportAllSlidesToSvg(data, { slideIndices: [1] });
		const blobs = exportAllSlidesToSvgBlobs(data, { slideIndices: [1] });

		expect(svgs).toHaveLength(1);
		expect(svgs[0]).toContain('Chart two');
		expect(blobs).toHaveLength(1);
		expect(blobs[0].type).toBe('image/svg+xml;charset=utf-8');
	});
});
