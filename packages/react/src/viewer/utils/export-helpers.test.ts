import {
	rasterizeElement,
	rasterizeElementClampedToCanvas,
	rasterizeElementTiles,
} from 'pptx-viewer-shared';
import { describe, it, expect, expectTypeOf, vi, beforeEach } from 'vitest';

import { renderToCanvas } from '../../lib/canvas-export';
import {
	ignoreExportOverlayElements,
	rasterResultToPngBlob,
	renderElementToClampedCanvas,
	renderElementToRaster,
	renderElementToTiles,
} from './export-helpers';
// We import the type-only exports to verify they're valid TypeScript
import type {
	ExportProgressCallback,
	PngExportOptions,
	PdfExportOptions,
	RasterizeElementResult,
	SlideCaptureOptions,
} from './export-helpers';

describe('export-helpers types', () => {
	it('exportProgressCallback should accept (current, total) numbers', () => {
		const cb: ExportProgressCallback = (current: number, total: number) => {
			void current;
			void total;
		};
		cb(1, 10);
		// If this compiles and runs, the type is correct
		expect(true).toBeTruthy();
	});

	it('pngExportOptions should accept scale and backgroundColor', () => {
		const opts: PngExportOptions = {
			scale: 2,
			backgroundColor: '#FFFFFF',
		};
		expect(opts.scale).toBe(2);
		expect(opts.backgroundColor).toBe('#FFFFFF');
	});

	it('pngExportOptions should allow omitting all properties', () => {
		const opts: PngExportOptions = {};
		expect(opts.scale).toBeUndefined();
		expect(opts.backgroundColor).toBeUndefined();
	});

	it('pdfExportOptions should accept scale and onProgress', () => {
		let callCount = 0;
		const opts: PdfExportOptions = {
			scale: 3,
			onProgress: () => {
				callCount++;
			},
		};
		opts.onProgress!(1, 5);
		expect(opts.scale).toBe(3);
		expect(callCount).toBe(1);
	});

	it('slideCaptureOptions should accept scale and onProgress', () => {
		const opts: SlideCaptureOptions = {
			scale: 1,
			onProgress: (_c, _t) => {},
		};
		expect(opts.scale).toBe(1);
		expectTypeOf(opts.onProgress).toBeFunction();
	});

	it('slideCaptureOptions should allow omitting all properties', () => {
		const opts: SlideCaptureOptions = {};
		expect(opts.scale).toBeUndefined();
		expect(opts.onProgress).toBeUndefined();
	});
});

describe('rasterResultToPngBlob', () => {
	it('wraps pre-encoded PNG bytes (the tiled case) directly in a Blob', async () => {
		const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
		const result: RasterizeElementResult = {
			kind: 'png-bytes',
			bytes,
			width: 20000,
			height: 10000,
			strategies: ['foreignObject', 'foreignObject'],
		};

		const blob = await rasterResultToPngBlob(result);

		expect(blob).toBeInstanceOf(Blob);
		expect(blob.type).toBe('image/png');
		expect(blob.size).toBe(bytes.length);
	});

	it('converts a canvas result (the common untiled case) via canvas.toBlob', async () => {
		const canvas = {
			toBlob: (callback: BlobCallback) => {
				callback(new Blob(['fake'], { type: 'image/png' }));
			},
		} as unknown as HTMLCanvasElement;
		const result: RasterizeElementResult = {
			kind: 'canvas',
			canvas,
			strategy: 'html2canvas',
			width: 1920,
			height: 1080,
		};

		const blob = await rasterResultToPngBlob(result);
		expect(blob).toBeInstanceOf(Blob);
	});

	it('rejects when canvas.toBlob yields null', async () => {
		const canvas = {
			toBlob: (callback: BlobCallback) => callback(null),
		} as unknown as HTMLCanvasElement;
		const result: RasterizeElementResult = {
			kind: 'canvas',
			canvas,
			strategy: 'html2canvas',
			width: 1920,
			height: 1080,
		};

		await expect(rasterResultToPngBlob(result)).rejects.toThrow('Canvas toBlob returned null');
	});
});

// ---------------------------------------------------------------------------
// Thin wiring onto the shared raster driver
// ---------------------------------------------------------------------------

// Only the three driver entry points are mocked; everything else in
// `pptx-viewer-shared` (e.g. `rasterResultToPngBlob` above) stays real.
vi.mock<typeof import('pptx-viewer-shared')>(
	import('pptx-viewer-shared'),
	async (importOriginal) => {
		const actual = await importOriginal();
		return {
			...actual,
			rasterizeElement: vi.fn(),
			rasterizeElementTiles: vi.fn(),
			rasterizeElementClampedToCanvas: vi.fn(),
		};
	},
);

vi.mock<typeof import('../../lib/canvas-export')>(import('../../lib/canvas-export'), () => ({
	renderToCanvas: vi.fn(() => Promise.resolve({} as HTMLCanvasElement)),
}));

