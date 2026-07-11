import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import type { Store, ViewerState } from '../state';
import { runGifExport } from './export-gif';
import type { ExportCaptureDeps } from './export-types';

/**
 * Unit tests for the GIF export runner. The capture layer is mocked (fake
 * canvases carrying deterministic pixel data), matching the
 * export-controller.test.ts pattern; the shared encoder runs for real so the
 * downloaded bytes are validated as a genuine GIF89a stream.
 */

const WIDTH = 4;
const HEIGHT = 3;

function fakeImageData(width: number, height: number): ImageData {
	return {
		data: new Uint8ClampedArray(width * height * 4).fill(128),
		width,
		height,
		colorSpace: 'srgb',
	} as ImageData;
}

function fakeCanvas(width = WIDTH, height = HEIGHT): HTMLCanvasElement {
	return {
		width,
		height,
		getContext: () => ({ getImageData: () => fakeImageData(width, height) }),
	} as unknown as HTMLCanvasElement;
}

function makeSlides(n: number): PptxSlide[] {
	return Array.from(
		{ length: n },
		(_, i) => ({ id: `s${i}`, rId: `rId${i}`, slideNumber: i + 1, elements: [] }) as PptxSlide,
	);
}

function makeDeps(
	slideCount: number,
): ExportCaptureDeps & { rasterizeSlide: ReturnType<typeof vi.fn> } {
	const store: Store<ViewerState> = createStore(createInitialViewerState());
	store.set({ slides: makeSlides(slideCount), canvasSize: { width: WIDTH, height: HEIGHT } });
	return {
		store,
		rasterizeSlide: vi.fn().mockImplementation(async () => fakeCanvas()),
		baseName: 'deck',
	};
}

describe('runGifExport', () => {
	let createdBlobs: Blob[];
	let downloadNames: string[];
	let clicks: number;
	let origCreateObjectURL: typeof URL.createObjectURL;
	let origRevokeObjectURL: typeof URL.revokeObjectURL;

	beforeEach(() => {
		createdBlobs = [];
		downloadNames = [];
		clicks = 0;
		// happy-dom's URL may lack createObjectURL; stub the pair the shared
		// downloadBlob helper uses and capture the Blob it is handed.
		origCreateObjectURL = URL.createObjectURL;
		origRevokeObjectURL = URL.revokeObjectURL;
		URL.createObjectURL = (obj: Blob | MediaSource) => {
			createdBlobs.push(obj as Blob);
			return 'blob:mock';
		};
		URL.revokeObjectURL = () => {};
		const orig = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
			const el = orig(tag) as HTMLElement;
			if (tag === 'a') {
				const anchor = el as HTMLAnchorElement;
				anchor.click = () => {
					clicks += 1;
					downloadNames.push(anchor.download);
				};
			}
			return el;
		});
	});

	afterEach(() => {
		URL.createObjectURL = origCreateObjectURL;
		URL.revokeObjectURL = origRevokeObjectURL;
		vi.restoreAllMocks();
	});

	it('captures every slide and downloads a GIF89a blob', async () => {
		const deps = makeDeps(3);
		await runGifExport(deps, { slideDurationMs: 500 });

		expect(deps.rasterizeSlide.mock.calls.map((c) => c[0])).toStrictEqual([0, 1, 2]);
		expect(clicks).toBe(1);
		expect(downloadNames).toStrictEqual(['deck.gif']);
		expect(createdBlobs).toHaveLength(1);
		expect(createdBlobs[0].type).toBe('image/gif');
		const bytes = new Uint8Array(await createdBlobs[0].arrayBuffer());
		const header = String.fromCharCode(...bytes.slice(0, 6));
		expect(header).toBe('GIF89a');
		// Trailer byte closes the stream.
		expect(bytes[bytes.length - 1]).toBe(0x3b);
	});

	it('reports per-slide progress plus a final completion tick', async () => {
		const deps = makeDeps(2);
		const onProgress = vi.fn();
		await runGifExport(deps, { onProgress });

		expect(onProgress.mock.calls).toStrictEqual([
			[0, 2],
			[1, 2],
			[2, 2],
		]);
	});

	it('honours per-slide timing overrides via the shared plan', async () => {
		const deps = makeDeps(3);
		await runGifExport(deps, { slideDurationMs: 1000, slideTimingsMs: [500, 1000, 1500] });

		const bytes = new Uint8Array(await createdBlobs[0].arrayBuffer());
		// Scan for Graphic Control Extensions (0x21 0xF9 0x04) and read each
		// frame's little-endian delay (centiseconds) at offset +4.
		const delays: number[] = [];
		for (let i = 0; i + 7 < bytes.length; i++) {
			if (
				bytes[i] === 0x21 &&
				bytes[i + 1] === 0xf9 &&
				bytes[i + 2] === 0x04 &&
				bytes[i + 6] === 0x00 &&
				bytes[i + 7] === 0x00
			) {
				delays.push(bytes[i + 4] | (bytes[i + 5] << 8));
			}
		}
		expect(delays).toStrictEqual([50, 100, 150]);
	});

	it('does nothing when there are no slides', async () => {
		const deps = makeDeps(0);
		await runGifExport(deps);
		expect(deps.rasterizeSlide).not.toHaveBeenCalled();
		expect(clicks).toBe(0);
	});

	it('aborts between slide captures with the shared AbortError', async () => {
		const controller = new AbortController();
		const deps = makeDeps(3);
		deps.rasterizeSlide.mockImplementation(async (index: number) => {
			if (index === 0) {
				controller.abort();
			}
			return fakeCanvas();
		});

		await expect(runGifExport(deps, { signal: controller.signal })).rejects.toThrow(
			'Export cancelled',
		);
		expect(deps.rasterizeSlide).toHaveBeenCalledOnce();
		expect(clicks).toBe(0);
	});

	it('downscales oversized captures via the shared dimension clamp', async () => {
		const deps = makeDeps(1);
		const drawImage = vi.fn();
		const scaledCanvas = {
			width: 0,
			height: 0,
			getContext: () => ({
				drawImage,
				getImageData: (_x: number, _y: number, w: number, h: number) => fakeImageData(w, h),
			}),
		};
		const bigCanvas = {
			width: 400,
			height: 200,
			ownerDocument: { createElement: () => scaledCanvas },
			getContext: () => ({ getImageData: () => fakeImageData(400, 200) }),
		} as unknown as HTMLCanvasElement;
		deps.rasterizeSlide.mockResolvedValue(bigCanvas);

		await runGifExport(deps, { maxDimension: 100 });

		// 400x200 clamped to the 100px cap preserves the 2:1 aspect ratio.
		expect(scaledCanvas.width).toBe(100);
		expect(scaledCanvas.height).toBe(50);
		expect(drawImage).toHaveBeenCalledWith(bigCanvas, 0, 0, 100, 50);
		expect(clicks).toBe(1);
	});
});
