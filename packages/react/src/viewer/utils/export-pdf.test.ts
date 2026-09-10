import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
	downloadDataUrl,
	renderElementToTiledCanvas,
	renderElementToTiles,
} from './export-helpers';
import { exportAllSlidesAsPdf, exportAllSlidesAsNotesPdf, exportSlideAsPdf } from './export-pdf';
import { buildPdfFromTiledImageData, buildNotesPdf, canvasToJpegData } from './pdf-builder';

// ---------------------------------------------------------------------------
// Mock external dependencies before importing the module under test.
// ---------------------------------------------------------------------------

/** A single untiled tile covering the whole (fake) 1920x1080 raster. */
function makeMockTilesResult() {
	return {
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
				canvas: makeMockCanvas(),
				strategy: 'foreignObject' as const,
			},
		],
	};
}

// Mock export-helpers to avoid DOM/canvas dependencies
vi.mock<typeof import('./export-helpers')>(import('./export-helpers'), () => ({
	downloadBlob: vi.fn<() => void>(),
	downloadDataUrl: vi.fn<() => void>(),
	renderElementToRaster: vi.fn<() => void>(),
	renderElementToTiles: vi.fn(() => Promise.resolve(makeMockTilesResult())),
	renderElementToTiledCanvas: vi.fn(() =>
		Promise.resolve({
			kind: 'canvas' as const,
			canvas: makeMockCanvas(),
			strategy: 'foreignObject' as const,
			width: 1920,
			height: 1080,
			tiled: false,
		}),
	),
	rasterResultToPngBlob: vi.fn<() => void>(),
	waitForRender: vi.fn(() => Promise.resolve()),
}));

