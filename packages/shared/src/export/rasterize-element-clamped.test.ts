// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { rasterizeElementClampedToCanvas } from './rasterize-element-clamped';

function fakeCanvas(width: number, height: number): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

describe('rasterizeElementClampedToCanvas', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('passes the requested scale through unchanged when it already fits the cap', async () => {
		const html2canvasFallback = vi.fn().mockResolvedValue(fakeCanvas(1920, 1080));
		const el = document.createElement('div');
		document.body.appendChild(el);

		const result = await rasterizeElementClampedToCanvas(el, 960, 540, document, {
			scale: 2,
			maxCanvasDim: 4096,
			mode: 'html2canvas',
			html2canvasFallback,
		});

		expect(result.clamped).toBeFalsy();
		expect(result.effectiveScale).toBe(2);
		expect(result.kind).toBe('canvas');
		document.body.removeChild(el);
	});

	it('reduces the scale to fit when the requested resolution exceeds the cap', async () => {
		const html2canvasFallback = vi
			.fn()
			.mockImplementation(async (_source, outputSize) =>
				fakeCanvas(outputSize.width, outputSize.height),
			);
		const el = document.createElement('div');
		document.body.appendChild(el);

		// natural 10000x10 wide element at 2x = 20000px, cap 4096.
		const result = await rasterizeElementClampedToCanvas(el, 10000, 10, document, {
			scale: 2,
			maxCanvasDim: 4096,
			mode: 'html2canvas',
			html2canvasFallback,
		});

		expect(result.clamped).toBeTruthy();
		expect(result.effectiveScale).toBeCloseTo(4096 / 10000, 5);
		expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(4096);
		document.body.removeChild(el);
	});
});
