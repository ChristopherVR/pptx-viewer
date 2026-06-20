/**
 * Video (WebM) export helpers for the Angular viewer.
 *
 * The pure planning helpers (frame-segment timing, fps maths, MIME-type
 * selection) now live once in `pptx-viewer-shared` (`export/video-plan`),
 * inlined here at build time via `../internal/shared-src`. Only the thin
 * browser-facing `recordWebm()` driver (MediaRecorder over a canvas
 * `captureStream()`) stays local below.
 *
 * No new npm dependency is needed; `MediaRecorder` is a browser built-in.
 */

import {
	fpsToFrameIntervalMs,
	pickSupportedMimeType,
	segmentFrameCount,
	WEBM_MIME_CANDIDATES,
} from '../internal/shared-src/export/video-plan';

export {
	planVideoSegments,
	pickSupportedMimeType,
	fpsToFrameIntervalMs,
	segmentFrameCount,
	WEBM_MIME_CANDIDATES,
} from '../internal/shared-src/export/video-plan';
export type { VideoSegmentPlan, VideoPlanOptions } from '../internal/shared-src/export/video-plan';

/** Options for {@link recordWebm}. */
export interface RecordWebmOptions {
	/** Desired recording frame rate fed to `captureStream()` (default: 30). */
	fps?: number;
	/**
	 * Per-slide durations in milliseconds (index maps to slide order in `canvases`).
	 * When absent, `slideDurationMs` is used for every slide.
	 */
	slideTimingsMs?: number[];
	/** Default slide duration in milliseconds (default: 3000). */
	slideDurationMs?: number;
	/**
	 * MIME type for `MediaRecorder` (default: result of
	 * `pickSupportedMimeType(WEBM_MIME_CANDIDATES)`).
	 */
	mimeType?: string;
	/** Video bit rate in bits/s (default: 5_000_000 = 5 Mbps). */
	videoBitsPerSecond?: number;
	/** Optional `AbortSignal` to cancel the recording mid-way. */
	signal?: AbortSignal;
	/**
	 * Progress callback invoked at the start of each slide's recording segment.
	 * Receives `(currentSlide, totalSlides)`.
	 */
	onProgress?: (current: number, total: number) => void;
}

/**
 * Record an ordered list of pre-rendered slide canvases as a WebM video Blob.
 *
 * Strategy:
 * 1. Create an off-screen `recordingCanvas` sized to the first slide canvas.
 * 2. Start a `captureStream(fps)` + `MediaRecorder` on it.
 * 3. For each slide canvas, draw it repeatedly onto `recordingCanvas` for the
 *    slide's duration at `fps`, feeding frames to the stream.
 * 4. Stop the recorder and return the accumulated WebM Blob.
 *
 * @param canvases - Pre-rendered slide canvases in slide order.
 * @param opts     - Recording options.
 * @returns A `Promise<Blob>` resolving to a `video/webm` Blob.
 *
 * @throws `DOMException('Export cancelled', 'AbortError')` when `signal` fires.
 * @throws `Error` when no canvases are supplied or when 2D context creation fails.
 */
export async function recordWebm(
	canvases: HTMLCanvasElement[],
	opts: RecordWebmOptions = {},
): Promise<Blob> {
	if (canvases.length === 0) {
		throw new Error('[video-export-helpers] recordWebm: canvases array must not be empty');
	}

	const {
		fps = 30,
		slideTimingsMs,
		slideDurationMs = 3000,
		videoBitsPerSecond = 5_000_000,
		signal,
		onProgress,
	} = opts;

	const mimeType = opts.mimeType ?? pickSupportedMimeType([...WEBM_MIME_CANDIDATES]);

	const firstCanvas = canvases[0];
	const recordingCanvas = document.createElement('canvas');
	recordingCanvas.width = firstCanvas.width;
	recordingCanvas.height = firstCanvas.height;
	const ctx = recordingCanvas.getContext('2d');
	if (!ctx) {
		throw new Error('[video-export-helpers] recordWebm: failed to create 2D context');
	}

	const stream = recordingCanvas.captureStream(fps);
	const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond });

	const chunks: Blob[] = [];
	recorder.ondataavailable = (e) => {
		if (e.data.size > 0) {
			chunks.push(e.data);
		}
	};

	const recorderDone = new Promise<void>((resolve, reject) => {
		recorder.onstop = () => resolve();
		recorder.onerror = (e) => reject(e);
	});

	recorder.start();

	const frameIntervalMs = fpsToFrameIntervalMs(fps);

	for (let i = 0; i < canvases.length; i++) {
		if (signal?.aborted) {
			recorder.stop();
			throw new DOMException('Export cancelled', 'AbortError');
		}

		onProgress?.(i, canvases.length);

		const duration = slideTimingsMs?.[i] ?? slideDurationMs;
		const framesNeeded = segmentFrameCount(duration, fps);

		ctx.clearRect(0, 0, recordingCanvas.width, recordingCanvas.height);
		ctx.drawImage(canvases[i], 0, 0);

		for (let f = 0; f < framesNeeded; f++) {
			if (signal?.aborted) {
				recorder.stop();
				throw new DOMException('Export cancelled', 'AbortError');
			}
			ctx.drawImage(canvases[i], 0, 0);
			await new Promise<void>((resolve) => {
				setTimeout(resolve, frameIntervalMs);
			});
		}
	}

	recorder.stop();
	await recorderDone;

	return new Blob(chunks, { type: 'video/webm' });
}
