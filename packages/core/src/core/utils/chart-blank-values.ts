/**
 * Sparse numeric-cache extraction for chart series, preserving blank markers.
 *
 * The standard {@link extractChartPointValues} collapses `c:numCache` point
 * gaps into a dense array, so a missing `c:pt` (a genuine blank) becomes
 * indistinguishable from an absent trailing value. This helper instead expands
 * the cache to its full `@ptCount` length, marking absent or empty points as
 * `null` so callers can build a blank mask and honour `c:dispBlanksAs`.
 *
 * @module chart-blank-values
 */

import type { XmlObject } from '../types';

interface XmlLookupLike {
	getChildByLocalName(parent: XmlObject | undefined, name: string): XmlObject | undefined;
	getChildrenArrayByLocalName(parent: XmlObject | undefined, name: string): XmlObject[];
	getScalarChildByLocalName(parent: XmlObject | undefined, name: string): unknown;
}

/**
 * Expand a series value reference (`c:val` / `c:yVal`) into a full-length
 * `(number | null)[]` where `null` marks a blank category (missing or empty
 * `c:pt`). Returns an empty array when no numeric cache is present.
 */
export function extractSeriesNumbersWithBlanks(
	valNode: XmlObject | undefined,
	xml: XmlLookupLike,
): (number | null)[] {
	if (!valNode) {
		return [];
	}
	const ref =
		xml.getChildByLocalName(valNode, 'numRef') ?? xml.getChildByLocalName(valNode, 'numLit');
	const cache = xml.getChildByLocalName(ref, 'numCache') ?? ref;
	const points = xml.getChildrenArrayByLocalName(cache, 'pt');
	if (points.length === 0) {
		return [];
	}

	const byIndex = new Map<number, number>();
	let maxIndex = -1;
	for (const point of points) {
		const idx = Number.parseInt(String(point?.['@_idx'] ?? '0'), 10);
		if (!Number.isFinite(idx) || idx < 0) {
			continue;
		}
		const raw = String(xml.getScalarChildByLocalName(point, 'v') ?? '').trim();
		const num = Number.parseFloat(raw);
		if (raw.length > 0 && Number.isFinite(num)) {
			byIndex.set(idx, num);
		}
		if (idx > maxIndex) {
			maxIndex = idx;
		}
	}

	const declaredCount = Number.parseInt(
		String(xml.getChildByLocalName(cache, 'ptCount')?.['@_val'] ?? ''),
		10,
	);
	const length =
		Number.isFinite(declaredCount) && declaredCount > maxIndex + 1 ? declaredCount : maxIndex + 1;
	if (length <= 0) {
		return [];
	}

	const result: (number | null)[] = [];
	for (let i = 0; i < length; i++) {
		result.push(byIndex.has(i) ? (byIndex.get(i) as number) : null);
	}
	return result;
}
