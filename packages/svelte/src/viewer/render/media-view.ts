import type { MediaPptxElement } from 'pptx-viewer-core';
import { getImageSrc, getOnlineVideoEmbed } from 'pptx-viewer-shared';

export { registerCrossSlideAudio } from 'pptx-viewer-shared';

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
	/**
	 * A linked YouTube/Vimeo URL resolved to its iframe-embeddable form (see
	 * `pptx-viewer-shared`'s `online-video`). When set, the caller renders an
	 * `<iframe>` instead of `<video src={mediaSrc}>`, which cannot decode a web
	 * page.
	 */
	onlineVideoEmbedUrl: string | undefined;
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
		onlineVideoEmbedUrl: getOnlineVideoEmbed(element)?.embedUrl,
	};
}
