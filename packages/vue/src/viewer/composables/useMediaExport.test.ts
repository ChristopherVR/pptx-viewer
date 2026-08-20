/* oxlint-disable eslint/one-var -- many independent `it()` blocks, each with
   its own short arrange/act/assert consts. */
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import type { GifFrame } from './gif-encoder';
import { useMediaExport } from './useMediaExport';
import type { MediaRecorderFactory } from './useMediaExport';

/** A fake 2D context that returns deterministic ImageData. */
function fakeContext(width: number, height: number): CanvasRenderingContext2D {
	return {
		getImageData: () =>
			({ data: new Uint8ClampedArray(width * height * 4), width, height }) as ImageData,
		clearRect: vi.fn(),
		drawImage: vi.fn(),
	} as unknown as CanvasRenderingContext2D;
}

/** A fake canvas whose `getContext` yields the fake 2D context. */
function fakeCanvas(width = 4, height = 4): HTMLCanvasElement {
	return {
		width,
		height,
		getContext: () => fakeContext(width, height),
	} as unknown as HTMLCanvasElement;
}

/** A controllable fake `MediaRecorder` that fires `onstop` synchronously. */
function makeRecorderFactory(): {
	factory: MediaRecorderFactory;
	starts: number;
	stops: number;
} {
	const state = { starts: 0, stops: 0 },
		factory: MediaRecorderFactory = () => {
			const recorder = {
				ondataavailable: null as ((e: BlobEvent) => void) | null,
				onstop: null as (() => void) | null,
				onerror: null as (() => void) | null,
				start() {
					state.starts++;
				},
				stop() {
					state.stops++;
					this.ondataavailable?.({ data: new Blob(['x']) } as BlobEvent);
					this.onstop?.();
				},
			};
			return recorder as unknown as MediaRecorder;
		};
	return {
		factory,
		get starts() {
			return state.starts;
		},
		get stops() {
			return state.stops;
		},
	};
}

describe('useMediaExport - GIF', () => {
	it('rasterises every slide, encodes a GIF, and downloads it', async () => {
		const rasterizeSlide = vi.fn().mockResolvedValue(fakeCanvas()),
			encodeGif = vi.fn((frames: GifFrame[]) => new Uint8Array([frames.length])),
			downloadBlob = vi.fn(),
			{ exportGif, exporting, progress } = useMediaExport({
				slideCount: ref(3),
				rasterizeSlide,
				loadGifEncoder: () => Promise.resolve(encodeGif),
				downloadBlob,
			}),
			blob = await exportGif();
		expect(rasterizeSlide).toHaveBeenCalledTimes(3);
		expect(encodeGif).toHaveBeenCalledOnce();
		expect(encodeGif.mock.calls[0][0]).toHaveLength(3);
		expect(downloadBlob).toHaveBeenCalledOnce();
		expect(downloadBlob.mock.calls[0][1]).toBe('presentation.gif');
		expect(blob?.type).toBe('image/gif');
		expect(exporting.value).toBeFalsy();
		expect(progress.value).toBe(100);
	});

	it('derives the download name from a plain-string fileName, stripping a known extension', async () => {
		const encodeGif = vi.fn(() => new Uint8Array([0])),
			downloadBlob = vi.fn(),
			{ exportGif } = useMediaExport({
				slideCount: ref(1),
				rasterizeSlide: vi.fn().mockResolvedValue(fakeCanvas()),
				loadGifEncoder: () => Promise.resolve(encodeGif),
				downloadBlob,
				fileName: 'My Deck.pptx',
			});
		await exportGif();
		expect(downloadBlob.mock.calls[0][1]).toBe('My Deck.gif');
	});

	it('derives the download name from a Ref<string> fileName, unwrapped before stripping', async () => {
		const encodeGif = vi.fn(() => new Uint8Array([0])),
			downloadBlob = vi.fn(),
			{ exportGif } = useMediaExport({
				slideCount: ref(1),
				rasterizeSlide: vi.fn().mockResolvedValue(fakeCanvas()),
				loadGifEncoder: () => Promise.resolve(encodeGif),
				downloadBlob,
				fileName: ref('Quarterly.pdf'),
			});
		await exportGif();
		expect(downloadBlob.mock.calls[0][1]).toBe('Quarterly.gif');
	});

	it('passes a per-slide delay in centiseconds when timings are uniform', async () => {
		const encodeGif = vi.fn(() => new Uint8Array([0])),
			{ exportGif } = useMediaExport({
				slideCount: ref(2),
				rasterizeSlide: vi.fn().mockResolvedValue(fakeCanvas()),
				loadGifEncoder: () => Promise.resolve(encodeGif),
				downloadBlob: vi.fn(),
			});

		await exportGif({ slideTimingsMs: [500, 500] });
		expect(encodeGif.mock.calls[0][1]).toBe(50); // 500ms / 10 = 50cs
	});

	it('returns undefined and does nothing when there are no slides', async () => {
		const rasterizeSlide = vi.fn(),
			{ exportGif } = useMediaExport({ slideCount: ref(0), rasterizeSlide });
		await expect(exportGif()).resolves.toBeUndefined();
		expect(rasterizeSlide).not.toHaveBeenCalled();
	});

	it('honours an abort signal before encoding', async () => {
		const controller = new AbortController();
		controller.abort();
		const encodeGif = vi.fn(),
			{ exportGif, exporting } = useMediaExport({
				slideCount: ref(2),
				rasterizeSlide: vi.fn().mockResolvedValue(fakeCanvas()),
				loadGifEncoder: () => Promise.resolve(encodeGif),
				downloadBlob: vi.fn(),
			});

		await expect(exportGif({ signal: controller.signal })).rejects.toThrow('cancelled');
		expect(encodeGif).not.toHaveBeenCalled();
		expect(exporting.value).toBeFalsy();
	});
});

