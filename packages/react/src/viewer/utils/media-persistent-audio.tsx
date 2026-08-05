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
 * Build a media fragment URI component (`#t=start,end`) for trimmed media.
 * Times are in milliseconds; the fragment uses seconds.
 */
export function buildTrimFragment(element: MediaPptxElement): string {
	const start = element.trimStartMs;
	const end = element.trimEndMs;
	if (start === undefined && end === undefined) {
		return '';
	}
	const parts: string[] = [];
	if (start !== undefined && start > 0) {
		parts.push((start / 1000).toFixed(3));
	} else {
		parts.push('');
	}
	if (end !== undefined && end > 0) {
		parts.push((end / 1000).toFixed(3));
	}
	return parts.length > 0 ? `#t=${parts.join(',')}` : '';
}
