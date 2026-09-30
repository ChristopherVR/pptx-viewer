import type { PptxElement } from 'pptx-viewer-core';
import { parentSelection, selectionBounds, slideSpaceElement } from 'pptx-viewer-shared';

import type { OverlayBox } from './selection-overlay';

/** Resolve the overlay box for a single or collective selection. */
export function selectionOverlayBox(elements: readonly PptxElement[]): OverlayBox | null {
	if (elements.length === 0) {
		return null;
	}
	if (elements.length > 1) {
		const bounds = selectionBounds(elements);
		return bounds ? { ...bounds, rotation: bounds.rotation ?? 0 } : null;
	}
	const element = elements[0];
	return {
		x: element.x,
		y: element.y,
		width: element.width,
		height: element.height,
		rotation: element.rotation ?? 0,
	};
}

/**
 * The dashed frame of the group the selection was clicked into (shared
 * `group-drill`): the selected member's parent group, in slide space. Null when
 * the selection is a top-level element, missing, or a multi-selection.
 */
export function enteredGroupBox(
	elements: readonly PptxElement[],
	selectedIds: readonly string[],
): OverlayBox | null {
	if (selectedIds.length !== 1) {
		return null;
	}
	const parentId = parentSelection(elements, selectedIds[0]);
	const group = parentId ? slideSpaceElement(elements, parentId) : null;
	return group
		? { x: group.x, y: group.y, width: group.width, height: group.height, rotation: 0 }
		: null;
}
