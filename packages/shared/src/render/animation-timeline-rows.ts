/**
 * `animation-timeline-rows`: merge the editor's own animation list with the
 * deck's own (native) effect anchors into ONE orderable timeline, so the
 * authoring panel's drag-to-reorder can target any position in the FULL
 * sequence, not just among the effects this editor added.
 *
 * `PptxSlide.animations` (`PptxElementAnimation[]`) never contains the deck's
 * own effects: they surface only as read-only
 * `PptxSlide.animationTimelineAnchors` (see `pptx-viewer-core`'s
 * `animation-timeline-anchors` service), grounded in the SAME `order`
 * numbering space at load time. This module is the pure bridge between the
 * two: build one merged, sorted row list to render, and reorder it by moving
 * an editor row to an arbitrary index, deriving new `order` values for every
 * editor entry (native rows are never written back; their relative order is
 * implied by where they land in the merged list).
 *
 * Pure: imports only `pptx-viewer-core` types; no framework, no DOM.
 *
 * @module render/animation-timeline-rows
 */
import type { PptxAnimationTimelineAnchor, PptxElementAnimation } from 'pptx-viewer-core';

/** One row in the merged, orderable animation timeline. */
export type AnimationTimelineRow =
	| {
			kind: 'editor';
			/** Stable key for drag-and-drop: one row per editor animation entry. */
			key: string;
			order: number;
			elementId: string;
	  }
	| {
			kind: 'native';
			/** Stable key for drag-and-drop: a synthetic id from the anchor's load-time order. */
			key: string;
			order: number;
			targetIds: string[];
			presetClasses: PptxAnimationTimelineAnchor['presetClasses'];
	  };

/** Build a `native` row's stable key from its anchor. */
function nativeRowKey(anchor: PptxAnimationTimelineAnchor): string {
	return `native:${anchor.order}`;
}

/**
 * Merge `animations` (editor-authored, draggable) with `anchors` (the deck's
 * own effect groups, read-only) into one row list sorted by `order`.
 *
 * Both populations were grounded in the same numbering space at load time
 * (see core's `computeAnimationTimelineOrder`), so a plain sort interleaves
 * them correctly with no further reconciliation.
 */
export function buildAnimationTimelineRows(
	animations: readonly PptxElementAnimation[],
	anchors: readonly PptxAnimationTimelineAnchor[] = [],
): AnimationTimelineRow[] {
	const editorRows: AnimationTimelineRow[] = animations.map((anim) => ({
		kind: 'editor',
		key: `editor:${anim.elementId}`,
		order: anim.order ?? 0,
		elementId: anim.elementId,
	}));
	const nativeRows: AnimationTimelineRow[] = anchors.map((anchor) => ({
		kind: 'native',
		key: nativeRowKey(anchor),
		order: anchor.order,
		targetIds: anchor.targetIds,
		presetClasses: anchor.presetClasses,
	}));
	return [...editorRows, ...nativeRows].sort((a, b) => a.order - b.order);
}

/**
 * Move the row identified by `sourceKey` (editor OR native) to `targetIndex`
 * within the FULL merged sequence, then re-normalise every row's `order` to
 * a dense 0..n-1. This is the drag-and-drop primitive every binding's
 * animation timeline calls: unlike the editor-only `reorderAnimationTo`, the
 * source and target may be a native row, letting an editor-authored effect
 * land ahead of or behind one of the deck's own.
 *
 * A native row can be dragged too (as a drop target resolution convenience);
 * {@link applyAnimationTimelineOrder} simply never writes a native row's
 * `order` back anywhere, so moving one only affects where OTHER rows sort
 * relative to it in this returned list, not the deck's own XML.
 */
export function reorderAnimationTimelineRows(
	rows: readonly AnimationTimelineRow[],
	sourceKey: string,
	targetIndex: number,
): AnimationTimelineRow[] {
	const sorted = [...rows].sort((a, b) => a.order - b.order);
	const sourceIndex = sorted.findIndex((row) => row.key === sourceKey);
	if (
		sourceIndex < 0 ||
		targetIndex < 0 ||
		targetIndex >= sorted.length ||
		sourceIndex === targetIndex
	) {
		return sorted.map((row, i) => ({ ...row, order: i }));
	}
	const [moved] = sorted.splice(sourceIndex, 1);
	sorted.splice(targetIndex, 0, moved!);
	return sorted.map((row, i) => ({ ...row, order: i }));
}

/**
 * Write a merged row list's `order` values back onto `animations` (matched by
 * `elementId`), then sort the result by that new `order` so the returned
 * array's own position already reflects the drop, matching every binding's
 * previous editor-only `reorderAnimationTo` contract. Native rows are
 * read-only and contribute nothing here: their position is implied by the
 * editor rows sorting around them, not by any field this app persists for
 * them.
 */
export function applyAnimationTimelineOrder(
	animations: readonly PptxElementAnimation[],
	rows: readonly AnimationTimelineRow[],
): PptxElementAnimation[] {
	const orderByElementId = new Map<string, number>();
	for (const row of rows) {
		if (row.kind === 'editor') {
			orderByElementId.set(row.elementId, row.order);
		}
	}
	return animations
		.map((anim) => {
			const order = orderByElementId.get(anim.elementId);
			return order === undefined || order === anim.order ? anim : { ...anim, order };
		})
		.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Move one editor animation's row a single step within the FULL merged
 * timeline (`delta` of -1 or +1), which may cross a native anchor. This is
 * the one-step "move up" / "move down" button affordance every binding pairs
 * with drag-and-drop; a no-op (returns `animations` unchanged) when
 * `elementId` has no row or the step would go out of range.
 */
export function moveAnimationTimelineRowBy(
	animations: readonly PptxElementAnimation[],
	anchors: readonly PptxAnimationTimelineAnchor[],
	elementId: string,
	delta: -1 | 1,
): PptxElementAnimation[] {
	const rows = buildAnimationTimelineRows(animations, anchors);
	const key = `editor:${elementId}`;
	const index = rows.findIndex((row) => row.key === key);
	if (index < 0) {
		return [...animations];
	}
	const nextRows = reorderAnimationTimelineRows(rows, key, index + delta);
	return applyAnimationTimelineOrder(animations, nextRows);
}
