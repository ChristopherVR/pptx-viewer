/**
 * `runGifExport`'s post-capture size cap: before this module existed, Vue's
 * GIF export never downscaled an oversized captured frame (unlike Angular,
 * Svelte, and Vanilla), so a high Default Resolution setting produced an
 * unbounded GIF. Capture scale itself is exercised in `useMediaExport.test.ts`
 * (it already flows through the injected `rasterizeSlide`).
 */
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import type { GifFrame } from './gif-encoder';
import { runGifExport } from './useGifExport';

function fakeCanvas(width: number, height: number): HTMLCanvasElement {
	const imageData = { data: new Uint8ClampedArray(width * height * 4), width, height };
	return {
		width,
		height,
		ownerDocument: document,
		getContext: () => ({ getImageData: () => imageData, drawImage: vi.fn() }),
	} as unknown as HTMLCanvasElement;
}

describe('runGifExport post-capture cap', () => {
	it('leaves a frame within the default 1920px cap untouched', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas(800, 600)),
			encodeGif = vi.fn((frames: GifFrame[]) => new Uint8Array([frames.length])),
			exporting = ref(false),
			progress = ref(0);

		await runGifExport({
			slideCount: ref(1),
			rasterizeSlide,
			loadGifEncoder: () => Promise.resolve(encodeGif),
			downloadBlob: vi.fn(),
			exporting,
			progress,
		});

		expect(encodeGif.mock.calls[0][0]).toStrictEqual([
			expect.objectContaining({ width: 800, height: 600 }),
		]);
	});

	it('downscales a captured frame larger than maxSide before encoding', async () => {
		const scaledCanvas = {
				width: 0,
				height: 0,
				getContext: () => ({
					drawImage: vi.fn(),
					getImageData: () => ({ data: [], width: 0, height: 0 }),
				}),
			},
			bigCanvas = fakeCanvas(4000, 2000);
		vi.spyOn(bigCanvas.ownerDocument, 'createElement').mockReturnValue(
			scaledCanvas as unknown as HTMLCanvasElement,
		);
		const rasterizeSlide = vi.fn().mockResolvedValue(bigCanvas),
			encodeGif = vi.fn((frames: GifFrame[]) => new Uint8Array([frames.length])),
			exporting = ref(false),
			progress = ref(0);

		await runGifExport(
			{
				slideCount: ref(1),
				rasterizeSlide,
				loadGifEncoder: () => Promise.resolve(encodeGif),
				downloadBlob: vi.fn(),
				exporting,
				progress,
			},
			{ maxSide: 1000 },
		);

		// 4000x2000 clamped to maxSide 1000 on the longer side -> 1000x500.
		expect(scaledCanvas.width).toBe(1000);
		expect(scaledCanvas.height).toBe(500);

		vi.restoreAllMocks();
	});

	it('defaults maxSide to the shared GIF_POST_CAPTURE_MAX_SIDE (1920px)', async () => {
		const scaledCanvas = {
				width: 0,
				height: 0,
				getContext: () => ({
					drawImage: vi.fn(),
					getImageData: () => ({ data: [], width: 0, height: 0 }),
				}),
			},
			bigCanvas = fakeCanvas(3840, 2160);
		vi.spyOn(bigCanvas.ownerDocument, 'createElement').mockReturnValue(
			scaledCanvas as unknown as HTMLCanvasElement,
		);
		const rasterizeSlide = vi.fn().mockResolvedValue(bigCanvas),
			encodeGif = vi.fn((frames: GifFrame[]) => new Uint8Array([frames.length])),
			exporting = ref(false),
			progress = ref(0);

		await runGifExport({
			slideCount: ref(1),
			rasterizeSlide,
			loadGifEncoder: () => Promise.resolve(encodeGif),
			downloadBlob: vi.fn(),
			exporting,
			progress,
		});

		expect(scaledCanvas.width).toBe(1920);
		expect(scaledCanvas.height).toBe(1080);

		vi.restoreAllMocks();
	});
});
