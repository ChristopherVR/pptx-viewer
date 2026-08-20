import type { PptxElementAnimation } from 'pptx-viewer-core';
import { reorderAnimationTo } from 'pptx-viewer-shared';

/**
 * Reorders `entries` (already `order`-sorted, per this file's caller) by
 * moving `sourceId`'s entry to `targetId`'s position. Both sides are keyed
 * by elementId, the ribbon-tab timeline drags a row rather than tracking a
 * row index, so the target elementId is resolved to an index before
 * delegating to the shared splice-and-reindex algorithm.
 */
export function reorderAnimationEntries(
	entries: readonly PptxElementAnimation[],
	sourceId: string,
	targetId: string,
): PptxElementAnimation[] {
	const targetIndex = entries.findIndex((entry) => entry.elementId === targetId);
	if (targetIndex < 0) {
		return [...entries];
	}
	return reorderAnimationTo(entries, { elementId: sourceId }, targetIndex);
}
