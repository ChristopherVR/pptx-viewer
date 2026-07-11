import {
	downloadBlob,
	exportAbortError,
	fpsToFrameIntervalMs,
	pickSupportedMimeType,
	planVideoSegments,
	WEBM_MIME_CANDIDATES,
} from 'pptx-viewer-shared';

import type { ExportCaptureDeps, ExportProgress } from './export-types';

/**
 * WebM video export for the vanilla binding, driven by the shared `video-plan`
 * module: `planVideoSegments` (per-slide segment timing + frame counts),
 * `fpsToFrameIntervalMs` (draw-loop pacing), and `pickSupportedMimeType` over
 * `WEBM_MIME_CANDIDATES` (MediaRecorder codec selection). Only the browser
 * driver lives here: capture each slide to a canvas, replay the canvases onto
 * a recording canvas fed to `captureStream()` + `MediaRecorder`, and download
 * the resulting Blob. Vanilla port of React's `exportAllSlidesAsVideo`.
 */

/** Options for the WebM video export (all slides). */
export interface ExportVideoOptions {
	/** Duration each slide is held, in milliseconds (default 3000). */
	slideDurationMs?: number;
	/** Per-slide duration overrides in milliseconds (index maps to slide index). */
	slideTimingsMs?: number[];
	/** Recording frame rate in frames per second (default 30). */
	fps?: number;
	/** MediaRecorder video bitrate in bits per second (default 5,000,000). */
	videoBitsPerSecond?: number;
	/** Capture-phase progress callback: `(currentSlide, totalSlides)`. */
	onProgress?: ExportProgress;
	/** Recording-phase progress callback: `(currentSlide, totalSlides)`. */
	onRecordProgress?: ExportProgress;
	/** Abort the export early; checked between slides and between frames. */
	signal?: AbortSignal;
}

/** Deps for {@link runVideoExport}; adds a sleep seam for fast unit tests. */
export interface ExportVideoDeps extends ExportCaptureDeps {
	/** Overridable frame-hold sleep (test seam). Defaults to `setTimeout`. */
	waitMs?: (ms: number) => Promise<void>;
}

function defaultWaitMs(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

interface RecordOptions {
	slideDurationMs: number;
	slideTimingsMs: number[] | undefined;
	fps: number;
	videoBitsPerSecond: number;
	onRecordProgress: ExportProgress | undefined;
	signal: AbortSignal | undefined;
	waitMs: (ms: number) => Promise<void>;
}

/**
 * Replay pre-captured slide canvases onto a recording canvas streamed into a
 * `MediaRecorder`, holding each slide for its planned segment. Returns the
 * assembled WebM Blob.
 */
async function recordWebm(canvases: HTMLCanvasElement[], opts: RecordOptions): Promise<Blob> {
	const recordingCanvas = document.createElement('canvas');
	recordingCanvas.width = canvases[0].width;
	recordingCanvas.height = canvases[0].height;
	const ctx = recordingCanvas.getContext('2d');
	if (!ctx) {
		throw new Error('[pptx-vanilla-viewer] video export failed: 2D context unavailable');
	}

	const stream = recordingCanvas.captureStream(opts.fps);
	const recorder = new MediaRecorder(stream, {
		mimeType: pickSupportedMimeType([...WEBM_MIME_CANDIDATES]),
		videoBitsPerSecond: opts.videoBitsPerSecond,
	});

	const chunks: Blob[] = [];
	recorder.ondataavailable = (event) => {
		if (event.data.size > 0) {
			chunks.push(event.data);
		}
	};
	const recorderDone = new Promise<void>((resolve, reject) => {
		recorder.onstop = () => {
			resolve();
		};
		recorder.onerror = () => {
			reject(new Error('[pptx-vanilla-viewer] video export failed: MediaRecorder error'));
		};
	});

	recorder.start();

	const plans = planVideoSegments({
		totalSlides: canvases.length,
		slideDurationMs: opts.slideDurationMs,
		slideTimingsMs: opts.slideTimingsMs,
		fps: opts.fps,
	});
	const frameIntervalMs = fpsToFrameIntervalMs(opts.fps);

	for (const plan of plans) {
		opts.onRecordProgress?.(plan.slideIndex, plans.length);
		for (let frame = 0; frame < plan.frameCount; frame++) {
			if (opts.signal?.aborted) {
				recorder.stop();
				throw exportAbortError();
			}
			// Redraw the same slide each tick to keep feeding the capture stream.
			ctx.drawImage(canvases[plan.slideIndex], 0, 0);
			await opts.waitMs(frameIntervalMs);
		}
	}

	recorder.stop();
	await recorderDone;
	return new Blob(chunks, { type: 'video/webm' });
}

/**
 * Capture every slide, record them into a WebM video, and trigger a
 * `<baseName>.webm` download. No-op when the deck is empty. Throws the shared
 * `AbortError` when `signal` aborts during capture or recording.
 */
export async function runVideoExport(
	deps: ExportVideoDeps,
	options: ExportVideoOptions = {},
): Promise<void> {
	const {
		slideDurationMs = 3000,
		slideTimingsMs,
		fps = 30,
		videoBitsPerSecond = 5_000_000,
		onProgress,
		onRecordProgress,
		signal,
	} = options;
	const total = deps.store.get().slides.length;
	if (total === 0) {
		return;
	}

	const canvases: HTMLCanvasElement[] = [];
	for (let i = 0; i < total; i++) {
		if (signal?.aborted) {
			throw exportAbortError();
		}
		onProgress?.(i, total);
		canvases.push(await deps.rasterizeSlide(i));
	}

	const blob = await recordWebm(canvases, {
		slideDurationMs,
		slideTimingsMs,
		fps,
		videoBitsPerSecond,
		onRecordProgress,
		signal,
		waitMs: deps.waitMs ?? defaultWaitMs,
	});

	onProgress?.(total, total);
	downloadBlob(blob, `${deps.baseName}.webm`);
}
