/** The media kind a chosen file's MIME type maps to, or `null` for an unsupported type. */
export type MediaFileType = 'audio' | 'video';

/**
 * Classify an inserted file's MIME type as `audio`, `video`, or `null` for
 * anything else. Every binding's "insert audio/video" flow needs this same
 * check before building a `media` element; without the `null` case a binding
 * ends up treating any non-audio file (a PDF, an image picked by mistake, an
 * unrecognised codec) as video.
 */
export function classifyMediaType(mimeType: string): MediaFileType | null {
	if (mimeType.startsWith('audio/')) {
		return 'audio';
	}
	if (mimeType.startsWith('video/')) {
		return 'video';
	}
	return null;
}
