import type { MediaPptxElement } from 'pptx-viewer-core';

export function resolveMediaPreviewUrl(
	media: MediaPptxElement,
	urls: ReadonlyMap<string, string>,
): string | undefined {
	return media.mediaData ?? (media.mediaPath ? urls.get(media.mediaPath) : undefined);
}
