import { describe, expect, it, vi } from 'vitest';

import type { RecorderLike, VideoCaptureDeps } from './export-video';
import { exportSlidesToWebmBlob } from './export-video';

/**
 * Unit tests for the WebM recording pipeline. `MediaRecorder` and the canvas
 * capture stream are mocked through the injected `createCanvas` /
 * `createRecorder` seams; the shared `planVideoSegments` timing maths runs for
 * real. Durations are kept tiny so the frame-pacing sleeps stay in the tens of
 * milliseconds (no fake timers needed).
 */

class FakeRecorder implements RecorderLike {
	started = false;
	stopped = false;
	ondataavailable: ((event: { data: Blob }) => void) | null = null;
	onstop: (() => void) | null = null;
	onerror: ((event: unknown) => void) | null = null;

	start(): void {
		this.started = true;
	}

	stop(): void {
		if (this.stopped) {
			return;
		}
		this.stopped = true;
		queueMicrotask(() => {
			this.ondataavailable?.({ data: new Blob(['webm-bytes'], { type: 'video/webm' }) });
			this.onstop?.();
		});
	}
}

interface Harness {
	deps: VideoCaptureDeps;
	recorder: FakeRecorder;
	recorderOptions: () => MediaRecorderOptions | undefined;
	drawImage: ReturnType<typeof vi.fn>;
	rasterizeSlide: ReturnType<typeof vi.fn>;
}

function make(overrides: Partial<VideoCaptureDeps> = {}): Harness {
	const recorder = new FakeRecorder();
	let capturedOptions: MediaRecorderOptions | undefined;
	const drawImage = vi.fn();
	const rasterizeSlide = vi
		.fn()
		.mockImplementation(async () => ({ width: 320, height: 180 }) as unknown as HTMLCanvasElement);
	const deps: VideoCaptureDeps = {
		getSlideCount: () => 2,
		rasterizeSlide,
		createCanvas: (width, height) =>
			({
				width,
				height,
				getContext: () => ({ clearRect: vi.fn(), drawImage }),
				captureStream: () => ({}) as MediaStream,
			}) as unknown as HTMLCanvasElement,
		createRecorder: (_stream, options) => {
			capturedOptions = options;
			return recorder;
		},
		...overrides,
	};
	return { deps, recorder, recorderOptions: () => capturedOptions, drawImage, rasterizeSlide };
}

describe('exportSlidesToWebmBlob', () => {
	it('captures every slide, records each planned segment, and returns a webm blob', async () => {
		const harness = make();
		const onProgress = vi.fn();
		const onRecordProgress = vi.fn();
		// 40 ms @ 30 fps -> 2 frames per slide (shared segmentFrameCount maths).
		const blob = await exportSlidesToWebmBlob(harness.deps, {
			slideDurationMs: 40,
			onProgress,
			onRecordProgress,
		});

		expect(blob.type).toBe('video/webm');
		expect(blob.size).toBeGreaterThan(0);
		expect(harness.rasterizeSlide).toHaveBeenCalledTimes(2);
		expect(harness.recorder.started).toBeTruthy();
		expect(harness.recorder.stopped).toBeTruthy();
		expect(harness.drawImage).toHaveBeenCalledTimes(4);
		expect(onProgress.mock.calls).toStrictEqual([
			[0, 2],
			[1, 2],
			[2, 2],
		]);
		expect(onRecordProgress.mock.calls).toStrictEqual([
			[0, 2],
			[1, 2],
		]);
	});

	it('honours per-slide timing overrides from the shared video plan', async () => {
		const harness = make();
		// 30 fps: 40 ms -> 2 frames, 100 ms -> 3 frames.
		await exportSlidesToWebmBlob(harness.deps, {
			slideDurationMs: 40,
			slideTimingsMs: [40, 100],
		});
		expect(harness.drawImage).toHaveBeenCalledTimes(5);
	});

	it('configures the recorder with a webm mime type and the bitrate', async () => {
		const harness = make();
		await exportSlidesToWebmBlob(harness.deps, { slideDurationMs: 40, videoBitsPerSecond: 123 });
		const options = harness.recorderOptions();
		expect(options?.mimeType).toMatch(/^video\/webm/u);
		expect(options?.videoBitsPerSecond).toBe(123);
	});

	it('rejects immediately when the signal is already aborted', async () => {
		const harness = make();
		const abort = new AbortController();
		abort.abort();
		await expect(exportSlidesToWebmBlob(harness.deps, { signal: abort.signal })).rejects.toThrow(
			'Export cancelled',
		);
		expect(harness.rasterizeSlide).not.toHaveBeenCalled();
	});

	it('stops the recorder when the signal aborts during recording', async () => {
		const harness = make();
		const abort = new AbortController();
		await expect(
			exportSlidesToWebmBlob(harness.deps, {
				slideDurationMs: 40,
				signal: abort.signal,
				onRecordProgress: (current) => {
					if (current === 1) {
						abort.abort();
					}
				},
			}),
		).rejects.toThrow('Export cancelled');
		expect(harness.recorder.stopped).toBeTruthy();
	});

	it('throws when there are no slides', async () => {
		const harness = make({ getSlideCount: () => 0 });
		await expect(exportSlidesToWebmBlob(harness.deps)).rejects.toThrow('no slides');
	});
});