// Mock pdf-builder to avoid heavy PDF generation
vi.mock<typeof import('./pdf-builder')>(import('./pdf-builder'), () => ({
	buildPdfFromTiledImageData: vi.fn(() => 'blob:mock-pdf-url'),
	buildNotesPdf: vi.fn(() => 'blob:mock-notes-pdf-url'),
	canvasToJpegData: vi.fn(() => ({
		w: 1920,
		h: 1080,
		bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
	})),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockCanvas(): HTMLCanvasElement {
	const canvas = {
		width: 1920,
		height: 1080,
		toBlob: vi.fn((callback: BlobCallback, type?: string) => {
			callback(new Blob(['mock-png-data'], { type: type ?? 'image/png' }));
		}),
		toDataURL: vi.fn(() => 'data:image/png;base64,abc123'),
	} as unknown as HTMLCanvasElement;
	return canvas;
}

function makeMockElement(): HTMLElement {
	return { tagName: 'DIV' } as unknown as HTMLElement;
}

beforeEach(() => {
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// exportAllSlidesAsPdf
// ---------------------------------------------------------------------------

describe('exportAllSlidesAsPdf', () => {
	it('iterates all slides, calls progress, and produces PDF', async () => {
		const stageEl = makeMockElement();
		const ref = { current: stageEl } as React.RefObject<HTMLElement | null>;
		const setActive = vi.fn<() => void>();
		const onProgress = vi.fn<() => void>();

		await exportAllSlidesAsPdf(ref, 3, setActive, 1, 'test.pdf', {
			onProgress,
		});

		// setActiveSlide called for each slide (0,1,2) + restore to original (1)
		expect(setActive).toHaveBeenCalledTimes(4);
		expect(setActive).toHaveBeenCalledWith(0);
		expect(setActive).toHaveBeenCalledWith(1);
		expect(setActive).toHaveBeenCalledWith(2);
		expect(setActive).toHaveBeenLastCalledWith(1);

		expect(onProgress).toHaveBeenCalledWith(0, 3);
		expect(onProgress).toHaveBeenCalledWith(3, 3);

		expect(buildPdfFromTiledImageData).toHaveBeenCalledOnce();
		expect(downloadDataUrl).toHaveBeenCalledWith('blob:mock-pdf-url', 'test.pdf');
	});

	it('uses default filename', async () => {
		const stageEl = makeMockElement();
		const ref = { current: stageEl } as React.RefObject<HTMLElement | null>;

		await exportAllSlidesAsPdf(ref, 1, vi.fn<() => void>(), 0);

		expect(downloadDataUrl).toHaveBeenCalledWith(expect.any(String), 'presentation.pdf');
	});

	it('throws when no slides are captured', async () => {
		const ref = { current: null } as React.RefObject<HTMLElement | null>;

		await expect(exportAllSlidesAsPdf(ref, 2, vi.fn<() => void>(), 0)).rejects.toThrow(
			'No slides were captured for PDF export',
		);
	});

	it('restores original slide index after export', async () => {
		const stageEl = makeMockElement();
		const ref = { current: stageEl } as React.RefObject<HTMLElement | null>;
		const setActive = vi.fn<() => void>();

		await exportAllSlidesAsPdf(ref, 3, setActive, 2);

		const calls = setActive.mock.calls;
		expect(calls[calls.length - 1][0]).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// exportAllSlidesAsNotesPdf
// ---------------------------------------------------------------------------

describe('exportAllSlidesAsNotesPdf', () => {
	it('passes slide notes to buildNotesPdf', async () => {
		const stageEl = makeMockElement();
		const ref = { current: stageEl } as React.RefObject<HTMLElement | null>;
		const notes = ['Note for slide 1', undefined, 'Note for slide 3'];

		await exportAllSlidesAsNotesPdf(ref, 3, vi.fn<() => void>(), 0, notes);

		// Notes-PDF draws one image per page alongside wrapped notes text, so
		// it goes through the single-canvas raster path (tiled and stitched
		// internally, not several tile images placed on the page).
		expect(renderElementToTiledCanvas).toHaveBeenCalledTimes(3);
		expect(buildNotesPdf).toHaveBeenCalledOnce();
		const pages = vi.mocked(buildNotesPdf).mock.calls[0][0];
		expect(pages).toHaveLength(3);
		expect(pages[0].notes).toBe('Note for slide 1');
		expect(pages[0].slideNumber).toBe(1);
		expect(pages[1].notes).toBeUndefined();
		expect(pages[1].slideNumber).toBe(2);
		expect(pages[2].notes).toBe('Note for slide 3');
		expect(pages[2].slideNumber).toBe(3);
	});

	it('uses default filename', async () => {
		const stageEl = makeMockElement();
		const ref = { current: stageEl } as React.RefObject<HTMLElement | null>;

		await exportAllSlidesAsNotesPdf(ref, 1, vi.fn<() => void>(), 0, []);

		expect(downloadDataUrl).toHaveBeenCalledWith(expect.any(String), 'presentation-notes.pdf');
	});

	it('throws when no slides are captured', async () => {
		const ref = { current: null } as React.RefObject<HTMLElement | null>;

		await expect(exportAllSlidesAsNotesPdf(ref, 2, vi.fn<() => void>(), 0, [])).rejects.toThrow(
			'No slides were captured for notes PDF export',
		);
	});

	it('restores original slide index after export', async () => {
		const stageEl = makeMockElement();
		const ref = { current: stageEl } as React.RefObject<HTMLElement | null>;
		const setActive = vi.fn<() => void>();

		await exportAllSlidesAsNotesPdf(ref, 2, setActive, 1, []);

		const calls = setActive.mock.calls;
		expect(calls[calls.length - 1][0]).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// exportSlideAsPdf
// ---------------------------------------------------------------------------

describe('exportSlideAsPdf', () => {
	it('builds a single-page (single-tile) PDF and downloads it', async () => {
		const el = makeMockElement();
		await exportSlideAsPdf(el, 3);

		expect(renderElementToTiles).toHaveBeenCalledWith(el, 2, undefined);
		expect(buildPdfFromTiledImageData).toHaveBeenCalledOnce();
		const pages = vi.mocked(buildPdfFromTiledImageData).mock.calls[0][0];
		expect(pages).toHaveLength(1);
		expect(pages[0]).toHaveLength(1);
		expect(downloadDataUrl).toHaveBeenCalledWith('blob:mock-pdf-url', 'slide-4.pdf');
	});

	it('passes custom scale and backgroundColor', async () => {
		const el = makeMockElement();
		await exportSlideAsPdf(el, 0, { scale: 3, backgroundColor: '#FFFFFF' });

		expect(renderElementToTiles).toHaveBeenCalledWith(el, 3, '#FFFFFF');
	});
});

// ---------------------------------------------------------------------------
// Tiled PDF pages (an export whose resolution exceeded the canvas cap)
// ---------------------------------------------------------------------------

describe('exportAllSlidesAsPdf (tiled)', () => {
	/** A 2x2 tile grid covering a 4000x2000 full raster (each tile 2000x1000). */
	function makeTiledResult() {
		const tiles = [];
		for (let row = 0; row < 2; row++) {
			for (let col = 0; col < 2; col++) {
				tiles.push({
					col,
					row,
					x: col * 2000,
					y: row * 1000,
					width: 2000,
					height: 1000,
					canvas: makeMockCanvas(),
					strategy: 'foreignObject' as const,
				});
			}
		}
		return { fullWidth: 4000, fullHeight: 2000, tiled: true, tiles };
	}

	it('encodes every tile as its own JPEG placed at its proportional page position', async () => {
		const tiled = makeTiledResult();
		vi.mocked(renderElementToTiles).mockResolvedValueOnce(tiled);
		const ref = { current: makeMockElement() } as React.RefObject<HTMLElement | null>;

		await exportAllSlidesAsPdf(ref, 1, vi.fn<() => void>(), 0);

		expect(canvasToJpegData).toHaveBeenCalledTimes(4);
		for (const tile of tiled.tiles) {
			expect(canvasToJpegData).toHaveBeenCalledWith(tile.canvas);
		}

		const pages = vi.mocked(buildPdfFromTiledImageData).mock.calls[0][0];
		expect(pages).toHaveLength(1);
		expect(pages[0]).toHaveLength(4);

		// 4000x2000 fitted into 842x595 (landscape A4): fitScale = 842/4000,
		// fitted 842 x 421, letterboxed 87pt from the top. Each tile occupies
		// its proportional quarter of that fitted rectangle (top-down y).
		const fit = 842 / 4000;
		const offsetY = (595 - 2000 * fit) / 2;
		const [tl, tr, bl] = pages[0];
		expect(tl.placement.x).toBeCloseTo(0, 5);
		expect(tl.placement.y).toBeCloseTo(offsetY, 5);
		expect(tl.placement.width).toBeCloseTo(2000 * fit, 5);
		expect(tl.placement.height).toBeCloseTo(1000 * fit, 5);
		expect(tr.placement.x).toBeCloseTo(2000 * fit, 5);
		expect(tr.placement.y).toBeCloseTo(offsetY, 5);
		expect(bl.placement.x).toBeCloseTo(0, 5);
		expect(bl.placement.y).toBeCloseTo(offsetY + 1000 * fit, 5);
		expect(pages[0].every((entry) => entry.image.bytes.length === 4)).toBeTruthy();
	});

	it('rejects with AbortError before capturing anything when already cancelled', async () => {
		const ref = { current: makeMockElement() } as React.RefObject<HTMLElement | null>;

		await expect(
			exportAllSlidesAsPdf(ref, 2, vi.fn<() => void>(), 0, 'x.pdf', {
				signal: AbortSignal.abort(),
			}),
		).rejects.toMatchObject({ name: 'AbortError' });

		expect(renderElementToTiles).not.toHaveBeenCalled();
		expect(buildPdfFromTiledImageData).not.toHaveBeenCalled();
	});

	it('notes-PDF hands the rasterised canvas itself to buildNotesPdf', async () => {
		const ref = { current: makeMockElement() } as React.RefObject<HTMLElement | null>;

		await exportAllSlidesAsNotesPdf(ref, 1, vi.fn<() => void>(), 0, ['n'], 'n.pdf', { scale: 1.5 });

		expect(renderElementToTiledCanvas).toHaveBeenCalledWith(ref.current, 1.5);
		const rasterised = await vi.mocked(renderElementToTiledCanvas).mock.results[0].value;
		const pages = vi.mocked(buildNotesPdf).mock.calls[0][0];
		expect(pages[0].canvas).toBe(rasterised.canvas);
		expect(renderElementToTiles).not.toHaveBeenCalled();
	});
});
