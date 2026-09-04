import type { MediaPptxElement } from 'pptx-viewer-core';

// ---------------------------------------------------------------------------
// Persistent Audio Manager: keeps audio playing across slide transitions
// ---------------------------------------------------------------------------

// The manager itself lives in shared (render/media-persistent-audio) so every
// binding drives the same document-level registry; this module re-exports it
// to keep the existing React import paths working.
export {
	hasPersistentAudio,
	pauseAllPersistentAudio,
	registerPersistentAudio,
	resumeAllPersistentAudio,
	stopAllPersistentAudio,
} from 'pptx-viewer-shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a media fragment URI component (`#t=start`) for a trimmed clip's
 * start point. Times are in milliseconds; the fragment uses seconds.
 *
 * G19/G20: `element.trimEndMs` is `p14:trim/@end`'s own on-the-wire unit,
 * the DISTANCE in milliseconds from the clip's END (COM-verified; see
 * `PptxHandlerRuntimeMediaParsingUtils.ts`), not an absolute stop time. The
 * Media Fragments URI spec only accepts an absolute `end` (`#t=start,end`),
 * and that absolute position cannot be computed until the browser has
 * decoded the clip's real duration - which is not known yet at the point
 * this string is built (it becomes the `src` the browser has not fetched).
 * An earlier version emitted `trimEndMs` here directly as if it already were
 * that absolute position, which is exactly backwards. Trim-end enforcement is
 * `scheduleMediaTrimAndFade`'s job (it waits for `loadedmetadata`), not this
 * fragment's.
 */
export function buildTrimFragment(element: MediaPptxElement): string {
	const start = element.trimStartMs;
	if (start === undefined || start <= 0) {
		return '';
	}
	return `#t=${(start / 1000).toFixed(3)}`;
}
