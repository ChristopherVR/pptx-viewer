import type { SmartArtLayoutType } from 'pptx-viewer-core';

/**
 * Practical node-count bounds per SmartArt layout category.
 *
 * These are soft, UX-level guards (not hard schema constraints): PowerPoint
 * itself will render most layouts with any number of top-level nodes, but
 * several layouts only make visual sense within a range. Surfacing the bounds
 * lets the properties panel disable add / remove and explain why, instead of
 * silently producing a broken-looking diagram.
 *
 * Bounds apply to the count of *top-level* nodes (items without a parentId),
 * which is what the add / remove affordances in the text pane operate on.
 *
 * @module smartart-node-limits
 */

/** A min/max bound for the number of top-level nodes in a layout. */
export interface SmartArtNodeBounds {
	/** Minimum sensible number of top-level nodes. */
	readonly min: number;
	/** Maximum sensible number of top-level nodes (undefined = unbounded). */
	readonly max?: number;
}

/**
 * Per-layout bounds table. Layouts not listed here fall back to
 * {@link DEFAULT_BOUNDS}.
 */
const LAYOUT_BOUNDS: Partial<Record<SmartArtLayoutType, SmartArtNodeBounds>> = {
	// A Venn diagram is typically drawn with 2-3 overlapping sets; beyond a
	// handful of circles it becomes unreadable.
	venn: { min: 2, max: 3 },
	// A 2x2 matrix has exactly four quadrants.
	matrix: { min: 4, max: 4 },
	// Pyramids and funnels need at least two tiers to convey a hierarchy.
	pyramid: { min: 2, max: 5 },
	funnel: { min: 2, max: 5 },
	// A target is a small set of concentric rings.
	target: { min: 2, max: 5 },
	// Gears mesh in small clusters.
	gear: { min: 2, max: 3 },
	// Cycles need at least three steps to read as a loop.
	cycle: { min: 3 },
	// Relationship / process / list / hierarchy / timeline are flexible but
	// still need at least one node to exist.
};

/** Fallback bounds for any layout without an explicit entry. */
export const DEFAULT_BOUNDS: SmartArtNodeBounds = { min: 1 };

/**
 * Resolve the node-count bounds for a given layout category.
 * Returns {@link DEFAULT_BOUNDS} when the layout has no specific table entry.
 */
export function getSmartArtNodeBounds(layout: SmartArtLayoutType | undefined): SmartArtNodeBounds {
	if (!layout) {
		return DEFAULT_BOUNDS;
	}
	return LAYOUT_BOUNDS[layout] ?? DEFAULT_BOUNDS;
}

/** Whether adding another top-level node stays within the layout's max. */
export function canAddTopLevelNode(
	layout: SmartArtLayoutType | undefined,
	topLevelCount: number,
): boolean {
	const { max } = getSmartArtNodeBounds(layout);
	return max === undefined || topLevelCount < max;
}

/** Whether removing a top-level node keeps the count at or above the min. */
export function canRemoveTopLevelNode(
	layout: SmartArtLayoutType | undefined,
	topLevelCount: number,
): boolean {
	const { min } = getSmartArtNodeBounds(layout);
	return topLevelCount > min;
}

/**
 * Build a short, human-readable explanation of the bounds for a layout, or
 * `undefined` when the layout imposes no meaningful limit (min <= 1, no max).
 * The returned string is intended as a tooltip / hint, not a hard error.
 */
export function describeSmartArtBounds(layout: SmartArtLayoutType | undefined): string | undefined {
	const { min, max } = getSmartArtNodeBounds(layout);
	if (min <= 1 && max === undefined) {
		return undefined;
	}
	if (max === undefined) {
		return `Works best with at least ${min} items.`;
	}
	if (min === max) {
		return `This layout uses exactly ${max} items.`;
	}
	return `Works best with ${min} to ${max} items.`;
}
