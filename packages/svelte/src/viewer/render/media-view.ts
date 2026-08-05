import type { MediaPptxElement } from 'pptx-viewer-core';
import { getImageSrc, mediaPlaybackAttributes, registerPersistentAudio } from 'pptx-viewer-shared';

/**
 * Source resolution for `media` (audio / video) elements (port of the vanilla
 * binding's `renderMediaElement` cascade): `mediaData` (data-URL embedded by
 * the load pipeline) first, then `mediaPath` looked up in the media URL map;
 * the poster / thumbnail resolves via the shared `getImageSrc`
 * (`posterFrameData` / `posterFramePath`).
 */
export interface MediaView {
	/** Playable source URL, when one could be resolved. */
	mediaSrc: string | undefined;
	/** Poster / thumbnail image URL, when one exists. */
	posterSrc: string | undefined;
}

/** Resolve the playable and poster sources for a media element. */
export function resolveMediaView(
	element: MediaPptxElement,
	mediaDataUrls: Map<string, string>,
): MediaView {
	return {
		mediaSrc:
			element.mediaData ?? (element.mediaPath ? mediaDataUrls.get(element.mediaPath) : undefined),
		posterSrc: getImageSrc(element, mediaDataUrls),
	};
}

/**
 * Register a `playAcrossSlides` audio element with the shared persistent-audio
 * manager, using the same resolved source, loop, volume and trim start the
 * slide-local element would have used. PowerPoint keeps such background audio
 * playing when the show advances, but the slide-local `<audio>` dies with its
 * slide's DOM; the manager's hidden document-level element survives it.
 *
 * Returns true when the persistent element owns playback, in which case the
 * slide-local media node must stay silent or the track doubles. Idempotent per
 * element id (the manager no-ops a re-register), so re-entering the owning
 * slide does not restart the track.
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
