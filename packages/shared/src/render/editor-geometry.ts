import { MIN_ELEMENT_SIZE } from 'pptx-viewer-core';

import { NUDGE_LARGE, NUDGE_SMALL, editorNudgeDelta } from './editor-keymap';
import type { BoxTransform, InteractionBox, ResizeHandleId } from './element-interaction';

/**
 * Small geometry helpers the `element-interaction` module does not cover:
 * Shift-to-lock-aspect on corner resizes and arrow-key nudge steps. Pure math
 * only; no DOM dependencies, so it is unit-testable in isolation. Extracted
 * from four byte-identical copies (Svelte / Vanilla `editor/editor-geometry`).
 */

/**
 * Arrow-key nudge step in element px (Shift multiplies to the large step).
 * Aliases of the keymap's `NUDGE_SMALL`/`NUDGE_LARGE`: the step is defined once
 * so the inspector's position boxes and the keyboard cannot disagree.
 */
export const NUDGE_STEP = NUDGE_SMALL;
export const NUDGE_STEP_LARGE = NUDGE_LARGE;

const CORNER_HANDLES: ReadonlySet<ResizeHandleId> = new Set(['nw', 'ne', 'se', 'sw']);

/** True for the four corner handles (the ones Shift aspect-locks). */
export function isCornerHandle(handle: ResizeHandleId): boolean {
	return CORNER_HANDLES.has(handle);
}

/**
 * Constrain a corner resize (already computed by the shared `applyResize`) to
 * the start box's aspect ratio: the axis with the larger relative change wins
 * and the other follows, keeping the anchored (opposite) corner fixed. Edge
 * handles are returned unchanged; aspect-locking a one-axis handle would
 * fight the drag direction.
 */
export function lockResizeAspect(
	resized: BoxTransform,
	start: InteractionBox,
	handle: ResizeHandleId,
	minSize: number = MIN_ELEMENT_SIZE,
): BoxTransform {
	if (!isCornerHandle(handle) || start.width <= 0 || start.height <= 0) {
		return resized;
	}
	const scaleW = resized.width / start.width;
	const scaleH = resized.height / start.height;
	const scale = Math.abs(scaleW - 1) >= Math.abs(scaleH - 1) ? scaleW : scaleH;

	let width = start.width * scale;
	let height = start.height * scale;
	// Clamp preserving the ratio: bump the scale so both axes stay >= minSize.
	if (width < minSize || height < minSize) {
		const clampScale = Math.max(minSize / start.width, minSize / start.height);
		width = start.width * clampScale;
		height = start.height * clampScale;
	}

	const affectsLeft = handle === 'nw' || handle === 'sw';
	const affectsTop = handle === 'nw' || handle === 'ne';
	return {
		x: affectsLeft ? start.x + start.width - width : start.x,
		y: affectsTop ? start.y + start.height - height : start.y,
		width,
		height,
		rotation: resized.rotation,
	};
}

/**
 * Map an arrow key to a nudge delta in element px, or `null` for other keys.
 * `large` (Shift held) uses the 10px step. Same function as the keymap's
 * `editorNudgeDelta`, kept under this name for the Svelte/Vanilla editors.
 */
export const nudgeDelta: typeof editorNudgeDelta = editorNudgeDelta;
