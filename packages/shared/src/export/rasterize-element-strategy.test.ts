// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ForeignObjectSvgBody } from '../render/foreign-object-svg-document';
import { rasterizeWindow } from './rasterize-element-strategy';
import * as rasterizeForeignObjectModule from './rasterize-foreign-object';

const SOURCE_RECT = { x: 0, y: 0, width: 100, height: 50 };
const OUTPUT_SIZE = { width: 200, height: 100 };

function fakeBody(allEmbedded: boolean): ForeignObjectSvgBody {
	return {
		bodyMarkup: '<foreignObject></foreignObject>',
		allEmbedded,
		naturalWidth: 100,
		naturalHeight: 50,
	};
}

function fakeCanvas(): HTMLCanvasElement {
	return document.createElement('canvas');
}

describe('rasterizeWindow', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('uses the foreignObject strategy when the body embedded cleanly', async () => {
		const raster = vi
			.spyOn(rasterizeForeignObjectModule, 'rasterizeForeignObjectSvg')
			.mockResolvedValue(fakeCanvas());
		const html2canvasFallback = vi.fn();

		const result = await rasterizeWindow(fakeBody(true), SOURCE_RECT, OUTPUT_SIZE, undefined, {
			html2canvasFallback,
		});

		expect(result.strategy).toBe('foreignObject');
		expect(raster).toHaveBeenCalledWith(
			expect.stringContaining('<foreignObject'),
			200,
			100,
			undefined,
		);
		expect(html2canvasFallback).not.toHaveBeenCalled();
	});

	it('skips foreignObject when the body has an un-embeddable resource, uses vectorSvgFallback', async () => {
		const vectorSvgFallback = vi.fn().mockResolvedValue(fakeCanvas());
		const html2canvasFallback = vi.fn();

		const result = await rasterizeWindow(fakeBody(false), SOURCE_RECT, OUTPUT_SIZE, undefined, {
			vectorSvgFallback,
			html2canvasFallback,
		});

		expect(result.strategy).toBe('vectorSvg');
		expect(vectorSvgFallback).toHaveBeenCalledWith(SOURCE_RECT, OUTPUT_SIZE);
		expect(html2canvasFallback).not.toHaveBeenCalled();
	});

	it('falls back to html2canvas when foreignObject throws and no vectorSvgFallback is given', async () => {
		vi.spyOn(rasterizeForeignObjectModule, 'rasterizeForeignObjectSvg').mockRejectedValue(
			new Error('taint'),
		);
		const html2canvasFallback = vi.fn().mockResolvedValue(fakeCanvas());
		const onStrategyFailed = vi.fn();

		const result = await rasterizeWindow(fakeBody(true), SOURCE_RECT, OUTPUT_SIZE, undefined, {
			html2canvasFallback,
			onStrategyFailed,
		});

		expect(result.strategy).toBe('html2canvas');
		expect(html2canvasFallback).toHaveBeenCalledWith(SOURCE_RECT, OUTPUT_SIZE);
		expect(onStrategyFailed).toHaveBeenCalledWith('foreignObject', expect.anything());
	});

	it('falls back to html2canvas when vectorSvgFallback also throws', async () => {
		vi.spyOn(rasterizeForeignObjectModule, 'rasterizeForeignObjectSvg').mockRejectedValue(
			new Error('taint'),
		);
		const vectorSvgFallback = vi.fn().mockRejectedValue(new Error('svg export failed'));
		const html2canvasFallback = vi.fn().mockResolvedValue(fakeCanvas());

		const result = await rasterizeWindow(fakeBody(true), SOURCE_RECT, OUTPUT_SIZE, undefined, {
			vectorSvgFallback,
			html2canvasFallback,
		});

		expect(result.strategy).toBe('html2canvas');
	});

	it('mode "html2canvas" skips straight to the legacy fallback, no body/vectorSvg attempted', async () => {
		const raster = vi.spyOn(rasterizeForeignObjectModule, 'rasterizeForeignObjectSvg');
		const vectorSvgFallback = vi.fn();
		const html2canvasFallback = vi.fn().mockResolvedValue(fakeCanvas());

		const result = await rasterizeWindow(fakeBody(true), SOURCE_RECT, OUTPUT_SIZE, undefined, {
			mode: 'html2canvas',
			vectorSvgFallback,
			html2canvasFallback,
		});

		expect(result.strategy).toBe('html2canvas');
		expect(raster).not.toHaveBeenCalled();
		expect(vectorSvgFallback).not.toHaveBeenCalled();
	});

	it('normalises an off-by-one html2canvas result to the exact requested output size', async () => {
		// Reproduces a real html2canvas-pro rounding quirk: the per-binding
		// driver derives its capture scale from outputSize.width/sourceRect.width,
		// and that round trip is not always exact in floating point, so the
		// returned canvas can be a pixel narrower/shorter than requested - which
		// `tile-row-stitch.ts`'s combineTileRowPixels would otherwise reject.
		const offByOneCanvas = document.createElement('canvas');
		offByOneCanvas.width = OUTPUT_SIZE.width - 1;
		offByOneCanvas.height = OUTPUT_SIZE.height;
		const drawImage = vi.fn();
		vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
			if (tag !== 'canvas') {
				throw new Error(`unexpected createElement(${tag})`);
			}
			const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }) };
			return canvas as unknown as HTMLElement;
		});
		const html2canvasFallback = vi.fn().mockResolvedValue(offByOneCanvas);

		const result = await rasterizeWindow(undefined, SOURCE_RECT, OUTPUT_SIZE, undefined, {
			html2canvasFallback,
		});

		expect(result.strategy).toBe('html2canvas');
		expect(result.canvas.width).toBe(OUTPUT_SIZE.width);
		expect(result.canvas.height).toBe(OUTPUT_SIZE.height);
		expect(drawImage).toHaveBeenCalledWith(
			offByOneCanvas,
			0,
			0,
			OUTPUT_SIZE.width - 1,
			OUTPUT_SIZE.height,
			0,
			0,
			OUTPUT_SIZE.width,
			OUTPUT_SIZE.height,
		);
	});

	it('goes straight to the fallback chain when no body was built at all', async () => {
		const vectorSvgFallback = vi.fn().mockResolvedValue(fakeCanvas());
		const html2canvasFallback = vi.fn();

		const result = await rasterizeWindow(undefined, SOURCE_RECT, OUTPUT_SIZE, undefined, {
			vectorSvgFallback,
			html2canvasFallback,
		});

		expect(result.strategy).toBe('vectorSvg');
	});
});
