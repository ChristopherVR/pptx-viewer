/**
 * Video (WebM) export helpers for the Angular viewer.
 *
 * Source: ported from packages/react/src/viewer/utils/export-video.ts.
 *
 * Split into two concerns:
 *   1. Pure, browser-free planning helpers (frame-segment timing, MIME-type
 *      selection): fully unit-testable with no DOM/MediaRecorder dependency.
 *   2. A thin browser-facing `recordWebm()` function that drives a
 *      `MediaRecorder` over a canvas `captureStream()` to produce a WebM Blob.
 *      The caller (ExportService) supplies the pre-rendered slide canvases and
 *      a `recordingCanvas` for compositing.
 *
 * No new npm dependency is needed; `MediaRecorder` is a browser built-in.
 */

/* ================================================================== */
/*  1. Pure planning helpers                                           */
/* ================================================================== */

/**
 * Timing plan for one slide's contribution to the video.
 */
export interface VideoSegmentPlan {
	/** 0-based slide index. */
	slideIndex: number;
	/** Duration this segment should be held, in milliseconds. */
	durationMs: number;
	/** Target frame rate used to compute the segment frame count. */
	fps: number;
	/** Total number of draw-loop iterations for this segment at `fps`. */
	frameCount: number;
}

/**
 * Options for {@link planVideoSegments}.
 */
export interface VideoPlanOptions {
	/** Total number of slides. */
	totalSlides: number;
	/**
	 * Default slide display duration in **milliseconds** (default: 3000).
	 * Overridden per-slide by {@link slideTimingsMs}.
	 */
	slideDurationMs?: number;
	/**
	 * Per-slide duration overrides in milliseconds (index maps to slide index).
	 * `undefined` entries fall back to {@link slideDurationMs}.
	 */
	slideTimingsMs?: number[];
	/**
	 * Desired recording frame rate in frames-per-second (default: 30).
	 * Used to compute the number of draw iterations per segment.
	 */
	fps?: number;
}

/**
 * Compute an ordered list of {@link VideoSegmentPlan} objects for a
 * presentation video.  Nothing browser-specific is touched.
 *
 * @param opts - Planning options.
 * @returns One {@link VideoSegmentPlan} per slide, in slide order (0-based).
 *
 * @example
 * const segs = planVideoSegments({ totalSlides: 3, slideDurationMs: 2000, fps: 30 });
 * // segs[0].durationMs === 2000, segs[0].frameCount === 60
 */
export function planVideoSegments(opts: VideoPlanOptions): VideoSegmentPlan[] {
	const { totalSlides, slideDurationMs = 3000, slideTimingsMs, fps = 30 } = opts;

	const frameIntervalMs = 1000 / fps;
	const plans: VideoSegmentPlan[] = [];

	for (let i = 0; i < totalSlides; i++) {
		const durationMs = slideTimingsMs?.[i] ?? slideDurationMs;
		const frameCount = Math.max(1, Math.ceil(durationMs / frameIntervalMs));
		plans.push({ slideIndex: i, durationMs, fps, frameCount });
	}

	return plans;
}

/**
 * Select the first MIME type from `candidates` that `MediaRecorder.isTypeSupported`
 * accepts, falling back to the last candidate in the list when none is supported.
 *
 * This is a pure browser-API wrapper (no DOM, no canvas) that can be
 * spied/mocked in unit tests.
 *
 * Priority order recommended for WebM:
 * ```
 * ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
 * ```
 *
 * @param candidates - Ordered list of MIME type strings to test (most preferred first).
 * @returns The first supported MIME type, or the last candidate as the fallback.
 * @throws When `candidates` is empty.
 */
export function pickSupportedMimeType(candidates: string[]): string {
	if (candidates.length === 0) {
		throw new Error('[video-export-helpers] pickSupportedMimeType: candidates must not be empty');
	}

	if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
		// SSR / non-browser environments: just return the first candidate.
		return candidates[0];
	}

	for (const mime of candidates) {
		if (MediaRecorder.isTypeSupported(mime)) {
			return mime;
		}
	}

	// Fallback: return last candidate and let MediaRecorder surface its own error.
	return candidates[candidates.length - 1];
}

