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
 * This is the single shared implementation ported from what used to be three
 * near-identical per-binding copies (React, Vue, Angular). Each binding's own
 * `smartart-node-limits.ts` (or, for Angular, the node-bounds half of
 * `smart-art-node-style-helpers.ts`) is now a thin re-export of this module.
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

// Fallback bounds for any layout without an explicit entry. Kept as a
// separate `export const` statement rather than combined with `LAYOUT_BOUNDS`
// above: they have different export-ness, and combining them into one
// declarator list (with a trailing `export { DEFAULT_BOUNDS };`) breaks the
// generated .d.ts, which drops a name introduced only via a re-export.
// eslint-disable-next-line one-var -- see comment above
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
 *
 * This text is deliberately framework-neutral English (matching the
 * `pptx.smartArt.boundsHint*` i18n keys' English fallback text): a binding
 * that wants a translated string applies its own i18n lookup keyed off
 * {@link getSmartArtNodeBounds} on top of this, rather than this function
 * taking a translation dependency.
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
