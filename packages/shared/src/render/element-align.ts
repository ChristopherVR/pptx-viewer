/**
 * Pure geometry helpers for the align / distribute editor operations.
 *
 * These functions operate over a list of slide elements (anything carrying the
 * `{ id, x, y, width, height }` bounding-box fields of {@link PptxElement}) and
 * return a `Map` keyed by element `id` describing the *new* position(s) for the
 * elements that need to move. Elements that already sit on the target edge (or
 * the two outer-most elements during distribution) are still included with
 * their unchanged coordinate so callers can apply the whole map uniformly; the
 * map only ever contains the axis that the operation touches.
 *
 * The reference box the selection is aligned against is either the union of
 * the selected boxes (PowerPoint's "Align Selected Objects") or the slide
 * itself ("Align to Slide"). PowerPoint defaults to the slide whenever a
 * single object is selected, which is why a one-element selection is not a
 * no-op once a `slideSize` is supplied: Align Center on a lone title is one
 * of the commonest arrange gestures there is.
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

/**
 * What a selection is aligned / distributed against.
 *
 * - `'selection'`: the union bounding box of the selected elements
 *   (PowerPoint's "Align Selected Objects"). Needs at least two elements.
 * - `'slide'`: the slide bounds (`0, 0, slideSize.width, slideSize.height`),
 *   PowerPoint's "Align to Slide". Works for any non-empty selection.
 */
export type AlignReference = 'selection' | 'slide';

/** Slide dimensions in the same (pixel) units as the element boxes. */
export interface AlignSlideSize {
	width: number;
	height: number;
}

/** Optional reference selection for {@link alignElements} and friends. */
export interface AlignOptions {
	/**
	 * Explicit reference. When omitted, `'slide'` is assumed for a single
	 * element (PowerPoint's default) and `'selection'` otherwise. Either way
	 * the slide is only used when `slideSize` is supplied.
	 */
	reference?: AlignReference;
	/** Slide bounds; required for the slide to act as the reference. */
	slideSize?: AlignSlideSize;
}

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