function makeElement(
	rect: { width: number; height: number },
	offset: { width: number; height: number } = { width: 0, height: 0 },
): HTMLElement {
	return {
		getBoundingClientRect: () => rect,
		offsetWidth: offset.width,
		offsetHeight: offset.height,
		ownerDocument: { title: 'owner' },
	} as unknown as HTMLElement;
}

describe('shared raster driver wiring', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renderElementToRaster forwards the natural size, document, scale, background and mode', async () => {
		const el = makeElement({ width: 960, height: 540 });

		await renderElementToRaster(el, 3, '#ffffff');

		expect(rasterizeElement).toHaveBeenCalledWith(
			el,
			960,
			540,
			el.ownerDocument,
			expect.objectContaining({ scale: 3, backgroundColor: '#ffffff', mode: 'auto' }),
		);
	});

	it('falls back to offsetWidth/offsetHeight when the client rect is empty', async () => {
		const el = makeElement({ width: 0, height: 0 }, { width: 800, height: 450 });

		await renderElementToRaster(el);

		expect(rasterizeElement).toHaveBeenCalledWith(
			el,
			800,
			450,
			el.ownerDocument,
			expect.objectContaining({ scale: 2 }),
		);
	});

	it('renderElementToTiles routes to rasterizeElementTiles with the same option shape', async () => {
		const el = makeElement({ width: 960, height: 540 });

		await renderElementToTiles(el, 4, undefined, 'html2canvas');

		expect(rasterizeElementTiles).toHaveBeenCalledWith(
			el,
			960,
			540,
			el.ownerDocument,
			expect.objectContaining({ scale: 4, mode: 'html2canvas' }),
		);
		expect(rasterizeElement).not.toHaveBeenCalled();
	});

	it('renderElementToClampedCanvas routes to rasterizeElementClampedToCanvas', async () => {
		const el = makeElement({ width: 960, height: 540 });

		await renderElementToClampedCanvas(el, 0.5);

		expect(rasterizeElementClampedToCanvas).toHaveBeenCalledWith(
			el,
			960,
			540,
			el.ownerDocument,
			expect.objectContaining({ scale: 0.5, mode: 'auto' }),
		);
		expect(rasterizeElementTiles).not.toHaveBeenCalled();
	});

	it('maps a fallback window onto renderToCanvas with a per-window scale and crop', async () => {
		const el = makeElement({ width: 960, height: 540 });
		await renderElementToRaster(el, 2, '#abcdef');
		const options = vi.mocked(rasterizeElement).mock.calls[0][4];

		await options.html2canvasFallback(
			{ x: 100, y: 50, width: 200, height: 100 },
			{ width: 400, height: 200 },
		);

		expect(renderToCanvas).toHaveBeenCalledWith(
			el,
			expect.objectContaining({
				scale: 2,
				x: 100,
				y: 50,
				width: 200,
				height: 100,
				backgroundColor: '#abcdef',
				useCORS: true,
				allowTaint: true,
				logging: false,
				ignoreElements: ignoreExportOverlayElements,
			}),
		);
	});

	it('passes a null html2canvas background when none was requested and guards a zero-width window', async () => {
		const el = makeElement({ width: 960, height: 540 });
		await renderElementToTiles(el);
		const options = vi.mocked(rasterizeElementTiles).mock.calls[0][4];

		await options.html2canvasFallback({ x: 0, y: 0, width: 0, height: 0 }, { width: 8, height: 8 });

		expect(renderToCanvas).toHaveBeenCalledWith(
			el,
			expect.objectContaining({ scale: 8, backgroundColor: null }),
		);
	});
});

describe('ignoreExportOverlayElements', () => {
	function fakeEl(classes: string[], exportIgnore?: string): Element {
		const set = new Set(classes);
		return {
			dataset: exportIgnore === undefined ? {} : { exportIgnore },
			classList: { contains: (c: string) => set.has(c) },
		} as unknown as Element;
	}

	it('skips elements flagged data-export-ignore', () => {
		expect(ignoreExportOverlayElements(fakeEl([], 'true'))).toBeTruthy();
		expect(ignoreExportOverlayElements(fakeEl([], 'false'))).toBeFalsy();
	});

	it('skips pointer-events-none overlays at z-50 / z-[60] only', () => {
		expect(ignoreExportOverlayElements(fakeEl(['pointer-events-none', 'z-50']))).toBeTruthy();
		expect(ignoreExportOverlayElements(fakeEl(['pointer-events-none', 'z-[60]']))).toBeTruthy();
		expect(ignoreExportOverlayElements(fakeEl(['pointer-events-none']))).toBeFalsy();
		expect(ignoreExportOverlayElements(fakeEl(['z-50']))).toBeFalsy();
		expect(ignoreExportOverlayElements(fakeEl([]))).toBeFalsy();
	});
});
