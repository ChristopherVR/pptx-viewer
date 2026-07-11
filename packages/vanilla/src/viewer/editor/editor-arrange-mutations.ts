import type { PptxElement } from 'pptx-viewer-core';
import type { AlignEdge, DistributeAxis, ElementPosition } from 'pptx-viewer-shared';
import {
	alignElements,
	distributeElements,
	groupElements,
	ungroupElements,
} from 'pptx-viewer-shared';

/**
 * Pure slide-element-array transforms backing the ribbon's Arrange group
 * (align / distribute / flip / group / ungroup). Layered on the shared
 * `element-align.ts` / `group-ops.ts` primitives; the vanilla editor has no
 * multi-element selection model yet (see {@link groupSelection} docs), so
 * `alignSelection` / `distributeSelection` degrade gracefully (a selection of
 * one has nothing to align against and is a no-op, matching the shared
 * helpers' own "fewer than 2/3 elements" no-op behaviour).
 */

/** Apply an align/distribute position map onto matching elements, immutably. */
function applyPositions(
	elements: readonly PptxElement[],
	positions: ReadonlyMap<string, ElementPosition>,
): PptxElement[] {
	if (positions.size === 0) {
		return [...elements];
	}
	return elements.map((el) => {
		const pos = positions.get(el.id);
		if (!pos) {
			return el;
		}
		return { ...el, x: pos.x ?? el.x, y: pos.y ?? el.y };
	});
}

/** Align every element whose id is in `ids` to a shared edge/centre of their bounding box. */
export function alignSelection(
	elements: readonly PptxElement[],
	ids: readonly string[],
	edge: AlignEdge,
): PptxElement[] {
	const idSet = new Set(ids);
	const selected = elements.filter((el) => idSet.has(el.id));
	return applyPositions(elements, alignElements(selected, edge));
}

/** Distribute every element whose id is in `ids` with equal gaps along `axis`. */
export function distributeSelection(
	elements: readonly PptxElement[],
	ids: readonly string[],
	axis: DistributeAxis,
): PptxElement[] {
	const idSet = new Set(ids);
	const selected = elements.filter((el) => idSet.has(el.id));
	return applyPositions(elements, distributeElements(selected, axis));
}

/**
 * Align a *single* element to the slide canvas bounds (PowerPoint's
 * single-selection align behaviour: with nothing else selected, "Align Left"
 * etc. aligns to the slide, not to other objects). This is the alignment mode
 * the vanilla editor actually reaches today given its single-element
 * selection model; {@link alignSelection} (multi-element, relative to the
 * selection's own bounding box) is the PowerPoint multi-selection mode and is
 * kept for when a future multi-select model lands.
 */
export function alignToCanvas(
	el: PptxElement,
	edge: AlignEdge,
	canvas: { width: number; height: number },
): Partial<PptxElement> {
	switch (edge) {
		case 'left':
			return { x: 0 };
		case 'right':
			return { x: canvas.width - el.width };
		case 'centerH':
			return { x: (canvas.width - el.width) / 2 };
		case 'top':
			return { y: 0 };
		case 'bottom':
			return { y: canvas.height - el.height };
		case 'middle':
			return { y: (canvas.height - el.height) / 2 };
	}
}

/** Toggle horizontal/vertical flip on a single element (returns the patch, not the array). */
export function flipElement(
	el: PptxElement,
	direction: 'horizontal' | 'vertical',
): Partial<PptxElement> {
	return direction === 'horizontal'
		? { flipHorizontal: !el.flipHorizontal }
		: { flipVertical: !el.flipVertical };
}

/**
 * Group the elements whose id is in `ids` into a single `group` element.
 *
 * The vanilla editor's selection model is currently single-element
 * (`selectedElementId: string | null`, see `state/viewer-state.ts`), so `ids`
 * will almost always have fewer than the 2 members {@link groupElements}
 * requires; this is a documented limitation (no marquee/shift-click
 * multi-select yet), not a bug in this helper. The function is still exposed
 * (and exercised by tests) so a future multi-select selection model can wire
 * straight into it.
 */
export function groupSelection(
	elements: readonly PptxElement[],
	ids: readonly string[],
	groupId: string,
): { elements: PptxElement[]; groupId: string | null } {
	return groupElements(elements, ids, groupId);
}

/** Ungroup the `group` element identified by `groupId` back into its children. */
export function ungroupSelection(
	elements: readonly PptxElement[],
	groupId: string,
	childIds: readonly string[],
): { elements: PptxElement[]; childIds: string[] } {
	return ungroupElements(elements, groupId, childIds);
}
