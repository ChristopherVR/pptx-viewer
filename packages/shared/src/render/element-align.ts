/**
 * Pure geometry helpers for the align / distribute editor operations.
 *
 * These functions operate over a list of slide elements (anything carrying the
 * `{ id, x, y, width, height }` bounding-box fields of {@link PptxElement}) and
 * return a `Map` keyed by element `id` describing the *new* position(s) for the
 * elements that need to move. Elements that already sit on the target edge (or
 * the two outer-most elements during distribution) are still included with
 * their unchanged coordinate so callers can apply the whole map uniformly — the
 * map only ever contains the axis that the operation touches.
 *
 * The helpers are deliberately framework-agnostic: no DOM, no Vue reactivity,
 * no side effects. The host wires them into the editor by feeding the current
 * selection in and applying the returned `Map` via its element-transform
 * operation (one batched history entry per call).
 */

/** Edge / centre that {@link alignElements} can snap a selection to. */
export type AlignEdge = 'left' | 'centerH' | 'right' | 'top' | 'middle' | 'bottom';

/** Axis along which {@link distributeElements} evenly spaces a selection. */
export type DistributeAxis = 'horizontal' | 'vertical';

/** New position for a single element. Only the affected axis is populated. */
export interface ElementPosition {
	x?: number;
	y?: number;
}

/**
 * The minimal bounding-box shape the helpers need. {@link PptxElement} already
 * satisfies this, but accepting the structural subset keeps the helpers usable
 * (and testable) with plain geometry objects too.
 */
