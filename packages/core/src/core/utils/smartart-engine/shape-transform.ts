/**
 * The drawing transform of a laid-out node. A layout box is the node's
 * footprint on the canvas; a `dgm:shape rot` of 90 or 270 degrees stands the
 * shape on its side inside that footprint, so the unrotated shape (what a
 * DrawingML `a:xfrm` records before applying `rot`) has the footprint's width
 * and height swapped about the same centre.
 */

import type { Box, EngineNode } from './engine-node';

export interface ShapeTransform extends Box {
	/** Clockwise rotation in degrees, normalised to [0, 360). */
	rotation: number;
}

export function shapeTransform(node: EngineNode): ShapeTransform | undefined {
	const box = node.box;
	if (!box) {
		return undefined;
	}
	const rotation = ((((node.shape?.rot ?? 0) + node.rotation) % 360) + 360) % 360;
	const quarter = Math.round((node.shape?.rot ?? 0) / 90);
	if (Math.abs(quarter) % 2 === 1 && Math.abs((node.shape?.rot ?? 0) - quarter * 90) < 1e-6) {
		const cx = box.x + box.w / 2;
		const cy = box.y + box.h / 2;
		return { x: cx - box.h / 2, y: cy - box.w / 2, w: box.h, h: box.w, rotation };
	}
	return { ...box, rotation };
}
