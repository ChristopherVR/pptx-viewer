import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderToCanvas } from '../lib/canvas-export';
import {
	buildTiledPdf,
	html2canvasFallbackFor,
	renderElementClamped,
	renderElementPngBlob,
	renderElementTilesRaster,
} from './export-raster-tiles';

vi.mock(import('../lib/canvas-export'), () => ({
	renderToCanvas: vi.fn(),
}));

const { addImage, addPage, save } = vi.hoisted(() => ({
	addImage: vi.fn(),
	addPage: vi.fn(),
	save: vi.fn(),
}));
vi.mock(import('jspdf'), () => {
	class MockJsPDF {
		addImage = addImage;
		addPage = addPage;
		save = save;
	}
	return { jsPDF: MockJsPDF } as unknown as typeof import('jspdf');
});

// `rasterizeElement`/`rasterizeElementClampedToCanvas`/`rasterizeElementTiles` (the shared
// foreignObject -> vector-SVG -> html2canvas orchestrators) are mocked at
// this boundary rather than exercised for real: jsdom has no real
// `Image`/SVG decoding, so the foreignObject attempt they would otherwise
// make first never resolves. Mocking them keeps these tests focused on this
// module's own delegation, which is what it owns.
vi.mock(import('../internal/shared'), async (importOriginal) => ({
	...(await importOriginal()),
	rasterizeElement: vi.fn(),
	rasterizeElementClampedToCanvas: vi.fn(),
	rasterizeElementTiles: vi.fn(),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

describe('html2canvasFallbackFor', () => {
	it('derives the capture scale from the output/source width ratio and forwards the crop rect', async () => {
		const el = document.createElement('div');
		const canvas = document.createElement('canvas');
		vi.mocked(renderToCanvas).mockResolvedValue(canvas);

		const fallback = html2canvasFallbackFor(el);
		const result = await fallback(
			{ x: 10, y: 20, width: 100, height: 50 },
			{ width: 200, height: 100 },
		);

		expect(result).toBe(canvas);
		expect(renderToCanvas).toHaveBeenCalledWith(el, {
			scale: 2,
			x: 10,
			y: 20,
			width: 100,
			height: 50,
		});
	});

	it('falls back to a scale of the output width when the source rect is zero-width', async () => {
		const el = document.createElement('div');
		vi.mocked(renderToCanvas).mockResolvedValue(document.createElement('canvas'));

		const fallback = html2canvasFallbackFor(el);
		await fallback({ x: 0, y: 0, width: 0, height: 0 }, { width: 300, height: 150 });

		expect(renderToCanvas).toHaveBeenCalledWith(el, expect.objectContaining({ scale: 300 }));
	});
});

describe('renderElementPngBlob', () => {
	it('wraps the single-canvas result as a PNG blob', async () => {
		const { rasterizeElement } = await import('../internal/shared');
		const canvas = document.createElement('canvas');
		const png = new Blob(['png'], { type: 'image/png' });
		vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => callback(png));
		vi.mocked(rasterizeElement).mockResolvedValue({
			kind: 'canvas',
			canvas,
			strategy: 'foreignObject',
			width: 1920,
			height: 1080,
		});

		const blob = await renderElementPngBlob(document.createElement('div'), 2);

		expect(blob).toBe(png);
		expect(rasterizeElement).toHaveBeenCalledWith(
			expect.any(HTMLElement),
			expect.any(Number),
			expect.any(Number),
			expect.anything(),
			expect.objectContaining({ scale: 2, html2canvasFallback: expect.any(Function) }),
		);
		expect(renderToCanvas).not.toHaveBeenCalled();
	});

	it('wraps pre-encoded PNG bytes from a tiled export without touching a canvas', async () => {
		const { rasterizeElement } = await import('../internal/shared');
		vi.mocked(rasterizeElement).mockResolvedValue({
			kind: 'png-bytes',
			bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
			width: 40000,
			height: 22500,
			strategies: ['foreignObject', 'foreignObject'],
		});

		const blob = await renderElementPngBlob(document.createElement('div'), 20);

		expect(blob.type).toBe('image/png');
		expect(blob.size).toBe(4);
	});
});

describe('renderElementClamped', () => {
	it('rasterises via the clamped shared pipeline and returns its canvas', async () => {
		const { rasterizeElementClampedToCanvas } = await import('../internal/shared');
		const canvas = document.createElement('canvas');
		vi.mocked(rasterizeElementClampedToCanvas).mockResolvedValue({
			kind: 'canvas',
			canvas,
			strategy: 'foreignObject',
			width: 1920,
			height: 1080,
			clamped: false,
			effectiveScale: 3,
		});

		const result = await renderElementClamped(document.createElement('div'), 3);

		expect(result).toBe(canvas);
		expect(rasterizeElementClampedToCanvas).toHaveBeenCalledWith(
			expect.any(HTMLElement),
			expect.any(Number),
			expect.any(Number),
			expect.anything(),
			expect.objectContaining({ scale: 3 }),
		);
	});
});

describe('renderElementTilesRaster', () => {
	it('returns the raw tiled result from the shared rasterizer', async () => {
		const { rasterizeElementTiles } = await import('../internal/shared');
		const tilesResult = { fullWidth: 3840, fullHeight: 2160, tiled: true, tiles: [] as never[] };
		vi.mocked(rasterizeElementTiles).mockResolvedValue(tilesResult);

		const result = await renderElementTilesRaster(document.createElement('div'), 4);

		expect(result).toBe(tilesResult);
		expect(rasterizeElementTiles).toHaveBeenCalledWith(
			expect.any(HTMLElement),
			expect.any(Number),
			expect.any(Number),
			expect.anything(),
			expect.objectContaining({ scale: 4 }),
		);
	});
});

describe('buildTiledPdf', () => {
	function fakeTileCanvas(): HTMLCanvasElement {
		const canvas = document.createElement('canvas');
		vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/jpeg;base64,AAAA');
		return canvas;
	}

	it('throws when no pages are provided', () => {
		expect(() => buildTiledPdf([], 960, 540, 'deck.pdf')).toThrow(
			'No slide pages provided for PDF export',
		);
	});

	it('adds one page per entry (after the first) and saves under the sanitized name', () => {
		const pages = [
			{
				fullWidth: 1920,
				fullHeight: 1080,
				tiled: false,
				tiles: [
					{
						col: 0,
						row: 0,
						x: 0,
						y: 0,
						width: 1920,
						height: 1080,
						canvas: fakeTileCanvas(),
						strategy: 'foreignObject' as const,
					},
				],
			},
			{
				fullWidth: 1920,
				fullHeight: 1080,
				tiled: false,
				tiles: [
					{
						col: 0,
						row: 0,
						x: 0,
						y: 0,
						width: 1920,
						height: 1080,
						canvas: fakeTileCanvas(),
						strategy: 'foreignObject' as const,
					},
				],
			},
		];

		buildTiledPdf(pages, 1920, 1080, 'my deck?.pdf');

		expect(addPage).toHaveBeenCalledOnce();
		expect(addImage).toHaveBeenCalledTimes(2);
		expect(save).toHaveBeenCalledWith(expect.not.stringContaining('?'));
	});
});
