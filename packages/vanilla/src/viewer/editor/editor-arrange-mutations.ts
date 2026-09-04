import type { PptxElement } from 'pptx-viewer-core';
import type { AlignEdge, DistributeAxis, ElementPosition } from 'pptx-viewer-shared';
import {
	alignElements,
	canInteractWithElement,
	distributeElements,
	groupElements,
	ungroupElements,
} from 'pptx-viewer-shared';

/**
 * Pure slide-element-array transforms backing the ribbon's Arrange group
 * (align / distribute / flip / group / ungroup). Layered on the shared
 * `element-align.ts` / `group-ops.ts` primitives. Shift-click and marquee
 * selection feed these transforms the current top-level selection ids.
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
 * selection model; {@link alignSelection} is the PowerPoint multi-selection
 * mode relative to the selection's own bounding box.
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
 * Shift-click and marquee selections provide the two or more ids required by
 * {@link groupElements}.
 */
export function groupSelection(
	elements: readonly PptxElement[],
	ids: readonly string[],
	groupId: string,
): { elements: PptxElement[]; groupId: string | null } {
	// G10: a:spLocks/@noGrouping rejects the whole attempt if it involves a
	// locked shape, not just that one shape.
	const selected = ids.map((id) => elements.find((el) => el.id === id));
	if (!selected.every((el) => canInteractWithElement(el, 'group'))) {
		return { elements: [...elements], groupId: null };
	}
	return groupElements(elements, ids, groupId);
}

/**
 * Ungroup the `group` element identified by `groupId` back into its children.
 *
 * `intoTemplate` decides which store the promoted subtree routes to: it renames
 * the descendants of a promoted NESTED group whose ids sit on the other side,
 * which nothing did while only the top level was renamed.
 */
export function ungroupSelection(
	elements: readonly PptxElement[],
	groupId: string,
	childIds: readonly string[],
	intoTemplate = false,
): { elements: PptxElement[]; childIds: string[] } {
	// G10: a:grpSpLocks/@noGrouping forbids ungrouping this specific group.
	const group = elements.find((el) => el.id === groupId);
	if (!canInteractWithElement(group, 'group')) {
		return { elements: [...elements], childIds: [] };
	}
	return ungroupElements(elements, groupId, childIds, { intoTemplate });
}
