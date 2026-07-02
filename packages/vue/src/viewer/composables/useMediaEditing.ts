/**
 * useMediaEditing: pure, framework-thin helpers for Vue's media inspector.
 *
 * The media panels (playback options, trim timeline, bookmarks) stay pure
 * presentation; all the non-trivial maths (time formatting, mm:ss parsing,
 * trim-range validation, clamping, bookmark sorting) lives here so it can be
 * unit-tested in isolation and reused across the sub-components.
 *
 * These mirror the React inspector helpers (`TrimTimeline`, `MediaInspector`)
 * but return plain English strings instead of i18n keys, matching the sibling
 * Vue panels which do not thread `useTranslation`.
 */
import type { MediaBookmark } from 'pptx-viewer-core';

/**
 * Format a duration in seconds as `m:ss.d` (tenths of a second), matching the
 * React timeline/bookmark display.
 */
export function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) {
		return '0:00.0';
	}
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	const tenths = Math.round((seconds % 1) * 10);
	return `${m}:${String(s).padStart(2, '0')}.${tenths}`;
}

/** Generate a reasonably-unique bookmark id (mirrors the React helper). */
export function generateBookmarkId(): string {
	return `bmk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Convert milliseconds to a `mm:ss` display string. Minutes may exceed 59.
 * E.g. 65000 becomes "01:05".
 */
export function msToMmSs(ms: number): string {
	if (!Number.isFinite(ms) || ms < 0) {
		return '00:00';
	}
	const totalSeconds = Math.round(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Parse a `mm:ss` (or `m:ss`, or raw seconds) string into milliseconds.
 * Returns `undefined` when the input is not parseable.
 */
export function mmSsToMs(value: string): number | undefined {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return undefined;
	}

	const colonIdx = trimmed.indexOf(':');
	if (colonIdx >= 0) {
		const minutes = parseInt(trimmed.slice(0, colonIdx), 10);
		const seconds = parseInt(trimmed.slice(colonIdx + 1), 10);
		if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
			return undefined;
		}
		if (minutes < 0 || seconds < 0 || seconds >= 60) {
			return undefined;
		}
		return (minutes * 60 + seconds) * 1000;
	}

	const seconds = parseInt(trimmed, 10);
	if (!Number.isFinite(seconds) || seconds < 0) {
		return undefined;
	}
	return seconds * 1000;
}

/**
 * Validate a trim range. Returns a human-readable error string, or `null` when
 * the range is valid. `durationMs` of 0 means "unknown" and skips bound checks.
 */
export function validateTrimRange(
	trimStartMs: number,
	trimEndMs: number,
	durationMs: number,
): string | null {
	if (trimStartMs < 0 || trimEndMs < 0) {
		return 'Trim times cannot be negative.';
	}
	if (trimEndMs > 0 && trimStartMs >= trimEndMs) {
		return 'Trim start must be before trim end.';
	}
	if (durationMs > 0 && (trimStartMs > durationMs || trimEndMs > durationMs)) {
		return 'Trim times cannot exceed the clip duration.';
	}
	return null;
}

/** Clamp `value` into the inclusive `[min, max]` range. */
export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

/** Return a new array of bookmarks sorted ascending by time. */
export function sortBookmarks(bookmarks: readonly MediaBookmark[]): MediaBookmark[] {
	return bookmarks.slice().sort((a, b) => a.time - b.time);
}

/**
 * Compute the effective trimmed-duration label (`mm:ss`) given start/end (ms)
 * and the total clip duration (ms). Falls back to the full duration when the
 * range is empty or invalid.
 */
export function trimmedDurationLabel(
	trimStartMs: number,
	trimEndMs: number,
	durationMs: number,
): string {
	const effectiveEnd = trimEndMs > 0 ? trimEndMs : durationMs;
	if (effectiveEnd <= trimStartMs || durationMs <= 0) {
		return msToMmSs(durationMs);
	}
	return msToMmSs(effectiveEnd - trimStartMs);
}
