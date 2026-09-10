import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderToCanvas } from '../lib/canvas-export';
import { ExportService } from './export.service';

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

// `rasterizeElement`/`rasterizeElementTiles`/`rasterizeElementTiledToCanvas`
// (the shared foreignObject -> vector-SVG -> html2canvas orchestrators) are
// mocked at this boundary rather than exercised for real: jsdom has no real
// `Image`/SVG decoding, so the foreignObject attempt they would otherwise
// make first never resolves. Mocking them keeps these tests focused on
// `ExportService`'s own Blob/clipboard/PDF wiring, which is what they assert.
vi.mock(import('../internal/shared'), async (importOriginal) => ({
	...(await importOriginal()),
	rasterizeElement: vi.fn(),
	rasterizeElementTiles: vi.fn(),
	rasterizeElementTiledToCanvas: vi.fn(),
}));

describe('copyElementAsPng', () => {
	const write = vi.fn();
	const png = new Blob(['png'], { type: 'image/png' });
	const clipboardItem = vi.fn(function (this: { data: Record<string, Blob> }, data) {
		this.data = data;
	});

	beforeEach(() => {
		vi.clearAllMocks();
		Object.defineProperty(globalThis, 'ClipboardItem', {
			configurable: true,
			value: clipboardItem,
		});
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { write },
		});
	});

	it('copies the rendered slide as an image/png clipboard item', async () => {
		const { rasterizeElement } = await import('../internal/shared');
		const canvas = document.createElement('canvas');
		vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => callback(png));
		vi.mocked(rasterizeElement).mockResolvedValue({
			kind: 'canvas',
			canvas,
			strategy: 'foreignObject',
			width: 1920,
			height: 1080,
		});

		await new ExportService().copyElementAsPng(document.createElement('div'));

		expect(rasterizeElement).toHaveBeenCalledWith(
			expect.any(HTMLElement),
			expect.any(Number),
			expect.any(Number),
			expect.anything(),
			expect.objectContaining({ scale: 2 }),
		);
		expect(clipboardItem).toHaveBeenCalledWith({ 'image/png': png });
		expect(write).toHaveBeenCalledWith([expect.objectContaining({ data: { 'image/png': png } })]);
	});

	it('falls back to html2canvas when the foreignObject/vector-SVG paths fail', async () => {
		const { rasterizeElement } = await import('../internal/shared');
		const canvas = document.createElement('canvas');
		vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => callback(png));
		vi.mocked(rasterizeElement).mockImplementation(async (_el, _w, _h, _doc, options) =>
			options
				.html2canvasFallback(
					{ x: 0, y: 0, width: 1920, height: 1080 },
					{ width: 1920, height: 1080 },
				)
				.then((c) => ({
					kind: 'canvas' as const,
					canvas: c,
					strategy: 'html2canvas' as const,
					width: 1920,
					height: 1080,
				})),
		);
		vi.mocked(renderToCanvas).mockResolvedValue(canvas);

		await new ExportService().copyElementAsPng(document.createElement('div'));

		expect(renderToCanvas).toHaveBeenCalledWith(expect.any(HTMLElement), expect.any(Object));
		expect(write).toHaveBeenCalledWith([expect.objectContaining({ data: { 'image/png': png } })]);
	});

	it('reports when the image clipboard API is unavailable', async () => {
		Object.defineProperty(globalThis, 'ClipboardItem', {
			configurable: true,
			value: undefined,
		});

		await expect(
			new ExportService().copyElementAsPng(document.createElement('div')),
		).rejects.toThrow('Image clipboard is unavailable');
	});
});

describe('savePresentation', () => {
	it.each([
		['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
		['ppsx', 'application/vnd.openxmlformats-officedocument.presentationml.slideshow'],
		['pptm', 'application/vnd.ms-powerpoint.presentation.macroenabled.12'],
		['ppt', 'application/vnd.ms-powerpoint'],
	] as const)('uses the %s package MIME type', (format, expectedType) => {
		const createObjectUrl = vi.fn(() => 'blob:presentation');
		Object.defineProperty(URL, 'createObjectURL', {
			configurable: true,
			value: createObjectUrl,
		});
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined);

		new ExportService().savePresentation(new Uint8Array([1, 2, 3]), `deck.${format}`, format);

		expect(createObjectUrl).toHaveBeenCalledWith(expect.objectContaining({ type: expectedType }));
	});
});

describe('renderElement', () => {
	it('rasterises via the tiled foreignObject-fidelity path, not raw html2canvas', async () => {
		const { rasterizeElementTiledToCanvas } = await import('../internal/shared');
		const canvas = document.createElement('canvas');
		vi.mocked(rasterizeElementTiledToCanvas).mockResolvedValue({
			kind: 'canvas',
			canvas,
			strategy: 'foreignObject',
			width: 1920,
			height: 1080,
			tiled: false,
		});

		const result = await new ExportService().renderElement(document.createElement('div'), 2);

		expect(result).toBe(canvas);
		expect(rasterizeElementTiledToCanvas).toHaveBeenCalledWith(
			expect.any(HTMLElement),
			expect.any(Number),
			expect.any(Number),
			expect.anything(),
			expect.objectContaining({ scale: 2 }),
		);
		expect(renderToCanvas).not.toHaveBeenCalled();
	});
});