describe('useMediaExport - WebM', () => {
	it('records every slide and downloads a webm blob', async () => {
		vi.useFakeTimers();
		const recorder = makeRecorderFactory(),
			downloadBlob = vi.fn(),
			{ exportWebm } = useMediaExport({
				slideCount: ref(2),
				rasterizeSlide: vi.fn().mockResolvedValue(fakeCanvas()),
				createRecorder: recorder.factory,
				createCanvas: () => fakeCanvas(),
				downloadBlob,
			}),
			promise = exportWebm({ slideDurationMs: 30, fps: 30 });
		await vi.runAllTimersAsync();
		const blob = await promise;

		expect(recorder.starts).toBe(1);
		expect(recorder.stops).toBe(1);
		expect(downloadBlob).toHaveBeenCalledOnce();
		expect(downloadBlob.mock.calls[0][1]).toBe('presentation.webm');
		expect(blob?.type).toBe('video/webm');
		vi.useRealTimers();
	});

	it('toggles the exporting flag across the run', async () => {
		vi.useFakeTimers();
		const recorder = makeRecorderFactory(),
			{ exportWebm, exporting } = useMediaExport({
				slideCount: ref(1),
				rasterizeSlide: vi.fn().mockResolvedValue(fakeCanvas()),
				createRecorder: recorder.factory,
				createCanvas: () => fakeCanvas(),
				downloadBlob: vi.fn(),
			});

		expect(exporting.value).toBeFalsy();
		const promise = exportWebm({ slideDurationMs: 30, fps: 30 });
		expect(exporting.value).toBeTruthy();
		await vi.runAllTimersAsync();
		await promise;
		expect(exporting.value).toBeFalsy();
		vi.useRealTimers();
	});

	it('returns undefined when there are no slides', async () => {
		const rasterizeSlide = vi.fn(),
			{ exportWebm } = useMediaExport({
				slideCount: ref(0),
				rasterizeSlide,
				createRecorder: makeRecorderFactory().factory,
			});
		await expect(exportWebm()).resolves.toBeUndefined();
		expect(rasterizeSlide).not.toHaveBeenCalled();
	});
});

describe('useMediaExport - real GIF encoder', () => {
	it('produces a valid GIF89a header via the lazy-loaded encoder', async () => {
		const downloadBlob = vi.fn(),
			{ exportGif } = useMediaExport({
				slideCount: ref(1),
				rasterizeSlide: vi.fn().mockResolvedValue(fakeCanvas(2, 2)),
				downloadBlob,
			}),
			blob = await exportGif();
		expect(blob).toBeTruthy();
		const bytes = new Uint8Array(await (blob as Blob).arrayBuffer());
		// "GIF89a" magic.
		expect(Array.from(bytes.slice(0, 6))).toStrictEqual([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
		expect(bytes[bytes.length - 1]).toBe(0x3b); // trailer
	});
});
