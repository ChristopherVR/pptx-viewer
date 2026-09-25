/**
 * Mapping between an element's local pixel frame and slide space.
 *
 * Every binding paints an element as a box at `(x, y, width, height)` with
 * `transform: rotate(θ) scaleX(±1) scaleY(±1)` about its centre (OOXML flips
 * first, then rotates; see `element-style-transform.ts`). A local point `p`
 * therefore lands on the slide at `C + R·F·(p - c)`, where `C` is the box
 * centre on the slide, `c` the centre in local coordinates, `R` the rotation
 * and `F` the flip. The Edit Points overlay is drawn in plain slide space, so
 * it needs this in both directions: forward to place a handle, inverse to turn
 * a pointer position back into a local vertex position.
 *
 * @module render/edit-points/edit-points-frame
 */
import type { PptxElement } from 'pptx-viewer-core';

import type { EditFrame, EditPoint } from './edit-points-types';

/** The frame `element` is painted in right now. */
export function editFrameFromElement(element: PptxElement): EditFrame {
	return {
		x: element.x,
		y: element.y,
		width: Math.max(element.width, 0),
		height: Math.max(element.height, 0),
		rotation: Number.isFinite(element.rotation) ? (element.rotation ?? 0) : 0,
		flipH: element.flipHorizontal === true,
		flipV: element.flipVertical === true,
	};
}

function rotationTrig(frame: EditFrame): { cos: number; sin: number } {
	const rad = (frame.rotation * Math.PI) / 180;
	return { cos: Math.cos(rad), sin: Math.sin(rad) };
}

/** Apply `R·F` to a vector. */
function applyLinear(frame: EditFrame, dx: number, dy: number): EditPoint {
	const fx = frame.flipH ? -dx : dx;
	const fy = frame.flipV ? -dy : dy;
	const { cos, sin } = rotationTrig(frame);
	return { x: fx * cos - fy * sin, y: fx * sin + fy * cos };
}

/** Apply `(R·F)^-1 = F·R^-1` to a vector. */
function applyInverseLinear(frame: EditFrame, dx: number, dy: number): EditPoint {
	const { cos, sin } = rotationTrig(frame);
	const rx = dx * cos + dy * sin;
	const ry = -dx * sin + dy * cos;
	return { x: frame.flipH ? -rx : rx, y: frame.flipV ? -ry : ry };
}

/** Local frame point to slide space. */
export function editLocalToSlide(frame: EditFrame, point: EditPoint): EditPoint {
	const cx = frame.width / 2;
	const cy = frame.height / 2;
	const v = applyLinear(frame, point.x - cx, point.y - cy);
	return { x: frame.x + cx + v.x, y: frame.y + cy + v.y };
}

/** Slide space point to the local frame. */
export function editSlideToLocal(frame: EditFrame, point: EditPoint): EditPoint {
	const cx = frame.width / 2;
	const cy = frame.height / 2;
	const v = applyInverseLinear(frame, point.x - (frame.x + cx), point.y - (frame.y + cy));
	return { x: cx + v.x, y: cy + v.y };
}

/**
 * The slide-space box that keeps every local point where it is on screen once
 * the element is re-anchored to the local bounds `[minX, maxX] x [minY, maxY]`.
 *
 * Re-anchoring moves the box centre from `c` to `c'` (the bounds' centre), so
 * the new top-left must be shifted by `R·F·(c' - c)` for the rotated, flipped
 * outline to stay put; without it a rotated shape would jump every time an
 * edit grew or shrank its bounds.
 */
export function reanchorEditFrame(
	frame: EditFrame,
	bounds: { minX: number; minY: number; maxX: number; maxY: number },
): { x: number; y: number; width: number; height: number } {
	const width = bounds.maxX - bounds.minX;
	const height = bounds.maxY - bounds.minY;
	const shift = applyLinear(
		frame,
		(bounds.minX + bounds.maxX) / 2 - frame.width / 2,
		(bounds.minY + bounds.maxY) / 2 - frame.height / 2,
	);
	const centreX = frame.x + frame.width / 2 + shift.x;
	const centreY = frame.y + frame.height / 2 + shift.y;
	return { x: centreX - width / 2, y: centreY - height / 2, width, height };
}
