import type { MediaBookmark, MediaPptxElement, XmlObject } from '../../types';
import { parseMediaExtensionData } from './PptxHandlerRuntimeMediaParsingUtils';
import type { EnsureArrayFn } from './PptxHandlerRuntimeMediaParsingUtils';

/**
 * The fields a picture element needs from its own `p14:media` extension
 * (G18), plus the media path/mime type after applying the `@r:embed`
 * fallback. Split out of `PptxHandlerRuntimePictureParsing.ts` purely to keep
 * that file's growth minimal: both `PptxHandlerRuntimeMediaParsingUtils.ts`
 * and `PptxHandlerRuntimePictureParsing.ts` were already over the repo's
 * 300-line file-size convention before this fix, so new logic goes in a new
 * sibling module instead of growing either further.
 */
export interface P14MediaResolution {
	mediaPath: string | undefined;
	mediaMimeType: string | undefined;
	/** `p14:trim/@st`: absolute milliseconds from the clip's start. */
	trimStartMs: number | undefined;
	/**
	 * `p14:trim/@end`: distance, in milliseconds, from the clip's END
	 * (COM-verified, NOT an absolute stop time; see
	 * `PptxHandlerRuntimeMediaParsingUtils.ts`'s `MediaExtensionData` doc).
	 */
	trimEndMs: number | undefined;
	fadeInDuration: number | undefined;
	fadeOutDuration: number | undefined;
	playbackSpeed: number | undefined;
	bookmarks: MediaBookmark[] | undefined;
}

/**
 * Read the picture's own `p:nvPr/p:extLst/p:ext/p14:media` (a sibling of the
 * legacy `a:videoFile`/`a:audioFile` reference), and fall back to its
 * `@r:embed` relationship for the media path when the primary reference is
 * absent or failed to resolve (a deck referenced only through the p14
 * extension, or whose legacy relationship broke).
 */
export function resolveP14MediaForPicture(
	nvPr: XmlObject | undefined,
	shapeId: string,
	ensureArray: EnsureArrayFn,
	primaryMediaPath: string | undefined,
	primaryMediaMimeType: string | undefined,
	resolveEmbedRelationship: (relationshipId: string) => string | undefined,
	getMediaMimeType: (mediaPath: string | undefined) => string | undefined,
): P14MediaResolution {
	const mediaExt = nvPr ? parseMediaExtensionData(nvPr, {}, shapeId, ensureArray) : undefined;

	let mediaPath = primaryMediaPath;
	let mediaMimeType = primaryMediaMimeType;
	if (mediaExt?.embedRId && (!mediaPath || mediaPath.length === 0)) {
		mediaPath = resolveEmbedRelationship(mediaExt.embedRId);
		mediaMimeType = getMediaMimeType(mediaPath);
	}

	return {
		mediaPath,
		mediaMimeType,
		trimStartMs: mediaExt?.trimStartMs,
		trimEndMs: mediaExt?.trimEndMs,
		fadeInDuration: mediaExt?.fadeInDuration,
		fadeOutDuration: mediaExt?.fadeOutDuration,
		playbackSpeed: mediaExt?.playbackSpeed,
		bookmarks:
			mediaExt?.bookmarks && mediaExt.bookmarks.length > 0 ? mediaExt.bookmarks : undefined,
	};
}

/**
 * The `p14:media`/`p14:bmkLst` fields for a media element authored as a
 * `p:graphicFrame` (`a:videoFile`/`a:audioFile`), as opposed to a `p:pic`
 * (`resolveP14MediaForPicture` above).
 *
 * A freshly-inserted (never round-tripped) media element is always written
 * this shape by `MediaGraphicFrameXmlFactory`/`buildMediaP14Extensions`, so
 * without this the trim/fade/speed/bookmarks the SAVE writer had just
 * synthesised onto `p:nvGraphicFramePr/p:nvPr/p:extLst` were unreadable on
 * the very next load: `PptxGraphicFrameParser`'s media branch never looked at
 * `p:nvPr` at all, only `resolveP14MediaForPicture`'s `p:pic` counterpart did.
 * Only the fields actually present are returned, so a caller can spread the
 * result over an already-built `Partial<MediaPptxElement>` without
 * clobbering it with `undefined`.
 */
export function resolveP14MediaForGraphicFrame(
	nvPr: XmlObject | undefined,
	shapeId: string,
	ensureArray: EnsureArrayFn,
): Partial<MediaPptxElement> {
	if (!nvPr) {
		return {};
	}
	const mediaExt = parseMediaExtensionData(nvPr, {}, shapeId, ensureArray);
	return {
		...(mediaExt.trimStartMs !== undefined ? { trimStartMs: mediaExt.trimStartMs } : {}),
		...(mediaExt.trimEndMs !== undefined ? { trimEndMs: mediaExt.trimEndMs } : {}),
		...(mediaExt.fadeInDuration !== undefined ? { fadeInDuration: mediaExt.fadeInDuration } : {}),
		...(mediaExt.fadeOutDuration !== undefined
			? { fadeOutDuration: mediaExt.fadeOutDuration }
			: {}),
		...(mediaExt.playbackSpeed !== undefined ? { playbackSpeed: mediaExt.playbackSpeed } : {}),
		...(mediaExt.bookmarks.length > 0 ? { bookmarks: mediaExt.bookmarks } : {}),
	};
}

/**
 * Resolve a relationship target that may be external (`http(s)://`, G17), an
 * inline `data:` URI, or a package-relative path, applying the same
 * `allowExternalImages`-gated Load-H3 rule the primary blip resolution uses.
 * A LINKED (not embedded) `asvg:svgBlip` variant has the identical corruption
 * risk in miniature: routing an absolute URL through the package-relative
 * `resolveImagePath` joiner produces a nonsense path, not a URL.
 */
export function resolveExternalOrPackagePath(
	target: string,
	allowExternal: boolean,
	resolvePackagePath: (target: string) => string | undefined,
): { path: string | undefined; data: string | undefined } {
	const isExternal = target.startsWith('http://') || target.startsWith('https://');
	if (isExternal) {
		return allowExternal ? { path: target, data: target } : { path: undefined, data: undefined };
	}
	if (target.startsWith('data:')) {
		return { path: target, data: target };
	}
	return { path: resolvePackagePath(target), data: undefined };
}
