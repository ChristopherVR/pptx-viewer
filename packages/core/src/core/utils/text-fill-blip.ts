/**
 * Resolve a text run's picture fill (`a:rPr > a:blipFill`) to a displayable
 * path, mirroring the synchronous resolution a table cell's own image fill
 * gets. It never decodes to a `data:` URL: an archive target resolves to its
 * archive path (a load pipeline turns it into a Blob URL later, exactly like a
 * picture element parsed with `eagerDecodeImages: false`), a `data:` target
 * passes through, and an external `http(s)` target only when external images
 * are allowed.
 *
 * @module text-fill-blip
 */

import type { XmlObject } from '../types';

/** A resolved text picture fill: the image and whether it tiles or stretches. */
export interface ResolvedTextFillBlip {
	url: string;
	mode: 'stretch' | 'tile';
}

/**
 * @param blipFill           The run's raw `a:blipFill` node.
 * @param lookupTarget       Relationship id -> target for the run's part.
 * @param resolveArchivePath Relative target -> archive path.
 * @param allowExternal      Whether an external URL may be used as-is.
 */
export function resolveTextFillBlip(
	blipFill: XmlObject,
	lookupTarget: (relId: string) => string | undefined,
	resolveArchivePath: (target: string) => string,
	allowExternal: boolean,
): ResolvedTextFillBlip | undefined {
	const blip = blipFill['a:blip'] as XmlObject | undefined;
	const relId = String(blip?.['@_r:embed'] || blip?.['@_r:link'] || '');
	const target = relId ? lookupTarget(relId) : undefined;
	if (!target) {
		return undefined;
	}
	const mode = blipFill['a:tile'] !== undefined ? 'tile' : 'stretch';
	if (target.startsWith('http://') || target.startsWith('https://')) {
		return allowExternal ? { url: target, mode } : undefined;
	}
	if (target.startsWith('data:')) {
		return { url: target, mode };
	}
	return { url: resolveArchivePath(target), mode };
}
