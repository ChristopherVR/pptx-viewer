import { MIN_ELEMENT_SIZE } from 'pptx-viewer-core';

import type { BoxTransform, InteractionBox, ResizeHandleId } from './element-interaction';

/**
 * Small geometry helpers the `element-interaction` module does not cover:
 * Shift-to-lock-aspect on corner resizes and arrow-key nudge steps. Pure math
 * only; no DOM dependencies, so it is unit-testable in isolation. Extracted
 * from four byte-identical copies (Svelte / Vanilla `editor/editor-geometry`).
 */

/** Arrow-key nudge step in element px (Shift multiplies to the large step). */
export const NUDGE_STEP = 1;
export const NUDGE_STEP_LARGE = 10;

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
 * `large` (Shift held) uses the 10px step.
 */
export function nudgeDelta(key: string, large: boolean): { dx: number; dy: number } | null {
	const step = large ? NUDGE_STEP_LARGE : NUDGE_STEP;
	switch (key) {
		case 'ArrowLeft':
			return { dx: -step, dy: 0 };
		case 'ArrowRight':
			return { dx: step, dy: 0 };
		case 'ArrowUp':
			return { dx: 0, dy: -step };
		case 'ArrowDown':
			return { dx: 0, dy: step };
		default:
			return null;
	}
}
