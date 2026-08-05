/**
 * Cross-slide ("play across slides") audio for the slide show.
 *
 * PowerPoint keeps background audio marked `playAcrossSlides` playing when the
 * show advances, but the slide-local `<audio>` dies with its slide's DOM. The
 * shared persistent-audio manager owns a hidden document-level element that
 * survives slide unmount; this helper registers the track with it at the
 * moment presentation-mode autoplay would have started the slide-local copy.
 */
import type { MediaPptxElement } from 'pptx-viewer-core';
import { mediaPlaybackAttributes, registerPersistentAudio } from 'pptx-viewer-shared';

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