/**
 * Compute the frame interval in milliseconds for a target frame rate.
 *
 * @param fps - Desired frames per second (must be > 0).
 * @returns Frame interval in milliseconds.
 */
export function fpsToFrameIntervalMs(fps: number): number {
	if (fps <= 0) {
		throw new RangeError('[video-export-helpers] fpsToFrameIntervalMs: fps must be > 0');
	}
	return 1000 / fps;
}

/**
 * Compute the number of draw-loop frames needed to fill a segment of `durationMs`
 * at `fps`.  Always at least 1.
 *
 * @param durationMs - Segment duration in milliseconds.
 * @param fps        - Frame rate in frames per second.
 * @returns Number of frames (integer ≥ 1).
 */
export function segmentFrameCount(durationMs: number, fps: number): number {
	if (fps <= 0) {
		throw new RangeError('[video-export-helpers] segmentFrameCount: fps must be > 0');
	}
	return Math.max(1, Math.ceil(durationMs / (1000 / fps)));
}

/**
 * Default ordered MIME-type candidates for WebM recording, most preferred first.
 * Pass to {@link pickSupportedMimeType} or directly to `recordWebm`.
 */
export const WEBM_MIME_CANDIDATES: readonly string[] = [
	'video/webm;codecs=vp9',
	'video/webm;codecs=vp8',
	'video/webm',
] as const;

/* ================================================================== */
/*  2. Thin browser-facing recorder                                   */
/* ================================================================== */

/**
 * Options for {@link recordWebm}.
 */
export interface RecordWebmOptions {
	/**
	 * Desired recording frame rate fed to `captureStream()` (default: 30).
	 */
	fps?: number;
	/**
	 * Per-slide durations in milliseconds (index maps to slide order in `canvases`).
	 * When absent, `slideDurationMs` is used for every slide.
	 */
	slideTimingsMs?: number[];
	/**
	 * Default slide duration in milliseconds (default: 3000).
	 */
	slideDurationMs?: number;
	/**
	 * MIME type for `MediaRecorder` (default: result of
	 * `pickSupportedMimeType(WEBM_MIME_CANDIDATES)`).
	 */
	mimeType?: string;
	/**
	 * Video bit rate in bits/s (default: 5_000_000 = 5 Mbps, matching the
	 * React package).
	 */
	videoBitsPerSecond?: number;
	/**
	 * Optional `AbortSignal` to cancel the recording mid-way.
	 */
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
 * Strategy (mirrors the React `exportAllSlidesAsVideo`):
 * 1. Create an off-screen `recordingCanvas` sized to the first slide canvas.
 * 2. Start a `captureStream(fps)` + `MediaRecorder` on it.
 * 3. For each slide canvas, draw it repeatedly onto `recordingCanvas` for the
 *    slide's duration at `fps`, feeding frames to the stream.
 * 4. Stop the recorder and return the accumulated WebM Blob.
 *
 * The caller is responsible for rasterising slides to canvases beforehand
 * (via `ExportService.renderElement`).  This keeps the heavy html2canvas-pro
 * work outside this function and makes progress reporting easy.
 *
 * @param canvases - Pre-rendered slide canvases in slide order.
 * @param opts     - Recording options.
 * @returns A `Promise<Blob>` resolving to a `video/webm` Blob.
 *
 * @throws `DOMException('Export cancelled', 'AbortError')` when `signal` fires.
 * @throws `Error` when no canvases are supplied or when 2D context creation fails.
 *
 * @example
 * // In ExportService:
 * const canvases = await Promise.all(slides.map(el => this.renderElement(el)));
 * const blob     = await recordWebm(canvases, { slideDurationMs: 3000 });
 * downloadBlob(blob, 'presentation.webm');
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

	// Create a compositing canvas sized to the first slide.
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
