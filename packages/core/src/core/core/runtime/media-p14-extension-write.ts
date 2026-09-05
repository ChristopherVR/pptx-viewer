import type { MediaPptxElement, XmlObject } from '../../types';

/**
 * Pure construction of the `p14:media` / `p14:bmkLst` extension entries a
 * media element's typed trim/fade/speed/bookmark fields need, independent of
 * any existing XML to merge into.
 *
 * Split out of `PptxHandlerRuntimeSaveMediaTimingWrite.ts`'s
 * `writeMediaP14Extension` (which merges these onto an EXISTING
 * `p:nvPicPr/p:nvPr/p:extLst` a round-tripped picture already carries) so the
 * same construction logic is reusable where there is no existing extLst to
 * merge into at all: a freshly inserted (never round-tripped) media element,
 * which `MediaGraphicFrameXmlFactory` writes as a brand-new `p:graphicFrame`.
 * Without this, a clip inserted and trimmed in the same session had its
 * trim/fade/bookmarks silently dropped on save, and only started round-
 * tripping after a save+reload gave it the `rawXml` the merge path needs.
 *
 * @module media-p14-extension-write
 */

/** Whether `media` carries any field the p14 extension would need to write. */
export function hasMediaP14ExtensionData(media: MediaPptxElement): boolean {
	const hasTrim = media.trimStartMs !== undefined || media.trimEndMs !== undefined;
	const hasFade =
		(media.fadeInDuration !== undefined && media.fadeInDuration > 0) ||
		(media.fadeOutDuration !== undefined && media.fadeOutDuration > 0);
	const hasSpeed = media.playbackSpeed !== undefined && media.playbackSpeed !== 1;
	const hasBookmarks = media.bookmarks !== undefined && media.bookmarks.length > 0;
	return hasTrim || hasFade || hasSpeed || hasBookmarks;
}

/**
 * Build the `p:ext` entries for `media`'s typed fields: the
 * `{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}` `p14:media` extension (trim, fade,
 * speed, and the embed relationship) and, when there are bookmarks, the
 * `{C809E50D-3E49-4677-B9B1-B2B30C8E0B5F}` `p14:bmkLst` extension. Returns an
 * empty array when `media` has nothing worth writing.
 *
 * @param embedRelationshipId the media part's relationship id, written as
 *   `p14:media/@r:embed` (COM-verified attribute name; see
 *   `PptxHandlerRuntimeMediaParsingUtils.ts`'s parse side) so a freshly
 *   inserted clip's extension resolves the media on its very first save,
 *   without needing a load round-trip first. Omit or pass an empty string to
 *   leave the attribute unset.
 */
export function buildMediaP14Extensions(
	media: MediaPptxElement,
	embedRelationshipId?: string,
): XmlObject[] {
	const exts: XmlObject[] = [];
	const hasTrim = media.trimStartMs !== undefined || media.trimEndMs !== undefined;
	const hasFade =
		(media.fadeInDuration !== undefined && media.fadeInDuration > 0) ||
		(media.fadeOutDuration !== undefined && media.fadeOutDuration > 0);
	const hasSpeed = media.playbackSpeed !== undefined && media.playbackSpeed !== 1;

	if (hasTrim || hasFade || hasSpeed) {
		const p14Media: XmlObject = {};
		if (embedRelationshipId) {
			p14Media['@_r:embed'] = embedRelationshipId;
		}
		if (hasTrim) {
			// COM-verified (see PptxHandlerRuntimeMediaParsingUtils.ts): decimal
			// milliseconds, verbatim - `st` absolute from the start, `end` a
			// distance from the clip's END, not an absolute stop.
			const trimObj: XmlObject = {};
			if (media.trimStartMs !== undefined) {
				trimObj['@_st'] = String(media.trimStartMs);
			}
			if (media.trimEndMs !== undefined) {
				trimObj['@_end'] = String(media.trimEndMs);
			}
			p14Media['p14:trim'] = trimObj;
		}
		if (hasFade) {
			const fadeObj: XmlObject = {};
			if (media.fadeInDuration !== undefined && media.fadeInDuration > 0) {
				fadeObj['@_in'] = String(Math.round(media.fadeInDuration * 1000));
			}
			if (media.fadeOutDuration !== undefined && media.fadeOutDuration > 0) {
				fadeObj['@_out'] = String(Math.round(media.fadeOutDuration * 1000));
			}
			p14Media['p14:fade'] = fadeObj;
		}
		if (hasSpeed && media.playbackSpeed !== undefined) {
			p14Media['@_spd'] = String(Math.round(media.playbackSpeed * 100000));
		}
		exts.push({ '@_uri': '{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}', 'p14:media': p14Media });
	}

	if (media.bookmarks !== undefined && media.bookmarks.length > 0) {
		exts.push({
			'@_uri': '{C809E50D-3E49-4677-B9B1-B2B30C8E0B5F}',
			'p14:bmkLst': {
				'p14:bmk': media.bookmarks.map((bmk) => ({
					'@_name': bmk.label,
					'@_time': String(Math.round(bmk.time * 1000)),
				})),
			},
		});
	}

	return exts;
}

/**
 * Build the `p:nvPr` (or `p:cNvPr`'s sibling non-visual properties) content
 * for a freshly-created media shape: `{}` when there is nothing to write, or
 * `{ 'p:extLst': { 'p:ext': ... } }` otherwise, matching the shape the
 * round-trip merge path (`writeMediaP14Extension`) leaves an existing
 * `extLst` in (a bare object when there is exactly one entry, an array
 * otherwise).
 */
export function buildFreshMediaNvPr(
	media: MediaPptxElement,
	embedRelationshipId?: string,
): XmlObject {
	const exts = buildMediaP14Extensions(media, embedRelationshipId);
	if (exts.length === 0) {
		return {};
	}
	return { 'p:extLst': { 'p:ext': exts.length === 1 ? exts[0] : exts } };
}
