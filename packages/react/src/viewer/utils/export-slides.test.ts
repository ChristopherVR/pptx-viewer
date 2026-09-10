import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
	downloadBlob,
	renderElementToClampedCanvas,
	renderElementToRaster,
	rasterResultToPngBlob,
} from './export-helpers';
import {
	exportSlideToPngBlob,
	exportSlideAsPng,
	captureAllSlidesAsPngDataUrls,
} from './export-slides';

// ---------------------------------------------------------------------------
// Mock external dependencies before importing the module under test.
// ---------------------------------------------------------------------------

// Mock export-helpers to avoid DOM/canvas dependencies
vi.mock<typeof import('./export-helpers')>(import('./export-helpers'), () => ({
	downloadBlob: vi.fn<() => void>(),
	downloadDataUrl: vi.fn<() => void>(),
	renderElementToRaster: vi.fn<() => void>(),
	renderElementToTiles: vi.fn<() => void>(),
	renderElementToClampedCanvas: vi.fn(() =>
		Promise.resolve({
			kind: 'canvas' as const,
			canvas: makeMockCanvas(),
			strategy: 'foreignObject' as const,
			width: 1920,
			height: 1080,
			clamped: false,
			effectiveScale: 2,
		}),
	),
	rasterResultToPngBlob: vi.fn<() => void>(),
	waitForRender: vi.fn(() => Promise.resolve()),
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
	// Default: renderElementToClampedCanvas returns a mock canvas (the path
	// captureAllSlidesAsPngDataUrls now uses, instead of raw html2canvas).
	vi.mocked(renderElementToClampedCanvas).mockResolvedValue({
		kind: 'canvas',
		canvas: makeMockCanvas(),
		strategy: 'foreignObject',
		width: 1920,
		height: 1080,
		clamped: false,
		effectiveScale: 2,
	});
	// Default: renderElementToRaster resolves the common (untiled) canvas case,
	// and rasterResultToPngBlob converts it to a PNG Blob, mirroring the real
	// (unmocked) implementation closely enough for these unit tests.
	vi.mocked(renderElementToRaster).mockResolvedValue({
		kind: 'canvas',
		canvas: makeMockCanvas(),
		strategy: 'foreignObject',
		width: 1920,
		height: 1080,
	});
	vi.mocked(rasterResultToPngBlob).mockResolvedValue(
		new Blob(['mock-png-data'], { type: 'image/png' }),
	);
});

// ---------------------------------------------------------------------------
// exportSlideToPngBlob
// ---------------------------------------------------------------------------

describe('exportSlideToPngBlob', () => {
	it('calls renderElementToRaster with default scale of 2', async () => {
		const el = makeMockElement();
		await exportSlideToPngBlob(el);

		expect(renderElementToRaster).toHaveBeenCalledWith(el, 2, undefined);
	});

	it('passes custom scale to renderElementToRaster', async () => {
		const el = makeMockElement();
		await exportSlideToPngBlob(el, { scale: 4 });

		expect(renderElementToRaster).toHaveBeenCalledWith(el, 4, undefined);
	});

	it('passes custom backgroundColor to renderElementToRaster', async () => {
		const el = makeMockElement();
		await exportSlideToPngBlob(el, { backgroundColor: '#FF0000' });

		expect(renderElementToRaster).toHaveBeenCalledWith(el, 2, '#FF0000');
	});

	it('returns a PNG Blob', async () => {
		const el = makeMockElement();
		const blob = await exportSlideToPngBlob(el);

		expect(blob).toBeInstanceOf(Blob);
	});

	it('propagates a rasterResultToPngBlob failure (e.g. tainted-canvas toBlob null)', async () => {
		vi.mocked(rasterResultToPngBlob).mockRejectedValue(new Error('Canvas toBlob returned null'));

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

	it('captures via the clamped foreignObject-fidelity path, not raw html2canvas', async () => {
		const stageEl = makeMockElement();
		const ref = { current: stageEl } as React.RefObject<HTMLElement | null>;

		await captureAllSlidesAsPngDataUrls(ref, 2, vi.fn<() => void>(), 0, { scale: 3 });

		expect(renderElementToClampedCanvas).toHaveBeenCalledTimes(2);
		expect(renderElementToClampedCanvas).toHaveBeenCalledWith(stageEl, 3);
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
