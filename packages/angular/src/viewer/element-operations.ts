/**
 * Thin re-export shim -> vendored `pptx-viewer-shared`.
 *
 * The pure array-transformation operations (update/move/resize/delete/
 * duplicate + z-order) were extracted to `pptx-viewer-shared`
 * (`render/element-operations`) and are consumed by every binding. This shim
 * preserves the historical Angular import surface so `editor-state.service`,
 * the viewer barrel, the colocated tests, and any future importers are
 * unchanged.
 *
 * The four id-addressed patch/geometry operations are wrapped so they also
 * reach a GROUP MEMBER (selected by drilling into its group, shared
 * `group-drill`). The shared versions only map the top level, so a member id
 * was a silent no-op. For a member the patch is in slide space (what the
 * canvas chrome, the inspector and the inline editor show) and the shared
 * `updateElementInTree` writes it back into the group's coordinate space.
 */

import type { PptxElement } from 'pptx-viewer-core';

import {
	moveElementBy as moveTopLevelElementBy,
	resizeElement as resizeTopLevelElement,
	setElementPosition as setTopLevelElementPosition,
	slideSpaceElement,
	updateElementById as updateTopLevelElementById,
	updateElementInTree,
} from '../internal/shared';

export {
	deleteElementsByIds,
	duplicateElementById,
	bringToFront,
	sendToBack,
	bringForward,
	sendBackward,
} from '../internal/shared';

/** Smallest permitted width/height after a resize (the shared operation's guard). */
const MIN_ELEMENT_SIZE = 1;

function isTopLevel(elements: readonly PptxElement[], id: string): boolean {
	return elements.some((el) => el.id === id);
}

/** A member patch: slide-space geometry, and never a change of the discriminant `type`. */
function memberUpdate(
	elements: readonly PptxElement[],
	id: string,
	patch: Partial<PptxElement>,
): PptxElement[] {
	const safe = { ...patch } as Record<string, unknown>;
	delete safe.type;
	return updateElementInTree(elements as PptxElement[], id, safe as Partial<PptxElement>);
}

/**
 * Shallow-merge `patch` onto the element with `id`, top-level or a group
 * member (member geometry in slide space). The discriminant `type` is kept.
 */
export function updateElementById(
	elements: readonly PptxElement[],
	id: string,
	patch: Partial<PptxElement>,
): PptxElement[] {
	return isTopLevel(elements, id)
		? updateTopLevelElementById(elements, id, patch)
		: memberUpdate(elements, id, patch);
}

/** Translate the element (top-level or group member) by `(dx, dy)`. */
export function moveElementBy(
	elements: readonly PptxElement[],
	id: string,
	dx: number,
	dy: number,
): PptxElement[] {
	if (isTopLevel(elements, id)) {
		return moveTopLevelElementBy(elements, id, dx, dy);
	}
	const member = slideSpaceElement(elements, id);
	return member
		? memberUpdate(elements, id, { x: member.x + dx, y: member.y + dy })
		: (elements as PptxElement[]);
}

/** Set the position of the element (a member's `x`/`y` in slide space). */
export function setElementPosition(
	elements: readonly PptxElement[],
	id: string,
	x: number,
	y: number,
): PptxElement[] {
	return isTopLevel(elements, id)
		? setTopLevelElementPosition(elements, id, x, y)
		: memberUpdate(elements, id, { x, y });
}

/** Set the size of the element (top-level or member), clamped to at least 1. */
export function resizeElement(
	elements: readonly PptxElement[],
	id: string,
	width: number,
	height: number,
): PptxElement[] {
	return isTopLevel(elements, id)
		? resizeTopLevelElement(elements, id, width, height)
		: memberUpdate(elements, id, {
				width: Math.max(MIN_ELEMENT_SIZE, width),
				height: Math.max(MIN_ELEMENT_SIZE, height),
			});
}
