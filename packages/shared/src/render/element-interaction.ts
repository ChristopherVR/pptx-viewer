/**
 * element-interaction — PURE geometry helpers for the editing interaction
 * overlay (drag / resize / rotate). No DOM, no Vue: everything here is plain
 * math so it can be unit-tested in isolation.
 *
 * Coordinate spaces
 * -----------------
 * - "screen px": raw pointer movement reported by `PointerEvent.clientX/Y`,
 *   measured on the *scaled* slide canvas.
 * - "element px": the slide's own unscaled coordinate space, which is what
 *   `PptxElement.x/y/width/height` use. To convert a screen delta into an
 *   element delta you divide by the `zoom` (the canvas scale factor).
 *
 * Rotation handling
 * -----------------
 * When an element is rotated, its local axes are rotated too. A drag along the
 * screen X axis must therefore be projected onto the element's local axes
 * before being applied to width/height (resize) — but a plain *move* (drag of
 * the whole box) is unaffected by rotation because the box position is stored
 * axis-aligned. Resize math here rotates the screen delta into element-local
 * space, applies the per-handle resize, then leaves x/y as the new top-left of
 * the axis-aligned bounding box (matching the React implementation, which keeps
 * the resize math in element-local space via the element's CSS transform).
 */
import { MIN_ELEMENT_SIZE } from 'pptx-viewer-core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Axis-aligned box in element (unscaled) coordinate space, plus rotation. */
export interface InteractionBox {
	x: number;
	y: number;
	width: number;
	height: number;
	/** Degrees. Defaults to 0 when omitted. */
	rotation?: number;
}

/** Result of a drag/resize/rotate computation. */
export interface BoxTransform {
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
}

/** The eight resize handles, named by compass direction. */
export type ResizeHandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const RESIZE_HANDLES: readonly ResizeHandleId[] = [
	'nw',
	'n',
	'ne',
	'e',
	'se',
	's',
	'sw',
	'w',
] as const;

export interface Point {
	x: number;
	y: number;
}