export interface BoundingBoxElement {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Align every element in the selection to a shared edge (or centre line) of the
 * selection's overall bounding box.
 *
 * - `left` / `right` / `centerH` move elements horizontally (set `x`).
 * - `top` / `bottom` / `middle` move elements vertically (set `y`).
 *
 * The selection's bounding box is the union of all element boxes. A selection
 * of fewer than two elements has nothing to align against, so an empty map is
 * returned.
 *
 * @param elements - The selected elements.
 * @param edge - The edge / centre line to align to.
 * @returns A `Map<id, {x?, y?}>` of new positions (only the touched axis set).
 */
export function alignElements(
	elements: readonly BoundingBoxElement[],
	edge: AlignEdge,
): Map<string, ElementPosition> {
	const result = new Map<string, ElementPosition>();
	if (elements.length < 2) {
		return result;
	}

	const minX = Math.min(...elements.map((e) => e.x));
	const minY = Math.min(...elements.map((e) => e.y));
	const maxX = Math.max(...elements.map((e) => e.x + e.width));
	const maxY = Math.max(...elements.map((e) => e.y + e.height));
	const centerX = (minX + maxX) / 2;
	const centerY = (minY + maxY) / 2;

	for (const el of elements) {
		switch (edge) {
			case 'left':
				result.set(el.id, { x: minX });
				break;
			case 'right':
				result.set(el.id, { x: maxX - el.width });
				break;
			case 'centerH':
				result.set(el.id, { x: centerX - el.width / 2 });
				break;
			case 'top':
				result.set(el.id, { y: minY });
				break;
			case 'bottom':
				result.set(el.id, { y: maxY - el.height });
				break;
			case 'middle':
				result.set(el.id, { y: centerY - el.height / 2 });
				break;
		}
	}

	return result;
}

/**
 * Distribute a selection so the gaps between adjacent elements are equal,
 * pinning the two outer-most elements in place.
 *
 * Elements are ordered by their leading edge on the chosen axis. The free space
 * — total span minus the sum of element sizes — is divided evenly into the gaps
 * between consecutive elements, then each interior element's leading edge is
 * placed accordingly. The first and last elements keep their positions.
 *
 * Distribution needs at least three elements to be meaningful (two outer +
 * one interior to move); fewer returns an empty map.
 *
 * @param elements - The selected elements.
 * @param axis - `'horizontal'` distributes along `x`; `'vertical'` along `y`.
 * @returns A `Map<id, {x?, y?}>` of new positions (only the touched axis set).
 */
export function distributeElements(
	elements: readonly BoundingBoxElement[],
	axis: DistributeAxis,
): Map<string, ElementPosition> {
	const result = new Map<string, ElementPosition>();
	if (elements.length < 3) {
		return result;
	}

	const horizontal = axis === 'horizontal';
	const start = (e: BoundingBoxElement): number => (horizontal ? e.x : e.y);
	const size = (e: BoundingBoxElement): number => (horizontal ? e.width : e.height);

	const sorted = [...elements].sort((a, b) => start(a) - start(b));
	const first = sorted[0]!;
	const last = sorted[sorted.length - 1]!;

	const span = start(last) + size(last) - start(first);
	const totalSize = sorted.reduce((sum, e) => sum + size(e), 0);
	const gap = (span - totalSize) / (sorted.length - 1);

	let cursor = start(first);
	for (const el of sorted) {
		const pos = cursor;
		if (horizontal) {
			result.set(el.id, { x: pos });
		} else {
			result.set(el.id, { y: pos });
		}
		cursor += size(el) + gap;
	}

	return result;
}

// ---------------------------------------------------------------------------
// "Skip-unchanged" variants (Angular surface)
//
// `alignElements` / `distributeElements` above emit an entry for *every*
// element so a caller can apply the whole map uniformly. The Angular binding
// historically exposed `computeAlign` / `computeDistribute`, which differ in
// two ways and are preserved here verbatim so its consumers/tests are
// unchanged:
//   1. They omit elements that are already on the target line (`newX === box.x`)
//      — the returned map only carries elements that actually move.
//   2. They use Angular's `AlignMode` / `DistributeMode` / `AlignBox` /
//      `PositionUpdate` names (structurally identical to the types above).
// The two pairs share no maths divergence beyond the skip-unchanged filter.
// ---------------------------------------------------------------------------

/** Horizontal or vertical alignment mode (alias of {@link AlignEdge}). */
export type AlignMode = AlignEdge;

/** Axis along which to distribute spacing evenly (alias of {@link DistributeAxis}). */
export type DistributeMode = DistributeAxis;

/** An axis-aligned bounding box with a stable element id (alias of {@link BoundingBoxElement}). */
export type AlignBox = BoundingBoxElement;

/** The partial position update for a single element (alias of {@link ElementPosition}). */
export type PositionUpdate = ElementPosition;

/**
 * Compute new positions to align every box to the group bounding box, emitting
 * an entry **only** for boxes that actually move.
 *
 * Behaves like {@link alignElements} but filters out elements already sitting
 * on the target edge/centre. Returns an empty map for fewer than two boxes.
 */
export function computeAlign(
	boxes: readonly AlignBox[],
	mode: AlignMode,
): Map<string, PositionUpdate> {
	const result = new Map<string, PositionUpdate>();
	if (boxes.length < 2) {
		return result;
	}

	let groupLeft = boxes[0]!.x;
	let groupTop = boxes[0]!.y;
	let groupRight = boxes[0]!.x + boxes[0]!.width;
	let groupBottom = boxes[0]!.y + boxes[0]!.height;

	for (let i = 1; i < boxes.length; i++) {
		const b = boxes[i]!;
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

	for (const box of boxes) {
		switch (mode) {
			case 'left':
				if (groupLeft !== box.x) {
					result.set(box.id, { x: groupLeft });
				}
				break;
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
			case 'top':
				if (groupTop !== box.y) {
					result.set(box.id, { y: groupTop });
				}
				break;
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
 * Compute new positions to distribute boxes with equal gaps along an axis,
 * emitting an entry **only** for boxes that actually move.
 *
 * Behaves like {@link distributeElements} but filters out elements whose
 * leading edge does not change. Returns an empty map for fewer than three
 * boxes.
 */
export function computeDistribute(
	boxes: readonly AlignBox[],
	mode: DistributeMode,
): Map<string, PositionUpdate> {
	const result = new Map<string, PositionUpdate>();
	if (boxes.length < 3) {
		return result;
	}

	const horizontal = mode === 'horizontal';
	const start = (b: AlignBox): number => (horizontal ? b.x : b.y);
	const size = (b: AlignBox): number => (horizontal ? b.width : b.height);

	const sorted = boxes.slice().sort((a, b) => start(a) - start(b));
	const firstBox = sorted[0]!;
	const lastBox = sorted[sorted.length - 1]!;

	const spanStart = start(firstBox);
	const spanEnd = start(lastBox) + size(lastBox);

	let totalSize = 0;
	for (const box of sorted) {
		totalSize += size(box);
	}

	const gap = (spanEnd - spanStart - totalSize) / (sorted.length - 1);

	let cursor = spanStart;
	for (const box of sorted) {
		const pos = cursor;
		if (pos !== start(box)) {
			if (horizontal) {
				result.set(box.id, { x: pos });
			} else {
				result.set(box.id, { y: pos });
			}
		}
		cursor += size(box) + gap;
	}

	return result;
}
