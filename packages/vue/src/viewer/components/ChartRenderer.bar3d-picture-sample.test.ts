/**
 * Regression test for the async first-pixel colour sample cache
 * (`chart-bar3d-face-picture-sample.ts`): once a picture's first pixel has
 * been decoded and cached, an untargeted bar3D extrusion face whose fill is
 * picture-only paints a colour derived from that SAMPLE, not the resolved
 * point/series colour - reproducing the COM-verified PowerPoint behaviour
 * documented on `resolveUntargetedBarFaceFill`. See the React sibling test
 * (`ChartElementView.bar3d-picture-sample.test.tsx`) for why the sample is
 * seeded before mounting rather than exercised live through this
 * environment's `Image`/`<canvas>` decode.
 */
import { mount } from '@vue/test-utils';
import type { ChartPptxElement, PptxChartData, PptxElement } from 'pptx-viewer-core';
import {
	ensureBarFacePicturePixelSampled,
	getCachedBarFacePicturePixelColor,
	resetBarFacePicturePixelCacheForTests,
	resolveUntargetedBarFaceFill,
} from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ChartRenderer from './ChartRenderer.vue';

const IMAGE_URL = 'data:image/png;base64,vue-sample-test-image';
const SAMPLED_COLOR = '#0b0b0b';

beforeEach(() => {
	resetBarFacePicturePixelCacheForTests();
});
afterEach(() => {
	resetBarFacePicturePixelCacheForTests();
});

function bar3DPictureElement(): PptxElement {
	const chartData: PptxChartData = {
		chartType: 'bar3D',
		categories: ['Q1'],
		series: [
			{
				name: 'A',
				values: [10],
				dataPoints: [
					{
						idx: 0,
						picture: {
							imageUrl: IMAGE_URL,
							applyToFront: true,
							applyToSides: false,
							applyToEnd: false,
						},
					},
				],
			},
		],
	} as PptxChartData;
	return {
		type: 'chart',
		id: 'ch_bar3d_pic',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as ChartPptxElement;
}

describe('chartRenderer - bar3D untargeted-face picture colour sample', () => {
	it('paints the untargeted side/end faces from the resolved point/series colour before any sample is cached', () => {
		const wrapper = mount(ChartRenderer, { props: { element: bar3DPictureElement(), zIndex: 1 } });
		const fills = wrapper.findAll('polygon').map((p) => p.attributes('fill'));
		expect(fills).not.toContain(resolveUntargetedBarFaceFill('side', SAMPLED_COLOR));
		expect(fills).not.toContain(resolveUntargetedBarFaceFill('end', SAMPLED_COLOR));
	});

	it('paints the untargeted side/end faces from the sampled colour once it is cached', async () => {
		ensureBarFacePicturePixelSampled(IMAGE_URL, vi.fn().mockResolvedValue(SAMPLED_COLOR));
		await vi.waitFor(() => {
			expect(getCachedBarFacePicturePixelColor(IMAGE_URL)).toBe(SAMPLED_COLOR);
		});

		const wrapper = mount(ChartRenderer, { props: { element: bar3DPictureElement(), zIndex: 1 } });
		const fills = wrapper.findAll('polygon').map((p) => p.attributes('fill'));
		expect(fills).toContain(resolveUntargetedBarFaceFill('side', SAMPLED_COLOR));
		expect(fills).toContain(resolveUntargetedBarFaceFill('end', SAMPLED_COLOR));
	});
});