/** An axis-aligned reference rectangle. */
export interface AlignReferenceBox {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

/**
 * Decide whether the slide (rather than the selection) is the reference for a
 * given selection + options. The slide is chosen when asked for explicitly or
 * when only one element is selected, but only when its size is known.
 */
export function usesSlideReference(
	elementCount: number,
	options: AlignOptions | undefined,
): options is AlignOptions & { slideSize: AlignSlideSize } {
	if (!options?.slideSize) {
		return false;
	}
	return options.reference === 'slide' || (options.reference === undefined && elementCount === 1);
}

/**
 * The rectangle a selection is aligned against, or `null` when there is
 * nothing to align to (an empty selection, or a lone element with no slide
 * size to fall back on).
 */
export function resolveAlignReferenceBox(
	elements: readonly BoundingBoxElement[],
	options?: AlignOptions,
): AlignReferenceBox | null {
	if (elements.length === 0) {
		return null;
	}
	if (usesSlideReference(elements.length, options)) {
		return { minX: 0, minY: 0, maxX: options.slideSize.width, maxY: options.slideSize.height };
	}
	if (elements.length < 2) {
		return null;
	}
	return {
		minX: Math.min(...elements.map((e) => e.x)),
		minY: Math.min(...elements.map((e) => e.y)),
		maxX: Math.max(...elements.map((e) => e.x + e.width)),
		maxY: Math.max(...elements.map((e) => e.y + e.height)),
	};
}

/**
 * Align every element in the selection to a shared edge (or centre line) of
 * the reference box (see {@link resolveAlignReferenceBox}).
 *
 * - `left` / `right` / `centerH` move elements horizontally (set `x`).
 * - `top` / `bottom` / `middle` move elements vertically (set `y`).
 *
 * Without a `slideSize` the behaviour is unchanged from before the option
 * existed: the reference is the selection's union box and fewer than two
 * elements yields an empty map.
 *
 * @param elements - The selected elements.
 * @param edge - The edge / centre line to align to.
 * @param options - Reference selection; see {@link AlignOptions}.
 * @returns A `Map<id, {x?, y?}>` of new positions (only the touched axis set).
 */
export function alignElements(
	elements: readonly BoundingBoxElement[],
	edge: AlignEdge,
	options?: AlignOptions,
): Map<string, ElementPosition> {
	const result = new Map<string, ElementPosition>();
	const ref = resolveAlignReferenceBox(elements, options);
	if (!ref) {
		return result;
	}
	const { minX, minY, maxX, maxY } = ref;
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
 * Distribute a selection so the gaps between adjacent elements are equal.
 *
 * Elements are ordered by their leading edge on the chosen axis. Against the
 * selection, the two outer-most elements are pinned and the free space (span
 * minus the sum of element sizes) is divided evenly into the gaps between
 * consecutive elements; this needs at least three elements (two outer + one
 * interior to move). Against the slide (`'slide'` reference, or a single
 * element with a `slideSize`), the span is the whole slide and the free space
 * is divided into `n + 1` equal gaps so the margins to both slide edges match
 * the gaps between elements, as PowerPoint's "Align to Slide" distribution
 * does; any non-empty selection qualifies.
 *
 * @param elements - The selected elements.
 * @param axis - `'horizontal'` distributes along `x`; `'vertical'` along `y`.
 * @param options - Reference selection; see {@link AlignOptions}.
 * @returns A `Map<id, {x?, y?}>` of new positions (only the touched axis set).
 */
export function distributeElements(
	elements: readonly BoundingBoxElement[],
	axis: DistributeAxis,
	options?: AlignOptions,
): Map<string, ElementPosition> {
	const result = new Map<string, ElementPosition>();
	const horizontal = axis === 'horizontal';
	const start = (e: BoundingBoxElement): number => (horizontal ? e.x : e.y);
	const size = (e: BoundingBoxElement): number => (horizontal ? e.width : e.height);
	const sorted = [...elements].sort((a, b) => start(a) - start(b));
	const totalSize = sorted.reduce((sum, e) => sum + size(e), 0);

	let cursor: number;
	let gap: number;
	if (usesSlideReference(elements.length, options)) {
		if (sorted.length === 0) {
			return result;
		}
		const span = horizontal ? options.slideSize.width : options.slideSize.height;
		gap = (span - totalSize) / (sorted.length + 1);
		cursor = gap;
	} else {
		if (sorted.length < 3) {
			return result;
		}
		const first = sorted[0]!;
		const last = sorted[sorted.length - 1]!;
		const span = start(last) + size(last) - start(first);
		gap = (span - totalSize) / (sorted.length - 1);
		cursor = start(first);
	}

	for (const el of sorted) {
		result.set(el.id, horizontal ? { x: cursor } : { y: cursor });
		cursor += size(el) + gap;
	}

	return result;
}

// "Skip-unchanged" variants (Angular surface). `alignElements` /
// `distributeElements` emit an entry for *every* element; the Angular binding
// historically exposed `computeAlign` / `computeDistribute`, which omit the
// elements already on the target line so the map only carries elements that
// actually move, under the `AlignMode` / `DistributeMode` / `AlignBox` /
// `PositionUpdate` names (structurally identical). Same maths, one filter.

/** Alias of {@link AlignEdge}. */
export type AlignMode = AlignEdge;
/** Alias of {@link DistributeAxis}. */
export type DistributeMode = DistributeAxis;
/** Alias of {@link BoundingBoxElement}. */
export type AlignBox = BoundingBoxElement;
/** Alias of {@link ElementPosition}. */
export type PositionUpdate = ElementPosition;

/** Drop the entries whose new coordinate equals the box's current one. */
function onlyMoved(
	boxes: readonly AlignBox[],
	positions: Map<string, PositionUpdate>,
): Map<string, PositionUpdate> {
	const byId = new Map(boxes.map((box) => [box.id, box]));
	const result = new Map<string, PositionUpdate>();
	for (const [id, pos] of positions) {
		const box = byId.get(id);
		if (!box) {
			continue;
		}
		const moved =
			(pos.x !== undefined && pos.x !== box.x) || (pos.y !== undefined && pos.y !== box.y);
		if (moved) {
			result.set(id, pos);
		}
	}
	return result;
}

/**
 * {@link alignElements} (slide reference included) filtered to the boxes that
 * actually move.
 */
export function computeAlign(
	boxes: readonly AlignBox[],
	mode: AlignMode,
	options?: AlignOptions,
): Map<string, PositionUpdate> {
	return onlyMoved(boxes, alignElements(boxes, mode, options));
}

/**
 * {@link distributeElements} (slide reference included) filtered to the boxes
 * that actually move.
 */
export function computeDistribute(
	boxes: readonly AlignBox[],
	mode: DistributeMode,
	options?: AlignOptions,
): Map<string, PositionUpdate> {
	return onlyMoved(boxes, distributeElements(boxes, mode, options));
}
