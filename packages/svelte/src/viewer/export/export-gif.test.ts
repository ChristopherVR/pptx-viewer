import { describe, expect, it, vi } from 'vitest';

import type { GifCaptureDeps } from './export-gif';
import { exportSlidesToGifBlob } from './export-gif';

/**
 * Unit tests for the GIF capture/encode pipeline. The capture layer is mocked
 * (fake source canvases + an injected `createCanvas` whose 2D context returns
 * deterministic pixels), while the shared `planGifFrames`/`encodeGif` run for
 * real, so the assertions cover the actual GIF89a byte stream (header,
 * per-frame plan delays).
 */

function makeImageData(width: number, height: number): ImageData {
	const data = new Uint8ClampedArray(width * height * 4);
	data.fill(128);
	return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

function fakeSourceCanvas(width: number, height: number): HTMLCanvasElement {
	return { width, height } as unknown as HTMLCanvasElement;
}

interface CanvasFactory {
	createCanvas: (width: number, height: number) => HTMLCanvasElement;
	created: Array<{ width: number; height: number }>;
	drawImage: ReturnType<typeof vi.fn>;
}

function fakeCanvasFactory(): CanvasFactory {
	const created: Array<{ width: number; height: number }> = [];
	const drawImage = vi.fn();
	return {
		created,
		drawImage,
		createCanvas: (width, height) => {
			created.push({ width, height });
			const ctx = {
				drawImage,
				getImageData: (_x: number, _y: number, w: number, h: number) => makeImageData(w, h),
			};
			return { width, height, getContext: () => ctx } as unknown as HTMLCanvasElement;
		},
	};
}

function make(
	overrides: Partial<GifCaptureDeps> = {},
	factory: CanvasFactory = fakeCanvasFactory(),
): GifCaptureDeps {
	return {
		getSlideCount: () => 3,
		rasterizeSlide: vi.fn().mockImplementation(async () => fakeSourceCanvas(200, 100)),
		createCanvas: factory.createCanvas,
		...overrides,
	};
}

/** Scan the encoded bytes for every Graphic Control Extension frame delay (cs). */
function readFrameDelays(bytes: Uint8Array): number[] {
	const delays: number[] = [];
	for (let i = 0; i < bytes.length - 6; i++) {
		if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 0x04) {
			delays.push(bytes[i + 4] | (bytes[i + 5] << 8));
		}
	}
	return delays;
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
	return new Uint8Array(await blob.arrayBuffer());
}

describe('exportSlidesToGifBlob', () => {
	it('encodes every slide into a GIF89a blob', async () => {
		const deps = make();
		const blob = await exportSlidesToGifBlob(deps);

		expect(blob.type).toBe('image/gif');
		const bytes = await blobBytes(blob);
		expect(String.fromCharCode(...bytes.slice(0, 6))).toBe('GIF89a');
		expect(deps.rasterizeSlide).toHaveBeenCalledTimes(3);
		// One image descriptor (0x2c at frame starts) per slide.
		expect(readFrameDelays(bytes)).toHaveLength(3);
	});

	it('applies the shared frame plan: default duration + per-slide overrides', async () => {
		const blob = await exportSlidesToGifBlob(make(), {
			slideDurationMs: 2000,
			slideTimingsMs: [500, undefined as unknown as number, 3000],
		});
		const delays = readFrameDelays(await blobBytes(blob));
		expect(delays).toStrictEqual([50, 200, 300]);
	});

	it('clamps oversized captures to maxDimension preserving aspect ratio', async () => {
		const factory = fakeCanvasFactory();
		const deps = make(
			{
				getSlideCount: () => 1,
				rasterizeSlide: vi.fn().mockResolvedValue(fakeSourceCanvas(4000, 2000)),
			},
			factory,
		);
		await exportSlidesToGifBlob(deps);
		expect(factory.created[0]).toStrictEqual({ width: 960, height: 480 });
		expect(factory.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 960, 480);
	});

	it('reports per-slide progress including the final completion tick', async () => {
		const onProgress = vi.fn();
		await exportSlidesToGifBlob(make(), { onProgress });
		expect(onProgress.mock.calls).toStrictEqual([
			[0, 3],
			[1, 3],
			[2, 3],
			[3, 3],
		]);
	});

	it('rejects immediately when the signal is already aborted', async () => {
		const abort = new AbortController();
		abort.abort();
		const deps = make();
		await expect(exportSlidesToGifBlob(deps, { signal: abort.signal })).rejects.toThrow(
			'Export cancelled',
		);
		expect(deps.rasterizeSlide).not.toHaveBeenCalled();
	});

	it('stops capturing once the signal aborts mid-run', async () => {
		const abort = new AbortController();
		const rasterizeSlide = vi.fn().mockImplementation(async (index: number) => {
			if (index === 1) {
				abort.abort();
			}
			return fakeSourceCanvas(200, 100);
		});
		await expect(
			exportSlidesToGifBlob(make({ rasterizeSlide }), { signal: abort.signal }),
		).rejects.toThrow('Export cancelled');
		// Slides 0 and 1 captured; the abort is observed before slide 2.
		expect(rasterizeSlide).toHaveBeenCalledTimes(2);
	});

	it('throws when there are no slides', async () => {
		await expect(exportSlidesToGifBlob(make({ getSlideCount: () => 0 }))).rejects.toThrow(
			'no slides',
		);
	});
});
