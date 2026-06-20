/**
 * Pure video (WebM) export planning helpers shared by every binding's video
 * export. Frame-segment timing, fps -> frame-interval maths, and MediaRecorder
 * MIME-type selection. No DOM, no canvas, no MediaRecorder instance: the binding
 * owns the actual `recordWebm` driver that consumes these plans.
 *
 * `pickSupportedMimeType` wraps `MediaRecorder.isTypeSupported` (a static
 * browser API, not a DOM node) and degrades gracefully in SSR / non-browser
 * environments.
 */

/** Timing plan for one slide's contribution to the video. */
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

/** Options for {@link planVideoSegments}. */
export interface VideoPlanOptions {
	/** Total number of slides. */
	totalSlides: number;
	/**
	 * Default slide display duration in milliseconds (default: 3000).
	 * Overridden per-slide by {@link VideoPlanOptions.slideTimingsMs}.
	 */
	slideDurationMs?: number;
	/**
	 * Per-slide duration overrides in milliseconds (index maps to slide index).
	 * `undefined` entries fall back to `slideDurationMs`.
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
 * presentation video. Nothing browser-specific is touched.
 *
 * @param opts - Planning options.
 * @returns One {@link VideoSegmentPlan} per slide, in slide order (0-based).
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
 * Default ordered MIME-type candidates for WebM recording, most preferred first.
 * Pass to {@link pickSupportedMimeType} or directly to a `recordWebm` driver.
 */
export const WEBM_MIME_CANDIDATES: readonly string[] = [
	'video/webm;codecs=vp9',
	'video/webm;codecs=vp8',
	'video/webm',
] as const;

/**
 * Select the first MIME type from `candidates` that `MediaRecorder.isTypeSupported`
 * accepts, falling back to the last candidate when none is supported.
 *
 * @param candidates - Ordered MIME type strings to test (most preferred first).
 * @returns The first supported MIME type, or the last candidate as the fallback.
 * @throws When `candidates` is empty.
 */
export function pickSupportedMimeType(candidates: string[]): string {
	if (candidates.length === 0) {
		throw new Error('[video-plan] pickSupportedMimeType: candidates must not be empty');
	}

	if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
		return candidates[0];
	}

	for (const mime of candidates) {
		if (MediaRecorder.isTypeSupported(mime)) {
			return mime;
		}
	}

	return candidates[candidates.length - 1];
}

/**
 * Compute the frame interval in milliseconds for a target frame rate.
 *
 * @param fps - Desired frames per second (must be > 0).
 */
export function fpsToFrameIntervalMs(fps: number): number {
	if (fps <= 0) {
		throw new RangeError('[video-plan] fpsToFrameIntervalMs: fps must be > 0');
	}
	return 1000 / fps;
}

/**
 * Compute the number of draw-loop frames needed to fill a segment of `durationMs`
 * at `fps`. Always at least 1.
 *
 * @param durationMs - Segment duration in milliseconds.
 * @param fps        - Frame rate in frames per second.
 */
export function segmentFrameCount(durationMs: number, fps: number): number {
	if (fps <= 0) {
		throw new RangeError('[video-plan] segmentFrameCount: fps must be > 0');
	}
	return Math.max(1, Math.ceil(durationMs / (1000 / fps)));
}
