/**
 * Pure geometry helpers for aligning and distributing selected editor elements.
 *
 * No Angular imports, no DOM, no side effects — only data in, data out.
 * All inputs are treated as immutable.
 */

/** Horizontal or vertical alignment mode. */
export type AlignMode = 'left' | 'centerH' | 'right' | 'top' | 'middle' | 'bottom';

/** Axis along which to distribute spacing evenly. */
export type DistributeMode = 'horizontal' | 'vertical';

/** An axis-aligned bounding box with a stable element id. */
export interface AlignBox {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

/** The partial position update for a single element. */
export interface PositionUpdate {
	x?: number;
	y?: number;
}

/**
 * Compute new positions to align every box to the group bounding box.
 *
 * Horizontal modes (`left`, `centerH`, `right`) return `{ x }`.
 * Vertical modes (`top`, `middle`, `bottom`) return `{ y }`.
 *
 * Returns an empty map when fewer than 2 boxes are supplied — there is
 * nothing to align with only one (or zero) selection members.
 */
export function computeAlign(
	boxes: readonly AlignBox[],
	mode: AlignMode,
): Map<string, PositionUpdate> {
	if (boxes.length < 2) {
		return new Map<string, PositionUpdate>();
	}

	// Group bounding box extents.
	let groupLeft = boxes[0].x;
	let groupTop = boxes[0].y;
	let groupRight = boxes[0].x + boxes[0].width;
	let groupBottom = boxes[0].y + boxes[0].height;

	for (let i = 1; i < boxes.length; i++) {
		const b = boxes[i];
		if (b.x < groupLeft) {
			groupLeft = b.x;
		}
		if (b.y < groupTop) {
			groupTop = b.y;
		}
		if (b.x + b.width > groupRight) {
			groupRight = b.x + b.width;
		}
		if (b.y + b.height > groupBottom) {
			groupBottom = b.y + b.height;
		}
	}

	const groupCenterH = groupLeft + (groupRight - groupLeft) / 2;
	const groupCenterV = groupTop + (groupBottom - groupTop) / 2;

	const result = new Map<string, PositionUpdate>();

	for (const box of boxes) {
		switch (mode) {
			case 'left': {
				const newX = groupLeft;
				if (newX !== box.x) {
					result.set(box.id, { x: newX });
				}
				break;
			}
			case 'centerH': {
				const newX = groupCenterH - box.width / 2;
				if (newX !== box.x) {
					result.set(box.id, { x: newX });
				}
				break;
			}
			case 'right': {
				const newX = groupRight - box.width;
				if (newX !== box.x) {
					result.set(box.id, { x: newX });
				}
				break;
			}
			case 'top': {
				const newY = groupTop;
				if (newY !== box.y) {
					result.set(box.id, { y: newY });
				}
				break;
			}
			case 'middle': {
				const newY = groupCenterV - box.height / 2;
				if (newY !== box.y) {
					result.set(box.id, { y: newY });
				}
				break;
			}
			case 'bottom': {
				const newY = groupBottom - box.height;
				if (newY !== box.y) {
					result.set(box.id, { y: newY });
				}
				break;
			}
		}
	}

	return result;
}

/**
 * Compute new positions to distribute boxes with equal gaps along an axis.
 *
 * The two extreme boxes (smallest and largest leading-edge coordinate) are
 * kept fixed; inner boxes are repositioned so the gaps between consecutive
 * boxes (sorted by position) are equal.
 *
 * `horizontal` distributes along X; `vertical` distributes along Y.
 *
 * Returns an empty map when fewer than 3 boxes are supplied — with only 2
 * boxes every arrangement already has exactly one gap, so there is nothing
 * to equalise.
 */
export function computeDistribute(
	boxes: readonly AlignBox[],
	mode: DistributeMode,
): Map<string, PositionUpdate> {
	if (boxes.length < 3) {
		return new Map<string, PositionUpdate>();
	}

	const result = new Map<string, PositionUpdate>();

	if (mode === 'horizontal') {
		// Sort by left edge (x).
		const sorted = boxes.slice().sort((a, b) => a.x - b.x);

		const firstBox = sorted[0];
		const lastBox = sorted[sorted.length - 1];

		const spanStart = firstBox.x;
		const spanEnd = lastBox.x + lastBox.width;

		// Total width consumed by all boxes.
		let totalBoxWidth = 0;
		for (const box of sorted) {
			totalBoxWidth += box.width;
		}

		const totalGapSpace = spanEnd - spanStart - totalBoxWidth;
		const gapCount = sorted.length - 1;
		const gap = totalGapSpace / gapCount;

		let cursor = spanStart;
		for (let i = 0; i < sorted.length; i++) {
			const box = sorted[i];
			const newX = cursor;
			if (newX !== box.x) {
				result.set(box.id, { x: newX });
			}
			cursor += box.width + gap;
		}
	} else {
		// Vertical: sort by top edge (y).
		const sorted = boxes.slice().sort((a, b) => a.y - b.y);

		const firstBox = sorted[0];
		const lastBox = sorted[sorted.length - 1];

		const spanStart = firstBox.y;
		const spanEnd = lastBox.y + lastBox.height;

		let totalBoxHeight = 0;
		for (const box of sorted) {
			totalBoxHeight += box.height;
		}

		const totalGapSpace = spanEnd - spanStart - totalBoxHeight;
		const gapCount = sorted.length - 1;
		const gap = totalGapSpace / gapCount;

		let cursor = spanStart;
		for (let i = 0; i < sorted.length; i++) {
			const box = sorted[i];
			const newY = cursor;
			if (newY !== box.y) {
				result.set(box.id, { y: newY });
			}
			cursor += box.height + gap;
		}
	}

	return result;
}
