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
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import {
	ensureBarFacePicturePixelSampled,
	getCachedBarFacePicturePixelColor,
	resetBarFacePicturePixelCacheForTests,
	resolveUntargetedBarFaceFill,
} from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ChartView from './ChartView.svelte';

const IMAGE_URL = 'data:image/png;base64,svelte-sample-test-image';
const SAMPLED_COLOR = '#0d0d0d';

let mounted: ReturnType<typeof mount> | undefined;

beforeEach(() => {
	resetBarFacePicturePixelCacheForTests();
});

afterEach(() => {
	if (mounted) {
		void unmount(mounted);
		mounted = undefined;
	}
	document.body.innerHTML = '';
	resetBarFacePicturePixelCacheForTests();
});

function render(element: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	mounted = mount(ChartView, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 0 },
	});
	flushSync();
	return target;
}

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
	};
	return {
		id: 'ch_bar3d_pic',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as PptxElement;
}

describe('chartView - bar3D untargeted-face picture colour sample', () => {
	it('paints the untargeted side/end faces from the resolved point/series colour before any sample is cached', () => {
		const target = render(bar3DPictureElement());
		const fills = [...target.querySelectorAll('polygon')].map((p) => p.getAttribute('fill'));
		expect(fills).not.toContain(resolveUntargetedBarFaceFill('side', SAMPLED_COLOR));
		expect(fills).not.toContain(resolveUntargetedBarFaceFill('end', SAMPLED_COLOR));
	});

	it('paints the untargeted side/end faces from the sampled colour once it is cached', async () => {
		ensureBarFacePicturePixelSampled(IMAGE_URL, vi.fn().mockResolvedValue(SAMPLED_COLOR));
		await vi.waitFor(() => {
			expect(getCachedBarFacePicturePixelColor(IMAGE_URL)).toBe(SAMPLED_COLOR);
		});

		const target = render(bar3DPictureElement());
		const fills = [...target.querySelectorAll('polygon')].map((p) => p.getAttribute('fill'));
		expect(fills).toContain(resolveUntargetedBarFaceFill('side', SAMPLED_COLOR));
		expect(fills).toContain(resolveUntargetedBarFaceFill('end', SAMPLED_COLOR));
	});
});
