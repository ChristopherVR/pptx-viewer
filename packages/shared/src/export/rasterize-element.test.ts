// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { rasterizeElement } from './rasterize-element';

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

function fakeCanvas(width: number, height: number, fillValue: number): HTMLCanvasElement {
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
			canvas: fakeCanvas(outputSize.width, outputSize.height, 42),
			strategy: 'foreignObject',
		}),
	),
}));

describe('rasterizeElement', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns a plain canvas when the export fits within the cap (untiled)', async () => {
		const element = document.createElement('div');
		const result = await rasterizeElement(element, 80, 60, document, {
			scale: 1,
			html2canvasFallback: vi.fn(),
		});

		expect(result.kind).toBe('canvas');
		if (result.kind === 'canvas') {
			expect(result.width).toBe(80);
			expect(result.height).toBe(60);
			expect(result.strategy).toBe('foreignObject');
		}
	});

	it('tiles and returns PNG bytes when the export exceeds the cap', async () => {
		const onTileProgress = vi.fn();
		// 80x60 at 20x = 1600x1200, cap 500 -> tiles needed on both axes.
		const result = await rasterizeElement(document.createElement('div'), 80, 60, document, {
			scale: 20,
			maxCanvasDim: 500,
			html2canvasFallback: vi.fn(),
			onTileProgress,
		});

		expect(result.kind).toBe('png-bytes');
		if (result.kind === 'png-bytes') {
			expect(result.width).toBe(1600);
			expect(result.height).toBe(1200);
			expect(result.bytes[0]).toBe(0x89); // PNG signature first byte
			expect(result.strategies.length).toBeGreaterThan(1);
		}
		expect(onTileProgress).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
		const lastCall = onTileProgress.mock.calls.at(-1);
		expect(lastCall?.[0]).toBe(lastCall?.[1]);
	});

	it('skips the foreignObject body build entirely in html2canvas mode', async () => {
		const { buildForeignObjectSvgBody } = await import('../render/foreign-object-svg-document');
		await rasterizeElement(document.createElement('div'), 80, 60, document, {
			scale: 1,
			mode: 'html2canvas',
			html2canvasFallback: vi.fn(),
		});
		expect(buildForeignObjectSvgBody).not.toHaveBeenCalled();
	});
});
