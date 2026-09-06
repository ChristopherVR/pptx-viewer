/**
 * Regression test for the async first-pixel colour sample cache
 * (`chart-bar3d-face-picture-sample.ts`) reaching `ChartRendererComponent`.
 *
 * No Angular TestBed here (see `accessibility-text-panel.component.test.ts`):
 * component template rendering needs `@analogjs/vite-plugin-angular`, not yet
 * wired into this package's test setup. `ChartRendererComponent.vm` is a thin
 * `computed(() => buildChartViewModel(this.element()))` (see the component's
 * own doc comment): asserting `buildChartViewModel` returns the sampled-
 * colour-derived fill once a picture's first pixel is cached is exactly
 * asserting what `vm()` (and therefore the template's `fill="..."` binding)
 * would render, matching this package's `bar-chart-3d-renderer.component
 * .test.ts` precedent of testing the pure data adapter through the SAME
 * vendored barrel the component imports from, in place of a template mount.
 */
import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	ensureBarFacePicturePixelSampled,
	getBarFacePicturePixelSampleVersion,
	getCachedBarFacePicturePixelColor,
	resetBarFacePicturePixelCacheForTests,
	resolveUntargetedBarFaceFill,
	subscribeBarFacePicturePixelSamples,
} from '../internal/shared';
import { buildChartViewModel } from './chart-renderer-helpers';

const IMAGE_URL = 'data:image/png;base64,angular-sample-test-image';
const SAMPLED_COLOR = '#0c0c0c';

beforeEach(() => {
	resetBarFacePicturePixelCacheForTests();
});
afterEach(() => {
	resetBarFacePicturePixelCacheForTests();
});

function bar3DPictureElement(): ChartPptxElement {
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
		id: 'ch_bar3d_pic',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as unknown as ChartPptxElement;
}

describe('chartRendererComponent picture-fill sample cache wiring (via the vendored shared barrel)', () => {
	it('is reachable through the vendored shared barrel Angular imports from', () => {
		expect(getBarFacePicturePixelSampleVersion).toBeTypeOf('function');
		expect(subscribeBarFacePicturePixelSamples).toBeTypeOf('function');
	});

	it('buildChartViewModel paints the untargeted side/end faces from the resolved point/series colour before any sample is cached', () => {
		const vm = buildChartViewModel(bar3DPictureElement());
		const fills = (vm.primitives ?? [])
			.filter((p): p is { kind: 'polygon'; fill: string } => p.kind === 'polygon')
			.map((p) => p.fill);
		expect(fills).not.toContain(resolveUntargetedBarFaceFill('side', SAMPLED_COLOR));
		expect(fills).not.toContain(resolveUntargetedBarFaceFill('end', SAMPLED_COLOR));
	});

	it('buildChartViewModel paints the untargeted side/end faces from the sampled colour once it is cached', async () => {
		ensureBarFacePicturePixelSampled(IMAGE_URL, vi.fn().mockResolvedValue(SAMPLED_COLOR));
		await vi.waitFor(() => {
			expect(getCachedBarFacePicturePixelColor(IMAGE_URL)).toBe(SAMPLED_COLOR);
		});

		const vm = buildChartViewModel(bar3DPictureElement());
		const fills = (vm.primitives ?? [])
			.filter((p): p is { kind: 'polygon'; fill: string } => p.kind === 'polygon')
			.map((p) => p.fill);
		expect(fills).toContain(resolveUntargetedBarFaceFill('side', SAMPLED_COLOR));
		expect(fills).toContain(resolveUntargetedBarFaceFill('end', SAMPLED_COLOR));
	});
});
