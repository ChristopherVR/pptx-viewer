import { describe, it, expect, vi, beforeEach } from 'vitest';

import { downloadBlob, downloadDataUrl, renderElementToCanvas } from './export-helpers';
import {
	exportSlideToPngBlob,
	exportSlideAsPng,
	exportAllSlidesAsPdf,
	captureAllSlidesAsPngDataUrls,
	exportAllSlidesAsNotesPdf,
	exportSlideAsPdf,
} from './export-slides';
import { buildPdfFromImageData, buildNotesPdf } from './pdf-builder';

// ---------------------------------------------------------------------------
// Mock external dependencies before importing the module under test.
// ---------------------------------------------------------------------------

// Mock export-helpers to avoid DOM/canvas dependencies
vi.mock<typeof import('./export-helpers')>(import('./export-helpers'), () => ({
	downloadBlob: vi.fn<() => void>(),
	downloadDataUrl: vi.fn<() => void>(),
	renderElementToCanvas: vi.fn<() => void>(),
	waitForRender: vi.fn(() => Promise.resolve()),
}));

// Mock pdf-builder to avoid heavy PDF generation
vi.mock<typeof import('./pdf-builder')>(import('./pdf-builder'), () => ({
	buildPdfFromImageData: vi.fn(() => 'blob:mock-pdf-url'),
	buildNotesPdf: vi.fn(() => 'blob:mock-notes-pdf-url'),
	canvasToJpegData: vi.fn(() => ({
		width: 1920,
		height: 1080,
		dataUrl: 'data:image/jpeg;base64,abc',
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
	// Default: renderElementToCanvas returns a mock canvas
	vi.mocked(renderElementToCanvas).mockResolvedValue(makeMockCanvas());
});

// ---------------------------------------------------------------------------
// exportSlideToPngBlob
// ---------------------------------------------------------------------------

describe('exportSlideToPngBlob', () => {
	it('calls renderElementToCanvas with default scale of 2', async () => {
		const el = makeMockElement();
		await exportSlideToPngBlob(el);

		expect(renderElementToCanvas).toHaveBeenCalledWith(el, 2, undefined);
	});

	it('passes custom scale to renderElementToCanvas', async () => {
		const el = makeMockElement();
		await exportSlideToPngBlob(el, { scale: 4 });

		expect(renderElementToCanvas).toHaveBeenCalledWith(el, 4, undefined);
	});

	it('passes custom backgroundColor to renderElementToCanvas', async () => {
		const el = makeMockElement();
		await exportSlideToPngBlob(el, { backgroundColor: '#FF0000' });

		expect(renderElementToCanvas).toHaveBeenCalledWith(el, 2, '#FF0000');
	});

	it('returns a PNG Blob', async () => {
		const el = makeMockElement();
		const blob = await exportSlideToPngBlob(el);

		expect(blob).toBeInstanceOf(Blob);
	});

	it('rejects when canvas.toBlob returns null', async () => {
		const canvas = makeMockCanvas();
		(canvas.toBlob as ReturnType<typeof vi.fn>).mockImplementation((callback: BlobCallback) =>
			callback(null),
		);
		vi.mocked(renderElementToCanvas).mockResolvedValue(canvas);

		const el = makeMockElement();
		await expect(exportSlideToPngBlob(el)).rejects.toThrow('Canvas toBlob returned null');
	});
});

// ---------------------------------------------------------------------------
// exportSlideAsPng
// ---------------------------------------------------------------------------

describe('exportSlideAsPng', () => {
	it('triggers download with correct filename for slide index 0', async () => {
		const el = makeMockElement();
		await exportSlideAsPng(el, 0);

		expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'slide-1.png');
	});

	it('triggers download with correct filename for slide index 5', async () => {
		const el = makeMockElement();
		await exportSlideAsPng(el, 5);

		expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'slide-6.png');
	});
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

		expect(buildPdfFromImageData).toHaveBeenCalledOnce();
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
// captureAllSlidesAsPngDataUrls
// ---------------------------------------------------------------------------

describe('captureAllSlidesAsPngDataUrls', () => {
	it('returns data URLs for all slides', async () => {
		const stageEl = makeMockElement();
		const ref = { current: stageEl } as React.RefObject<HTMLElement | null>;

		const result = await captureAllSlidesAsPngDataUrls(ref, 3, vi.fn<() => void>(), 0);

		expect(result).toHaveLength(3);
		for (const url of result) {
			expect(url).toContain('data:image/png');
		}
	});

	it('calls setActiveSlide for each slide and restores original', async () => {
		const stageEl = makeMockElement();
		const ref = { current: stageEl } as React.RefObject<HTMLElement | null>;
		const setActive = vi.fn<() => void>();

		await captureAllSlidesAsPngDataUrls(ref, 2, setActive, 1);

		expect(setActive).toHaveBeenCalledWith(0);
		expect(setActive).toHaveBeenCalledWith(1);
		const calls = setActive.mock.calls;
		expect(calls[calls.length - 1][0]).toBe(1);
	});

	it('calls progress callback for each slide plus completion', async () => {
		const stageEl = makeMockElement();
		const ref = { current: stageEl } as React.RefObject<HTMLElement | null>;
		const onProgress = vi.fn<() => void>();

		await captureAllSlidesAsPngDataUrls(ref, 2, vi.fn<() => void>(), 0, { onProgress });

		expect(onProgress).toHaveBeenCalledWith(0, 2);
		expect(onProgress).toHaveBeenCalledWith(1, 2);
		expect(onProgress).toHaveBeenCalledWith(2, 2);
	});

	it('returns empty array when all refs are null', async () => {
		const ref = { current: null } as React.RefObject<HTMLElement | null>;

		const result = await captureAllSlidesAsPngDataUrls(ref, 2, vi.fn<() => void>(), 0);

		expect(result).toStrictEqual([]);
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
	it('builds a single-page PDF and downloads it', async () => {
		const el = makeMockElement();
		await exportSlideAsPdf(el, 3);

		expect(renderElementToCanvas).toHaveBeenCalledWith(el, 2, undefined);
		expect(buildPdfFromImageData).toHaveBeenCalledOnce();
		const canvases = vi.mocked(buildPdfFromImageData).mock.calls[0][0];
		expect(canvases).toHaveLength(1);
		expect(downloadDataUrl).toHaveBeenCalledWith('blob:mock-pdf-url', 'slide-4.pdf');
	});

	it('passes custom scale and backgroundColor', async () => {
		const el = makeMockElement();
		await exportSlideAsPdf(el, 0, { scale: 3, backgroundColor: '#FFFFFF' });

		expect(renderElementToCanvas).toHaveBeenCalledWith(el, 3, '#FFFFFF');
	});
});
