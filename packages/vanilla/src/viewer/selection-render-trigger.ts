import type { PptxElement } from 'pptx-viewer-core';

/**
 * Does a selection change need the stage re-rendered?
 *
 * A chart arms its on-canvas mark hit-testing only while selected
 * (`render/elements/chart-editable.ts`), and that arming happens at render
 * time, so a chart entering or leaving the selection must rebuild the stage.
 * No other element type renders differently when selected, and rebuilding the
 * stage on EVERY selection change is not free: the first click of a
 * double-click selects the element, the rebuild replaces the very node under
 * the pointer, and the browser never forms a `dblclick` (a table cell could no
 * longer be opened for editing). So only a chart crossing the selection
 * boundary triggers the render; a plain shape, text box or table keeps its DOM.
 */
export function selectionChangeNeedsStageRender(
	previous: readonly string[],
	next: readonly string[],
	elements: readonly PptxElement[],
): boolean {
	if (previous === next) {
		return false;
	}
	const before = new Set(previous);
	const after = new Set(next);
	return elements.some(
		(element) => element.type === 'chart' && before.has(element.id) !== after.has(element.id),
	);
}
