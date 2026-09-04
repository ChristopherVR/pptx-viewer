/**
 * Trim-timeline geometry math for the trim-editing UI, shared by every
 * binding's trim scrubber (React `TrimTimeline`, Vue `MediaTrimTimeline.vue`,
 * Angular `media-trim-timeline.component.ts`, Svelte, vanilla).
 *
 * `trimEndMs` throughout this module is `p14:trim/@end`'s own on-the-wire
 * unit: the distance, in milliseconds, from the END of the clip, NOT an
 * absolute stop time. COM-verified ground truth (see
 * `PptxHandlerRuntimeMediaParsingUtils.ts`'s `MediaExtensionData` doc):
 * setting `Shape.MediaFormat.EndPoint = 29596` on a 30034ms clip round-trips
 * through real PowerPoint as `p14:trim end="438"` (30034 - 29596). Every
 * function here converts to/from an absolute position internally using the
 * caller-supplied `durationSeconds`, so a caller can keep storing and
 * round-tripping the raw distance-from-end value without doing that maths
 * itself.
 */
export type MediaTrimHandle = 'start' | 'end';

export interface MediaTimelineGeometry {
	startPercent: number;
	endPercent: number;
	playheadPercent: number;
}

export interface MediaTrimRange {
	trimStartMs: number;
	/** Distance, in ms, from the clip's END. See module doc. */
	trimEndMs: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

export function formatMediaTime(seconds: number): string {
	const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
	const totalTenths = Math.round(safeSeconds * 10);
	const minutes = Math.floor(totalTenths / 600);
	const wholeSeconds = Math.floor((totalTenths % 600) / 10);
	const tenths = totalTenths % 10;
	return `${minutes}:${String(wholeSeconds).padStart(2, '0')}.${tenths}`;
}

/**
 * Absolute trim-end position, in seconds, for a `trimEndMs` distance-from-tail
 * value. `0` (or a negative/unset value) means "play to the end of the clip".
 * The single place every binding's trim label and range validation should
 * derive the end position from, so none of them re-reads `trimEndMs` as if it
 * were an absolute stop time.
 */
export function mediaTrimEndSeconds(durationSeconds: number, trimEndMs: number): number {
	const duration = Math.max(0, durationSeconds);
	return trimEndMs > 0 ? clamp(duration - trimEndMs / 1000, 0, duration) : duration;
}

/**
 * Inverse of {@link mediaTrimEndSeconds}: convert an absolute end position
 * (seconds) back to `p14:trim/@end`'s distance-from-tail milliseconds.
 */
export function mediaTrimEndMsFromSeconds(durationSeconds: number, endSeconds: number): number {
	const duration = Math.max(0, durationSeconds);
	return Math.max(0, duration - clamp(endSeconds, 0, duration)) * 1000;
}

export function mediaTimeFromPointer(
	clientX: number,
	barLeft: number,
	barWidth: number,
	durationSeconds: number,
): number {
	if (barWidth <= 0 || durationSeconds <= 0) {
		return 0;
	}
	return clamp((clientX - barLeft) / barWidth, 0, 1) * durationSeconds;
}

export function mediaTimelineGeometry(
	durationSeconds: number,
	trimStartMs: number,
	trimEndMs: number,
	currentTimeSeconds: number,
): MediaTimelineGeometry {
	const duration = durationSeconds > 0 ? durationSeconds : 1;
	const startSeconds = clamp(trimStartMs / 1000, 0, duration);
	// `trimEndMs` is a distance from the tail; convert to an absolute position.
	const requestedEnd = trimEndMs > 0 ? duration - trimEndMs / 1000 : duration;
	const endSeconds = clamp(requestedEnd, startSeconds, duration);
	return {
		startPercent: (startSeconds / duration) * 100,
		endPercent: (endSeconds / duration) * 100,
		playheadPercent: clamp((currentTimeSeconds / duration) * 100, 0, 100),
	};
}

export function mediaTrimRangeForDrag(
	handle: MediaTrimHandle,
	pointerTimeSeconds: number,
	durationSeconds: number,
	trimStartMs: number,
	trimEndMs: number,
	minimumGapSeconds = 0.1,
): MediaTrimRange {
	const duration = Math.max(0, durationSeconds);
	const startSeconds = clamp(trimStartMs / 1000, 0, duration);
	// `trimEndMs` is a distance from the tail; convert to an absolute position
	// for the geometry maths below, then convert back on the way out.
	const endSeconds = trimEndMs > 0 ? clamp(duration - trimEndMs / 1000, 0, duration) : duration;
	if (handle === 'start') {
		const latestStart = Math.max(0, endSeconds - minimumGapSeconds);
		return {
			trimStartMs: clamp(pointerTimeSeconds, 0, latestStart) * 1000,
			trimEndMs,
		};
	}
	const earliestEnd = Math.min(duration, startSeconds + minimumGapSeconds);
	const newEndSeconds = clamp(pointerTimeSeconds, earliestEnd, duration);
	return {
		trimStartMs,
		trimEndMs: (duration - newEndSeconds) * 1000,
	};
}
