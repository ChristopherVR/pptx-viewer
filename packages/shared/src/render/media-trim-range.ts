/**
 * Trim-range validation and labelling for the media inspector, shared by every
 * binding's trim editor.
 *
 * `trimEndMs` is `p14:trim/@end`'s on-the-wire unit: the distance in
 * milliseconds from the END of the clip (COM-verified, see
 * `media-trim-timeline.ts`), not an absolute stop time. The inspector shows the
 * user an absolute "End (mm:ss)" position, so this module owns both directions
 * of that conversion in ms; `media-trim-timeline.ts` has the seconds variants
 * the scrubber geometry uses.
 *
 * @module media-trim-range
 */

/** Why a trim range is rejected; bindings map these onto their i18n keys. */
export type MediaTrimRangeError = 'negative' | 'startAfterEnd' | 'beyondDuration';

/**
 * Absolute trim-end position in ms for a distance-from-tail `trimEndMs`.
 * `0` (or an unset/negative value) means "play to the end". When the clip
 * duration is unknown (`durationMs <= 0`) the raw value is returned unchanged
 * because there is nothing to measure the tail from.
 */
export function mediaTrimEndAbsoluteMs(durationMs: number, trimEndMs: number): number {
	if (durationMs <= 0) {
		return trimEndMs;
	}
	return trimEndMs > 0 ? Math.min(durationMs, Math.max(0, durationMs - trimEndMs)) : durationMs;
}

/**
 * Inverse of {@link mediaTrimEndAbsoluteMs}: convert the absolute end position
 * a user typed back into `p14:trim/@end`'s distance-from-tail ms. An end at or
 * past the clip's tail (or an unknown duration) stores `0`, "no end trim".
 */
export function mediaTrimEndMsFromAbsoluteMs(durationMs: number, absoluteEndMs: number): number {
	if (durationMs <= 0) {
		return 0;
	}
	return Math.max(0, durationMs - Math.min(durationMs, Math.max(0, absoluteEndMs)));
}

/**
 * Validate a trim range. `durationMs` of 0 means "unknown" and skips the bound
 * checks (and, because the end position is only known relative to the tail,
 * the start-before-end check too).
 */
export function validateMediaTrimRange(
	trimStartMs: number,
	trimEndMs: number,
	durationMs: number,
): MediaTrimRangeError | null {
	if (trimStartMs < 0 || trimEndMs < 0) {
		return 'negative';
	}
	if (durationMs > 0 && (trimStartMs > durationMs || trimEndMs > durationMs)) {
		return 'beyondDuration';
	}
	if (durationMs > 0 && trimEndMs > 0 && trimStartMs >= durationMs - trimEndMs) {
		return 'startAfterEnd';
	}
	return null;
}

/**
 * Effective trimmed playback length in ms. Falls back to the full duration
 * when the range is empty, inverted, or the duration is unknown.
 */
export function trimmedMediaDurationMs(
	trimStartMs: number,
	trimEndMs: number,
	durationMs: number,
): number {
	if (durationMs <= 0) {
		return durationMs;
	}
	const effectiveEnd = mediaTrimEndAbsoluteMs(durationMs, trimEndMs);
	if (effectiveEnd <= trimStartMs) {
		return durationMs;
	}
	return effectiveEnd - trimStartMs;
}
