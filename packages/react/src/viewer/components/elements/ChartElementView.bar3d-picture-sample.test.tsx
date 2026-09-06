// @vitest-environment happy-dom
/**
 * Regression test for the async first-pixel colour sample cache
 * (`chart-bar3d-face-picture-sample.ts`): once a picture's first pixel has
 * been decoded and cached, an untargeted bar3D extrusion face whose fill is
 * picture-only paints a colour derived from that SAMPLE, not the resolved
 * point/series colour - reproducing the COM-verified PowerPoint behaviour
 * documented on `resolveUntargetedBarFaceFill`.
 *
 * The sample is seeded BEFORE mounting (via a controlled sampler, bypassing
 * the real `Image`/`<canvas>` decode this environment cannot perform) so the
 * chart's very first render already resolves it from the cache: this proves
 * `ChartElementView`/`buildReactChartViewModel` correctly THREAD the shared
 * cache through, without depending on `happy-dom`'s `Image`/`canvas` timing
 * for the live "repaint after the async decode resolves" path (covered
 * DOM-free at the shared level, `chart-3d-depth.test.ts`).
 */
import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import {
	ensureBarFacePicturePixelSampled,
	getCachedBarFacePicturePixelColor,
	resetBarFacePicturePixelCacheForTests,
	resolveUntargetedBarFaceFill,
} from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChartElementView } from './ChartElementView';

const IMAGE_URL = 'data:image/png;base64,sample-test-image';
const SAMPLED_COLOR = '#0a0a0a';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	resetBarFacePicturePixelCacheForTests();
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
	resetBarFacePicturePixelCacheForTests();
});

function makeBar3DPictureElement(): ChartPptxElement {
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
	} as ChartPptxElement;
}

describe('chartElementView - bar3D untargeted-face picture colour sample', () => {
	it('paints the untargeted side/end faces from the resolved point/series colour before any sample is cached', () => {
		act(() => {
			root.render(
				React.createElement(ChartElementView, {
					element: makeBar3DPictureElement(),
					editable: false,
				}),
			);
		});
		const fills = [...container.querySelectorAll('polygon')].map((p) => p.getAttribute('fill'));
		expect(fills).not.toContain(resolveUntargetedBarFaceFill('side', SAMPLED_COLOR));
		expect(fills).not.toContain(resolveUntargetedBarFaceFill('end', SAMPLED_COLOR));
	});

	it('paints the untargeted side/end faces from the sampled colour once it is cached', async () => {
		ensureBarFacePicturePixelSampled(IMAGE_URL, vi.fn().mockResolvedValue(SAMPLED_COLOR));
		await vi.waitFor(() => {
			expect(getCachedBarFacePicturePixelColor(IMAGE_URL)).toBe(SAMPLED_COLOR);
		});

		act(() => {
			root.render(
				React.createElement(ChartElementView, {
					element: makeBar3DPictureElement(),
					editable: false,
				}),
			);
		});

		const fills = [...container.querySelectorAll('polygon')].map((p) => p.getAttribute('fill'));
		expect(fills).toContain(resolveUntargetedBarFaceFill('side', SAMPLED_COLOR));
		expect(fills).toContain(resolveUntargetedBarFaceFill('end', SAMPLED_COLOR));
	});
});