export interface ResizeOptions {
	/** Minimum width/height in element px. Defaults to `MIN_ELEMENT_SIZE`. */
	minSize?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function rotationOf(box: InteractionBox): number {
	return box.rotation ?? 0;
}

/**
 * Rotate a screen-space delta into element-local space.
 *
 * Given a vector expressed in the canvas (screen) frame and the element's
 * rotation in degrees, return the same vector expressed in the element's local
 * (un-rotated) frame. This is the inverse rotation of `rotationDeg`.
 */
export function rotateDelta(dx: number, dy: number, rotationDeg: number): Point {
	if (!rotationDeg) {
		return { x: dx, y: dy };
	}
	const rad = -rotationDeg * DEG_TO_RAD;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	return {
		x: dx * cos - dy * sin,
		y: dx * sin + dy * cos,
	};
}

/** Center point of a box in element coordinates. */
export function boxCenter(box: InteractionBox): Point {
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// ---------------------------------------------------------------------------
// Drag (move)
// ---------------------------------------------------------------------------

/**
 * Apply a screen-space pointer delta as a plain move of the whole box.
 *
 * Position is stored axis-aligned, so rotation does NOT affect a move — we only
 * scale the screen delta down by `zoom` to get element px.
 */
export function applyDragDelta(
	box: InteractionBox,
	dxScreen: number,
	dyScreen: number,
	zoom: number,
): BoxTransform {
	const scale = zoom || 1;
	return {
		x: box.x + dxScreen / scale,
		y: box.y + dyScreen / scale,
		width: box.width,
		height: box.height,
		rotation: rotationOf(box),
	};
}

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------

/**
 * Compute the new geometry for a resize drag on a given handle.
 *
 * `dxScreen`/`dyScreen` are the *total* pointer delta from the gesture start,
 * in screen px. They are scaled by `zoom` into element px and (when the element
 * is rotated) rotated into the element's local frame so the handle behaves
 * intuitively. The min-size clamp uses `opts.minSize` (default
 * `MIN_ELEMENT_SIZE`).
 *
 * The returned box keeps the element's `rotation` unchanged. x/y describe the
 * new axis-aligned top-left in element space; for rotated elements this matches
 * the React behaviour of resizing in local space under a CSS transform.
 */
export function applyResize(
	box: InteractionBox,
	handle: ResizeHandleId,
	dxScreen: number,
	dyScreen: number,
	zoom: number,
	opts: ResizeOptions = {},
): BoxTransform {
	const scale = zoom || 1;
	const minSize = opts.minSize ?? MIN_ELEMENT_SIZE;
	const rotation = rotationOf(box);

	// Screen delta -> element px -> element-local frame.
	const local = rotateDelta(dxScreen / scale, dyScreen / scale, rotation);
	const dx = local.x;
	const dy = local.y;

	let newX = box.x;
	let newY = box.y;
	let newW = box.width;
	let newH = box.height;

	const affectsLeft = handle === 'nw' || handle === 'w' || handle === 'sw';
	const affectsRight = handle === 'ne' || handle === 'e' || handle === 'se';
	const affectsTop = handle === 'nw' || handle === 'n' || handle === 'ne';
	const affectsBottom = handle === 'sw' || handle === 's' || handle === 'se';

	if (affectsRight) {
		newW = Math.max(minSize, box.width + dx);
	} else if (affectsLeft) {
		newW = Math.max(minSize, box.width - dx);
		newX = box.x + (box.width - newW);
	}

	if (affectsBottom) {
		newH = Math.max(minSize, box.height + dy);
	} else if (affectsTop) {
		newH = Math.max(minSize, box.height - dy);
		newY = box.y + (box.height - newH);
	}

	return { x: newX, y: newY, width: newW, height: newH, rotation };
}

// ---------------------------------------------------------------------------
// Rotation
// ---------------------------------------------------------------------------

/**
 * Compute the rotation angle (degrees) for a pointer relative to a center.
 *
 * 0deg points straight up (the rotate handle sits above the element), matching
 * the screen "up = -Y" convention. The result is normalised to [0, 360).
 */
export function computeRotation(center: Point, pointer: Point): number {
	const dx = pointer.x - center.x;
	const dy = pointer.y - center.y;
	// atan2(dx, -dy): 0 when pointer is directly above center, increasing
	// clockwise (the visual direction of a positive CSS rotation).
	const deg = Math.atan2(dx, -dy) * RAD_TO_DEG;
	return ((deg % 360) + 360) % 360;
}

/**
 * Snap an angle to the nearest `step` degrees when within `tolerance`.
 * Used for Shift-to-snap rotation (e.g. step = 15). Returns the original angle
 * when no snap target is close enough.
 */
export function snapAngle(angleDeg: number, step = 15, tolerance = step / 2): number {
	const nearest = Math.round(angleDeg / step) * step;
	if (Math.abs(angleDeg - nearest) <= tolerance) {
		return ((nearest % 360) + 360) % 360;
	}
	return angleDeg;
}

// ---------------------------------------------------------------------------
// Grid snapping (resize)
// ---------------------------------------------------------------------------

/** Bounding box for grid-snap, in element coordinates. */
export interface GridSnapBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Snap the edges of a resize box to a pixel grid.
 *
 * Each of the four edges touched by `handle` is rounded to the nearest multiple
 * of `gridSpacingPx`; the opposite (anchored) edge is left untouched, and the
 * dimension is recomputed from the two edges (clamped to `minSize`). This mirrors
 * the per-edge snap React applies after computing a raw resize: a handle that
 * affects the right/bottom edge snaps that edge and keeps x/y fixed, while a
 * handle that affects the left/top edge snaps the origin and grows/shrinks the
 * size to compensate.
 *
 * `handle === null` (a plain move, no resize) returns the box unchanged.
 */
export function snapBoxToGrid(
	box: GridSnapBox,
	handle: ResizeHandleId | null,
	gridSpacingPx: number,
	minSize = MIN_ELEMENT_SIZE,
): GridSnapBox {
	if (handle === null || gridSpacingPx <= 0) {
		return box;
	}

	let { x, y, width, height } = box;
	const gs = gridSpacingPx;

	const affectsLeft = handle === 'nw' || handle === 'w' || handle === 'sw';
	const affectsRight = handle === 'ne' || handle === 'e' || handle === 'se';
	const affectsTop = handle === 'nw' || handle === 'n' || handle === 'ne';
	const affectsBottom = handle === 'sw' || handle === 's' || handle === 'se';

	// Snap right edge (x fixed).
	if (affectsRight) {
		const right = Math.round((x + width) / gs) * gs;
		width = Math.max(minSize, right - x);
	}
	// Snap left edge (origin moves, width compensates).
	if (affectsLeft) {
		const snappedX = Math.round(x / gs) * gs;
		width = Math.max(minSize, width + (x - snappedX));
		x = snappedX;
	}
	// Snap bottom edge (y fixed).
	if (affectsBottom) {
		const bottom = Math.round((y + height) / gs) * gs;
		height = Math.max(minSize, bottom - y);
	}
	// Snap top edge (origin moves, height compensates).
	if (affectsTop) {
		const snappedY = Math.round(y / gs) * gs;
		height = Math.max(minSize, height + (y - snappedY));
		y = snappedY;
	}

	return { x, y, width, height };
}

// ---------------------------------------------------------------------------
// Marquee (rubber-band) selection
// ---------------------------------------------------------------------------

/** A marquee drag described by its start and current corner (any order). */
export interface MarqueeRect {
	startX: number;
	startY: number;
	currentX: number;
	currentY: number;
}

/** An element reduced to its id + bounding box for marquee hit-testing. */
export interface MarqueeElementRect {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Compute which element ids are hit by a marquee selection rectangle.
 *
 * The marquee corners are normalised (start/current may be in any order). An
 * element is hit when its box (its width/height clamped to at least `minSize`,
 * so zero-size shapes are still selectable) overlaps the marquee AABB. A marquee
 * smaller than 3px in *both* dimensions is treated as a click, returning `[]`.
 */
export function computeMarqueeHitIds(
	marquee: MarqueeRect,
	elements: readonly MarqueeElementRect[],
	minSize = MIN_ELEMENT_SIZE,
): string[] {
	const minX = Math.min(marquee.startX, marquee.currentX);
	const minY = Math.min(marquee.startY, marquee.currentY);
	const maxX = Math.max(marquee.startX, marquee.currentX);
	const maxY = Math.max(marquee.startY, marquee.currentY);
	const w = maxX - minX;
	const h = maxY - minY;
	if (w <= 3 && h <= 3) {
		return [];
	}
	return elements
		.filter((el) => {
			const eMinX = el.x;
			const eMinY = el.y;
			const eMaxX = el.x + Math.max(el.width, minSize);
			const eMaxY = el.y + Math.max(el.height, minSize);
			return !(eMaxX < minX || eMinX > maxX || eMaxY < minY || eMinY > maxY);
		})
		.map((el) => el.id);
}

/**
 * Merge an additive (shift-drag) marquee result into an existing selection,
 * de-duplicating ids while preserving first-seen order (base ids first).
 */
export function mergeAdditiveSelection(
	baseSelectionIds: readonly string[] | undefined,
	hitIds: readonly string[],
): string[] {
	return Array.from(new Set([...(baseSelectionIds ?? []), ...hitIds]));
}
