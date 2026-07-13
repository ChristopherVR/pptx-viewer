import type { InteractionBox } from './element-interaction';

/** Element geometry used by collective selection transforms. */
export interface SelectionTransformBox extends InteractionBox {
	id: string;
}

/** Union of all selected element boxes, or null for an empty selection. */
export function selectionBounds(boxes: readonly SelectionTransformBox[]): InteractionBox | null {
	if (boxes.length === 0) {
		return null;
	}
	const minX = Math.min(...boxes.map((box) => box.x));
	const minY = Math.min(...boxes.map((box) => box.y));
	const maxX = Math.max(...boxes.map((box) => box.x + box.width));
	const maxY = Math.max(...boxes.map((box) => box.y + box.height));
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, rotation: 0 };
}

/** Move all boxes by the same slide-space delta. */
export function moveSelection(
	boxes: readonly SelectionTransformBox[],
	dx: number,
	dy: number,
): SelectionTransformBox[] {
	return boxes.map((box) => ({ ...box, x: box.x + dx, y: box.y + dy }));
}

/**
 * Scale boxes from one selection boundary into another. Each element keeps its
 * relative position and size within the collective selection.
 */
export function resizeSelection(
	boxes: readonly SelectionTransformBox[],
	from: InteractionBox,
	to: InteractionBox,
): SelectionTransformBox[] {
	const scaleX = from.width === 0 ? 1 : to.width / from.width;
	const scaleY = from.height === 0 ? 1 : to.height / from.height;
	return boxes.map((box) => ({
		...box,
		x: to.x + (box.x - from.x) * scaleX,
		y: to.y + (box.y - from.y) * scaleY,
		width: Math.max(1, box.width * scaleX),
		height: Math.max(1, box.height * scaleY),
	}));
}
