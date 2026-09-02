import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import {
	bringForward,
	bringToFront,
	reorderElementOnSlide,
	sendBackward,
	sendToBack,
} from 'pptx-viewer-shared';

/**
 * Z-order (paint-order) reordering for the Svelte editor.
 *
 * The array-level primitives (`bringToFront`, `sendToBack`, `bringForward`,
 * `sendBackward`) are the shared, framework-agnostic operations from
 * `pptx-viewer-shared` (`render/element-operations`), where array index 0 is
 * the back and the last index is the front. This module only lifts them to the
 * slide-array shape the editor state stores, reusing the shared
 * `reorderElementOnSlide` helper as the other mutations do.
 */

/** Which way to move the selected element through the paint-order stack. */
export type ZOrderDirection = 'front' | 'back' | 'forward' | 'backward';

const OPS: Record<
	ZOrderDirection,
	(elements: readonly PptxElement[], id: string) => PptxElement[]
> = {
	front: bringToFront,
	back: sendToBack,
	forward: bringForward,
	backward: sendBackward,
};

/** Reorder the element with `id` on the given slide (immutable). */
export function reorderElement(
	slides: readonly PptxSlide[],
	slideIndex: number,
	id: string,
	direction: ZOrderDirection,
): PptxSlide[] {
	const op = OPS[direction];
	return reorderElementOnSlide(slides, slideIndex, (elements) => op(elements, id));
}