describe('renderElementToTiles', () => {
	it('returns the raw tiled result from the shared rasterizer', async () => {
		const { rasterizeElementTiles } = await import('../internal/shared');
		const tilesResult = {
			fullWidth: 4000,
			fullHeight: 2250,
			tiled: true,
			tiles: [] as never[],
		};
		vi.mocked(rasterizeElementTiles).mockResolvedValue(tilesResult);

		const result = await new ExportService().renderElementToTiles(document.createElement('div'), 4);

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

describe('exportTiledPagesToPdf', () => {
	beforeEach(() => {
		addImage.mockClear();
		addPage.mockClear();
		save.mockClear();
	});

	function fakeTileCanvas(): HTMLCanvasElement {
		const canvas = document.createElement('canvas');
		vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/jpeg;base64,AAAA');
		return canvas;
	}

	it('throws when no pages are provided', () => {
		expect(() => new ExportService().exportTiledPagesToPdf([], 960, 540, 'deck.pdf')).toThrow(
			'No slide pages provided for PDF export',
		);
	});

	it('places one image per single-tile page (degrades to the pre-tiling behaviour)', () => {
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

		new ExportService().exportTiledPagesToPdf(pages, 1920, 1080, 'deck.pdf');

		expect(addImage).toHaveBeenCalledTimes(2);
		expect(addPage).toHaveBeenCalledOnce();
	});

	it('draws multiple images on one page for a tiled slide, one addImage call per tile', () => {
		const pages = [
			{
				fullWidth: 4000,
				fullHeight: 2250,
				tiled: true,
				tiles: [
					{
						col: 0,
						row: 0,
						x: 0,
						y: 0,
						width: 2000,
						height: 2250,
						canvas: fakeTileCanvas(),
						strategy: 'foreignObject' as const,
					},
					{
						col: 1,
						row: 0,
						x: 2000,
						y: 0,
						width: 2000,
						height: 2250,
						canvas: fakeTileCanvas(),
						strategy: 'foreignObject' as const,
					},
				],
			},
		];

		new ExportService().exportTiledPagesToPdf(pages, 1920, 1080, 'deck.pdf');

		expect(addImage).toHaveBeenCalledTimes(2);
	});
});

describe('exportCanvasesToGif', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	/** A minimal canvas stand-in: only `width`/`height`/`getContext` matter. */
	function fakeCanvas(width: number, height: number): HTMLCanvasElement {
		const imageData = { data: new Uint8ClampedArray(width * height * 4), width, height };
		return {
			width,
			height,
			getContext: () => ({ getImageData: () => imageData, drawImage: vi.fn() }),
		} as unknown as HTMLCanvasElement;
	}

	it('throws when no canvases are provided', () => {
		expect(() => new ExportService().exportCanvasesToGif([], 2000, 'deck.gif')).toThrow(
			'No slide canvases provided for GIF export',
		);
	});

	it('does not downscale a frame already within the default 1920px cap', () => {
		const canvases = [fakeCanvas(800, 600)];
		const createElement = vi.spyOn(document, 'createElement');

		new ExportService().exportCanvasesToGif(canvases, 2000, 'deck.gif');

		expect(createElement).not.toHaveBeenCalledWith('canvas');
	});

	it('downscales a frame larger than the requested maxSide before encoding', () => {
		const canvases = [fakeCanvas(4000, 2000)];
		const scaledDrawImage = vi.fn();
		const scaledCanvas = {
			width: 0,
			height: 0,
			getContext: () => ({
				drawImage: scaledDrawImage,
				getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
			}),
		} as unknown as HTMLCanvasElement;
		const orig = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
			tag === 'canvas' ? scaledCanvas : orig(tag),
		);

		new ExportService().exportCanvasesToGif(canvases, 2000, 'deck.gif', 1000);

		// 4000x2000 clamped to maxSide 1000 on the longer side -> 1000x500.
		expect(scaledCanvas.width).toBe(1000);
		expect(scaledCanvas.height).toBe(500);
		expect(scaledDrawImage).toHaveBeenCalledWith(canvases[0], 0, 0, 1000, 500);
	});

	it('defaults the cap to the shared GIF_POST_CAPTURE_MAX_SIDE (1920px)', () => {
		const canvases = [fakeCanvas(3840, 2160)];
		const scaledCanvas = {
			width: 0,
			height: 0,
			getContext: () => ({
				drawImage: vi.fn(),
				getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
			}),
		} as unknown as HTMLCanvasElement;
		const orig = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
			tag === 'canvas' ? scaledCanvas : orig(tag),
		);

		new ExportService().exportCanvasesToGif(canvases, 2000, 'deck.gif');

		expect(scaledCanvas.width).toBe(1920);
		expect(scaledCanvas.height).toBe(1080);
	});
});
