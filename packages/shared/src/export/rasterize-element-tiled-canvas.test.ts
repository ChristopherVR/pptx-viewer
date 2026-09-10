// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { rasterizeElementTiledToCanvas } from './rasterize-element-tiled-canvas';

vi.mock(import('./canvas-size-probe'), () => ({
	probeMaxCanvasDimension: vi.fn(() => 100),
}));

vi.mock(import('../render/foreign-object-svg-document'), () => ({
	buildForeignObjectSvgBody: vi.fn(async () => ({
		bodyMarkup: '<foreignObject/>',
		allEmbedded: true,
		naturalWidth: 0,
		naturalHeight: 0,
	})),
}));

/** A tile canvas stand-in: a plain object, never a real `HTMLCanvasElement`. */
function fakeTileCanvas(width: number, height: number, fillValue: number): HTMLCanvasElement {
	const data = new Uint8ClampedArray(width * height * 4).fill(fillValue);
	return {
		width,
		height,
		getContext: () => ({
			getImageData: () => ({ data, width, height }),
		}),
	} as unknown as HTMLCanvasElement;
}

vi.mock(import('./rasterize-element-strategy'), () => ({
	rasterizeWindow: vi.fn(
		async (
			_body: unknown,
			_sourceRect: unknown,
			outputSize: { width: number; height: number },
		) => ({
			canvas: fakeTileCanvas(outputSize.width, outputSize.height, 7),
			strategy: 'foreignObject',
		}),
	),
}));

/**
 * jsdom (without the native `canvas` npm package this repo does not depend
 * on) implements neither real canvas rasterisation nor the `ImageData`
 * global `putImageData` needs. Every other raster call is mocked around that
 * gap already (`rasterizeWindow` above never touches a real canvas); this
 * fills the one remaining browser global the stitch path constructs itself.
 */
class FakeImageData {
	data: Uint8ClampedArray;
	width: number;
	height: number;
	constructor(data: Uint8ClampedArray, width: number, height: number) {
		this.data = data;
		this.width = width;
		this.height = height;
	}
}

describe('rasterizeElementTiledToCanvas', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal('ImageData', FakeImageData);
	});
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('returns the single tile canvas unchanged when the export fits within the cap', async () => {
		const element = document.createElement('div');
		const result = await rasterizeElementTiledToCanvas(element, 80, 60, document, {
			scale: 1,
			html2canvasFallback: vi.fn(),
		});

		expect(result.tiled).toBeFalsy();
		expect(result.width).toBe(80);
		expect(result.height).toBe(60);
		expect(result.canvas.width).toBe(80);
		expect(result.canvas.height).toBe(60);
	});

	it('tiles and stitches into one full-resolution canvas when the export exceeds the cap', async () => {
		const putImageData = vi.fn();
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
			putImageData,
		} as unknown as CanvasRenderingContext2D);

		// 80x60 at 20x = 1600x1200, cap 500 -> tiles needed on both axes.
		const result = await rasterizeElementTiledToCanvas(
			document.createElement('div'),
			80,
			60,
			document,
			{
				scale: 20,
				maxCanvasDim: 500,
				html2canvasFallback: vi.fn(),
			},
		);

		expect(result.tiled).toBeTruthy();
		expect(result.width).toBe(1600);
		expect(result.height).toBe(1200);
		expect(result.canvas.width).toBe(1600);
		expect(result.canvas.height).toBe(1200);
		expect(putImageData).toHaveBeenCalledOnce();
		const [imageData] = putImageData.mock.calls[0] as [ImageData, number, number];
		expect(imageData.width).toBe(1600);
		expect(imageData.height).toBe(1200);
		// Every source tile was filled with 7; the stitched buffer must carry it through.
		expect(imageData.data[0]).toBe(7);
		expect(imageData.data.at(-1)).toBe(7);
	});

	it('throws when the stitched destination canvas has no 2D context', async () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

		await expect(
			rasterizeElementTiledToCanvas(document.createElement('div'), 80, 60, document, {
				scale: 20,
				maxCanvasDim: 500,
				html2canvasFallback: vi.fn(),
			}),
		).rejects.toThrow(/2D canvas context unavailable/u);
	});
});
