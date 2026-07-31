/**
 * selection-geometry.ts: Pure geometry helpers for `SlideCanvasComponent`'s
 * selection outline, resize/rotate/adjust handles, and the
 * pointer-target-to-interactive-element resolution. No Angular dependency, so
 * these are trivially unit-testable and reusable outside the component.
 */

import type { PptxElement } from 'pptx-viewer-core';

import { resolveTopLevelElementId } from '../internal/shared-src/render/element-hit-test';
import { handleAnchor, handleCursor, RESIZE_HANDLES } from './drag-resize';
import type { Box, ResizeHandle } from './drag-resize';
import { isElementInteractive } from './template-mode';

/** A selected element's bounding box (stage coords), keyed by id. */
export interface SelectionBox extends Box {
	id: string;
}

/** A resize-handle's render box (stage coords) plus its cursor style. */
export interface HandleBox {
	handle: ResizeHandle;
	left: number;
	top: number;
	size: number;
	cursor: string;
}

/** A rotate/adjust handle's render box (stage coords). */
export interface CornerHandleBox {
	left: number;
	top: number;
	size: number;
}

/** Bounding boxes (stage coords) for the given selected element ids. */
export function computeSelectionBoxes(
	elements: readonly PptxElement[],
	selectedIds: readonly string[],
): SelectionBox[] {
	const selected = new Set(selectedIds);
	if (selected.size === 0) {
		return [];
	}
	return elements
		.filter((el) => selected.has(el.id))
		.map((el) => ({ id: el.id, x: el.x, y: el.y, width: el.width, height: el.height }));
}

/** The single selected element's box, or null when 0 or >1 are selected. */
export function computeSingleSelected(
	elements: readonly PptxElement[],
	selectedIds: readonly string[],
): (Box & { id: string }) | null {
	if (selectedIds.length !== 1) {
		return null;
	}
	const el = elements.find((e) => e.id === selectedIds[0]);
	return el ? { id: el.id, x: el.x, y: el.y, width: el.width, height: el.height } : null;
}

/** Resize-handle render boxes (stage coords) for the single selection. */
export function computeHandleBoxes(
	box: (Box & { id: string }) | null,
	editable: boolean,
	handleScreenPx: number,
	zoom: number,
): HandleBox[] {
	if (!editable || !box) {
		return [];
	}
	const size = handleScreenPx / (zoom || 1);
	return RESIZE_HANDLES.map((handle) => {
		const { fx, fy } = handleAnchor(handle);
		return {
			handle,
			left: box.x + fx * box.width - size / 2,
			top: box.y + fy * box.height - size / 2,
			size,
			cursor: handleCursor(handle),
		};
	});
}

/**
 * A corner handle box (rotate or shape-adjust) offset above/outside the
 * single selection's box by `offsetPx` (screen pixels, scaled by zoom).
 */
export function computeCornerHandle(
	box: (Box & { id: string }) | null,
	editable: boolean,
	handleScreenPx: number,
	offsetPx: number,
	zoom: number,
	corner: 'top-center' | 'top-left',
): CornerHandleBox | null {
	if (!editable || !box) {
		return null;
	}
	const z = zoom || 1;
	const size = handleScreenPx / z;
	const offset = offsetPx / z;
	if (corner === 'top-center') {
		return { left: box.x + box.width / 2 - size / 2, top: box.y - offset - size / 2, size };
	}
	return { left: box.x - offset - size / 2, top: box.y - offset - size / 2, size };
}

/**
 * Resolve the id of the interactive element under a pointer target, or null.
 *
 * Resolution goes through the shared hit-test, which answers with the TOP-LEVEL
 * element rather than the innermost `data-element-id` node. That distinction is
 * the whole point here: a group renders its children's nodes inside its own, so
 * the innermost node under a click is usually a grouped CHILD, whose id is not
 * in `allElements`. This function used to look that child id up, find nothing,
 * and report "no element", which CLEARED the selection: Ungroup was then only
 * reachable by hitting a gap inside the group's box that missed every child.
 * PowerPoint (and React, Vanilla and Svelte) select the group instead.
 *
 * Template (master/layout) elements are only interactive while
 * `editTemplateMode` is on; when off they are reported as null so the canvas
 * treats them as background (no select/drag/context-menu/inline-edit).
 */
export function resolveInteractiveElementId(
	target: EventTarget | null,
	allElements: readonly PptxElement[],
	editTemplateMode: boolean,
): string | null {
	const id = resolveTopLevelElementId(target);
	if (!id) {
		return null;
	}
	const el = allElements.find((e) => e.id === id);
	if (!el) {
		return null;
	}
	return isElementInteractive(el, true, editTemplateMode) ? id : null;
}
