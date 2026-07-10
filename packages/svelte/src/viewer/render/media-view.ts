import type { MediaPptxElement } from 'pptx-viewer-core';
import { getImageSrc } from 'pptx-viewer-shared';

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
