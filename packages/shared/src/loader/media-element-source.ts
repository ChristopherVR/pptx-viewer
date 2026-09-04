/**
 * Resolve a single media element's playable source. Split out of
 * `load-content-helpers.ts` purely to keep that file under the file-size cap;
 * see `isExternalUrl` there for the shared external-URL test.
 */
import type { MediaPptxElement } from 'pptx-viewer-core';

import { isExternalUrl } from './is-external-url';

/**
 * The two `PptxHandler` methods a media-source resolution needs. A narrow
 * interface (rather than importing the full handler type) keeps this pure
 * loader module decoupled from the handler's much larger surface.
 */
export interface MediaArrayBufferSource {
	getMediaArrayBuffer(mediaPath: string): Promise<ArrayBuffer | undefined>;
	getImageData(imagePath: string): Promise<string | undefined>;
}

/** What {@link resolveMediaElementSource} found for one media element. */
export interface MediaSourceResolution {
	/** The element's own `mediaPath`, echoed back so the caller can key a map with it. */
	mediaPath: string | undefined;
	/** A playable URL: a Blob URL, a data URL, or (linked media, G17) the verbatim external URL. */
	url: string | undefined;
	/** True when `url` is a Blob URL the caller must track for later `URL.revokeObjectURL`. */
	isBlobUrl: boolean;
	/** True when no playable source could be resolved; the caller should set `mediaMissing`. */
	missing: boolean;
}

/**
 * Resolve ONE media element's playable source: the near-verbatim "load an
 * audio/video/poster's bytes and wrap them in a Blob URL" loop every binding
 * duplicated (Rule 2 extraction target).
 *
 * G17: a LINKED (`TargetMode="External"`) `mediaPath` is already the raw
 * external URL by the time it reaches here (core's `PptxMediaDataParser`
 * returns it verbatim instead of routing it through the package-relative
 * path joiner). `handler.getMediaArrayBuffer` is a `zip.file(...)` lookup
 * that can only ever find an EMBEDDED archive part, so handing it an
 * `https://` URL always misses and used to mark the element `mediaMissing`
 * even though PowerPoint would stream the URL directly. This function hands
 * an external `mediaPath` straight back as the playable `url` instead of
 * attempting an archive lookup, mirroring the `isExternalUrl` short-circuit
 * `collectImagePaths` already applies to pictures/poster frames.
 */
export async function resolveMediaElementSource(
	mediaElement: Pick<MediaPptxElement, 'mediaPath' | 'mediaType' | 'mediaMimeType'>,
	handler: MediaArrayBufferSource,
): Promise<MediaSourceResolution> {
	const mediaPath = mediaElement.mediaPath;
	if (!mediaPath) {
		return { mediaPath: undefined, url: undefined, isBlobUrl: false, missing: true };
	}
	if (isExternalUrl(mediaPath)) {
		return { mediaPath, url: mediaPath, isBlobUrl: false, missing: false };
	}
	try {
		const isAudioVideo = mediaElement.mediaType === 'audio' || mediaElement.mediaType === 'video';
		if (isAudioVideo) {
			const arrayBuffer = await handler.getMediaArrayBuffer(mediaPath);
			if (!arrayBuffer) {
				return { mediaPath, url: undefined, isBlobUrl: false, missing: true };
			}
			const mimeType = mediaElement.mediaMimeType || 'application/octet-stream';
			const blobUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: mimeType }));
			return { mediaPath, url: blobUrl, isBlobUrl: true, missing: false };
		}
		const dataUrl = await handler.getImageData(mediaPath);
		if (!dataUrl) {
			return { mediaPath, url: undefined, isBlobUrl: false, missing: true };
		}
		return { mediaPath, url: dataUrl, isBlobUrl: false, missing: false };
	} catch {
		return { mediaPath, url: undefined, isBlobUrl: false, missing: true };
	}
}
