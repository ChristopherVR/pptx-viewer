/**
 * Cross-slide ("play across slides") audio registration.
 *
 * PowerPoint keeps background audio marked `playAcrossSlides` playing when
 * the show advances, but a slide-local `<audio>` dies with its slide's DOM.
 * {@link registerCrossSlideAudio} hands the track to the shared
 * `media-persistent-audio` manager (a hidden document-level element that
 * survives slide unmount) at the moment presentation-mode autoplay would
 * have started the slide-local copy.
 *
 * Vue, Angular, Svelte and Vanilla each carried a byte-identical copy of this
 * function; this is the one copy, sitting next to {@link mediaPlaybackAttributes}
 * in `media-playback.ts` as the task that named it expected, split into its
 * own sibling module purely to keep `media-playback.ts` under the file-size
 * cap.
 */
import type { MediaPptxElement } from 'pptx-viewer-core';

import { registerPersistentAudio } from './media-persistent-audio';
import { mediaPlaybackAttributes } from './media-playback';

/**
 * Register a `playAcrossSlides` audio element with the shared persistent-audio
 * manager, using the same resolved source, loop, volume and trim start the
 * slide-local element would have used. Returns true when the persistent
 * (document-level) element owns playback, in which case the slide-local media
 * node must stay silent or the track doubles. Idempotent per element id
 * (the manager no-ops a re-register), so re-entering the owning slide does not
 * restart the track.
 */
export function registerCrossSlideAudio(
	element: MediaPptxElement,
	src: string | undefined,
): boolean {
	if (element.playAcrossSlides !== true || element.mediaType !== 'audio' || !src) {
		return false;
	}
	const playback = mediaPlaybackAttributes(element);
	registerPersistentAudio(
		element.id,
		src,
		element.mediaMimeType,
		playback.loop,
		playback.volume,
		(element.trimStartMs ?? 0) / 1000,
	);
	return true;
}
