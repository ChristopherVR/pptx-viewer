/**
 * Legacy VML-only OLE preview image resolution.
 *
 * The modern `p:oleObj` preview picture is `p:pic/p:blipFill/a:blip/@r:embed`
 * (handled directly in `PptxGraphicFrameParser.ts`). A minority of
 * real-world, non-SDK-authored decks (typically produced by older Office
 * versions or third-party OLE-embedding tools) instead carry the preview as
 * a VML `<v:shape><v:imagedata r:id="rIdX"/></v:shape>` fragment, with the
 * relationship id on `@r:id` (modern VML namespace binding) or the legacy
 * `@o:relid` attribute. No existing VML parser in this codebase
 * (`vml-parser.ts`, `vml-fill-stroke-parser.ts`) extracts an image
 * relationship id; both only read fill/stroke colour and geometry.
 *
 * This module is a defensive, structure-agnostic scanner rather than an
 * assumption about exactly where the VML fragment nests (inside `p:pic`,
 * directly under `p:oleObj`, or elsewhere): real-world placement of a
 * fallback VML preview varies by producer, and getting the exact nesting
 * wrong would silently keep the preview unresolved, which is the same
 * failure mode as not writing this module at all.
 *
 * @module vml-ole-preview
 */
import type { XmlObject } from '../types/common';
import { findAllOleObjNodes } from './ole-alternate-content';

const MAX_SCAN_DEPTH = 6;

function ensureArrayLike<T>(value: T | T[] | undefined): T[] {
	if (value === undefined || value === null) {
		return [];
	}
	return Array.isArray(value) ? value : [value];
}

/**
 * The relationship id a `v:imagedata` element carries, preferring the
 * modern `@r:id` attribute (the VML namespace's own relationship binding)
 * and falling back to the legacy `@o:relid` attribute some older producers
 * still emit.
 */
function readImageDataRelationshipId(imageData: XmlObject): string | undefined {
	const relId = String(imageData['@_r:id'] || imageData['@_o:relid'] || '').trim();
	return relId.length > 0 ? relId : undefined;
}

/**
 * Recursively scan an XML node (bounded depth, since this is defensive
 * against unknown real-world nesting, not an unbounded tree walk) for the
 * first `v:imagedata` element and return its relationship id.
 */
function scanForVmlImageDataRelationshipId(
	node: XmlObject | undefined,
	depth: number,
): string | undefined {
	if (!node || depth > MAX_SCAN_DEPTH) {
		return undefined;
	}

	const directImageData = node['v:imagedata'] as XmlObject | XmlObject[] | undefined;
	if (directImageData) {
		for (const candidate of ensureArrayLike(directImageData)) {
			const relId = readImageDataRelationshipId(candidate);
			if (relId) {
				return relId;
			}
		}
	}

	for (const [key, value] of Object.entries(node)) {
		if (key.startsWith('@_') || key === 'v:imagedata' || value === null || value === undefined) {
			continue;
		}
		if (typeof value !== 'object') {
			continue;
		}
		for (const child of ensureArrayLike(value as XmlObject | XmlObject[])) {
			const relId = scanForVmlImageDataRelationshipId(child, depth + 1);
			if (relId) {
				return relId;
			}
		}
	}

	return undefined;
}

/**
 * Resolve a legacy VML-only OLE preview's relationship id.
 *
 * Checks, in order:
 * 1. The already-resolved `p:oleObj` node (typically the `mc:Fallback`
 *    branch, or the direct node when there is no `mc:AlternateContent`
 *    wrapper at all) for a nested `v:imagedata`.
 * 2. Every OTHER `p:oleObj` branch reachable from `graphicData` (e.g. an
 *    `mc:Choice Requires="v"` branch some producers use to carry the VML
 *    preview when the `mc:Fallback` branch's own picture is unusable), via
 *    {@link findAllOleObjNodes}.
 *
 * Returns `undefined` when no branch carries a VML preview reference; the
 * caller is expected to have already tried the modern
 * `p:pic/p:blipFill/a:blip/@r:embed` path first.
 */
export function findVmlOlePreviewRelationshipId(
	resolvedOleObject: XmlObject | undefined,
	graphicData: XmlObject | undefined,
): string | undefined {
	const fromResolved = scanForVmlImageDataRelationshipId(resolvedOleObject, 0);
	if (fromResolved) {
		return fromResolved;
	}

	for (const branch of findAllOleObjNodes(graphicData)) {
		if (branch === resolvedOleObject) {
			continue;
		}
		const relId = scanForVmlImageDataRelationshipId(branch, 0);
		if (relId) {
			return relId;
		}
	}

	return undefined;
}
