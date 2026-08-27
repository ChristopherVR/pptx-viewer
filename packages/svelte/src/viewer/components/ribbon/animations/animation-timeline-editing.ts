import type { PptxAnimationTimelineAnchor, PptxElementAnimation } from 'pptx-viewer-core';
import {
	applyAnimationTimelineOrder,
	buildAnimationTimelineRows,
	reorderAnimationTimelineRows,
} from 'pptx-viewer-shared';

/**
 * Reorders `entries` by moving the editor-authored animation for `sourceId`
 * to `targetKey`'s position in the FULL sequence (editor entries merged with
 * `anchors`, the deck's own read-only effect groups). Both sides are keyed
 * by row key: the ribbon-tab timeline drags a row rather than tracking a
 * row index, and a drop target may name a native anchor's key
 * (`native:<order>`), which is how an editor effect ends up ahead of or
 * behind one of the deck's own.
 */
export function reorderAnimationEntries(
	entries: readonly PptxElementAnimation[],
	anchors: readonly PptxAnimationTimelineAnchor[],
	sourceId: string,
	targetKey: string,
): PptxElementAnimation[] {
	const rows = buildAnimationTimelineRows(entries, anchors);
	const sourceKey = `editor:${sourceId}`;
	const targetIndex = rows.findIndex((row) => row.key === targetKey);
	if (targetIndex < 0 || !rows.some((row) => row.key === sourceKey)) {
		return [...entries];
	}
	const nextRows = reorderAnimationTimelineRows(rows, sourceKey, targetIndex);
	return applyAnimationTimelineOrder(entries, nextRows);
}
