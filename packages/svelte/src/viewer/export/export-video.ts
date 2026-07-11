import {
	exportAbortError,
	fpsToFrameIntervalMs,
	pickSupportedMimeType,
	planVideoSegments,
	WEBM_MIME_CANDIDATES,
} from 'pptx-viewer-shared';

import type { ExportProgress, RasterizeSlide } from './export-controller.svelte';

/**
 * Video (WebM) export driven by the shared `video-plan` maths: segment timing
 * comes from `planVideoSegments` (default duration + per-slide overrides +
 * fps -> frame count), the frame pacing from `fpsToFrameIntervalMs`, and the
 * recorder MIME type from `pickSupportedMimeType(WEBM_MIME_CANDIDATES)`. This
 * module owns the browser glue only: rasterise every slide first (capture
 * phase), then replay each canvas onto a recording canvas whose
 * `captureStream()` feeds a `MediaRecorder` (recording phase). Mirrors
 * React's `exportAllSlidesAsVideo`, minus the live-stage slide flipping (the
 * injected rasteriser renders off-screen instead).
 */

/** Options for the WebM video export. */
export interface ExportVideoOptions {
	/** Duration each slide is shown, in milliseconds. Default 3000. */
	slideDurationMs?: number;
	/** Per-slide duration overrides in milliseconds (index maps to slide index). */
	slideTimingsMs?: number[];
	/** Recording frame rate. Default 30. */
	fps?: number;
	/** Recorder bitrate. Default 5,000,000 (5 Mbps). */
	videoBitsPerSecond?: number;
	/** Capture-phase progress callback: `(currentSlide, totalSlides)`. */
	onProgress?: ExportProgress;
	/** Recording-phase progress callback: `(currentSlide, totalSlides)`. */
	onRecordProgress?: ExportProgress;
	/** Abort the export early; checked between slides and between frames. */
	signal?: AbortSignal;
}

/** The `MediaRecorder` surface this module drives (mockable in unit tests). */
export interface RecorderLike {
	start(): void;
	stop(): void;
	ondataavailable: ((event: { data: Blob }) => void) | null;
	onstop: (() => void) | null;
	onerror: ((event: unknown) => void) | null;
}

/** Injected capture/recording dependencies (kept DOM-free for unit tests). */
export interface VideoCaptureDeps {
	/** Live slide count; read fresh on every call. */
	getSlideCount(): number;
	rasterizeSlide: RasterizeSlide;
	/** Canvas factory override (test seam). Defaults to `document.createElement`. */
	createCanvas?: (width: number, height: number) => HTMLCanvasElement;
	/** Recorder factory override (test seam). Defaults to `new MediaRecorder`. */
	createRecorder?: (stream: MediaStream, options: MediaRecorderOptions) => RecorderLike;
}

function defaultCreateCanvas(width: number, height: number): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

function defaultCreateRecorder(stream: MediaStream, options: MediaRecorderOptions): RecorderLike {
	// MediaRecorder's `ondataavailable` is declared against the full BlobEvent;
	// RecorderLike only needs `{ data: Blob }` (a supertype of BlobEvent), so
	// the structural mismatch is a declaration nit, not a runtime one.
	return new MediaRecorder(stream, options) as unknown as RecorderLike;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

/**
 * Capture every slide and record the sequence as a WebM video Blob, holding
 * each slide for its planned duration. Rejects with the shared `AbortError`
 * when `signal` aborts (the recorder is stopped first).
 */
export async function exportSlidesToWebmBlob(
	deps: VideoCaptureDeps,
	options: ExportVideoOptions = {},
): Promise<Blob> {
	const {
		slideDurationMs = 3000,
		slideTimingsMs,
		fps = 30,
		videoBitsPerSecond = 5_000_000,
		onProgress,
		onRecordProgress,
		signal,
	} = options;
	const total = deps.getSlideCount();
	if (total === 0) {
		throw new Error('Video export failed: no slides to export');
	}
	const createCanvas = deps.createCanvas ?? defaultCreateCanvas;
	const createRecorder = deps.createRecorder ?? defaultCreateRecorder;

	// Phase 1: capture every slide up front so recording is not paced by
	// html2canvas latency.
	const slideCanvases: HTMLCanvasElement[] = [];
	for (let i = 0; i < total; i++) {
		if (signal?.aborted) {
			throw exportAbortError();
		}
		onProgress?.(i, total);
		slideCanvases.push(await deps.rasterizeSlide(i));
	}

	// Phase 2: replay the canvases into a MediaRecorder-backed stream.
	const first = slideCanvases[0];
	const recordingCanvas = createCanvas(first.width, first.height);
	const ctx = recordingCanvas.getContext('2d');
	if (!ctx) {
		throw new Error('Video export failed: 2D canvas context unavailable');
	}
	const stream = recordingCanvas.captureStream(fps);
	const recorder = createRecorder(stream, {
		mimeType: pickSupportedMimeType([...WEBM_MIME_CANDIDATES]),
		videoBitsPerSecond,
	});

	const chunks: Blob[] = [];
	recorder.ondataavailable = (event) => {
		if (event.data.size > 0) {
			chunks.push(event.data);
		}
	};
	const recorderDone = new Promise<void>((resolve, reject) => {
		recorder.onstop = () => resolve();
		recorder.onerror = (event) => reject(new Error(`Video export failed: ${String(event)}`));
	});

	recorder.start();
	const frameIntervalMs = fpsToFrameIntervalMs(fps);
	const segments = planVideoSegments({ totalSlides: total, slideDurationMs, slideTimingsMs, fps });
	for (const segment of segments) {
		onRecordProgress?.(segment.slideIndex, total);
		const canvas = slideCanvases[segment.slideIndex];
		for (let f = 0; f < segment.frameCount; f++) {
			if (signal?.aborted) {
				recorder.stop();
				throw exportAbortError();
			}
			// Redraw the same frame each tick to keep feeding the capture stream.
			ctx.clearRect(0, 0, recordingCanvas.width, recordingCanvas.height);
			ctx.drawImage(canvas, 0, 0);
			await sleep(frameIntervalMs);
		}
	}

	recorder.stop();
	await recorderDone;
	onProgress?.(total, total);
	return new Blob(chunks, { type: 'video/webm' });
}
