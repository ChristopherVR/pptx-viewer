/**
 * `animation-presets-subtypes` - `p:cTn/@presetSubtype` direction/variant
 * lookup tables (Fly/Peek edge, Wipe travel direction, Split barn-door
 * variant) and their filter-token inverses, for the mask-reveal directional
 * keyframe builders. Split out of `animation-presets.ts` to keep that module
 * under the repo's file-size guideline.
 *
 * @module render/animation-presets-subtypes
 */

// ==========================================================================
// Fly In / Fly Out direction (presetSubtype) mapping
// ==========================================================================

/** The four edges a Fly In/Out effect can travel from/to. */
export type FlyEdge = 'left' | 'right' | 'top' | 'bottom';

/**
 * Map an OOXML `p:cTn/@presetSubtype` code to a {@link FlyEdge} for Fly In and
 * Fly Out effects. PowerPoint encodes the direction as a bitmask on the object
 * origin edge: 1=top, 2=right, 4=bottom, 8=left. Corners combine two bits
 * (e.g. 12 = 8|4 = bottom-left) and fall back to their horizontal edge, which
 * is the more visually distinct component. Unknown/absent codes are left to the
 * caller (which keeps the preset default of bottom).
 */
export const FLY_SUBTYPE_TO_EDGE: Readonly<Record<number, FlyEdge>> = {
	1: 'top',
	2: 'right',
	4: 'bottom',
	8: 'left',
	// Corners -> nearest (horizontal) edge.
	3: 'right', // top-right (1|2)
	6: 'right', // bottom-right (4|2)
	9: 'left', // top-left (8|1)
	12: 'left', // bottom-left (8|4)
};

/**
 * Map a Wipe `presetSubtype` to the edge the reveal GROWS FROM.
 *
 * Unlike Fly / Peek (whose subtype is the object's ORIGIN edge), Wipe encodes
 * the direction the wipe front TRAVELS: subtype 1 pairs with
 * `filter="wipe(up)"` (the front moves up, so the reveal starts at the
 * BOTTOM edge), 2 with `wipe(right)` (starts at the left), 4 with
 * `wipe(down)` (starts at the top) and 8 with `wipe(left)` (starts at the
 * right). Verified against PowerPoint-authored XML (issue #132 deck), where
 * every wipe carries both the subtype and the explicit filter direction.
 * Routing these through {@link FLY_SUBTYPE_TO_EDGE} rendered every
 * directional wipe from the OPPOSITE side.
 */
export const WIPE_SUBTYPE_TO_EDGE: Readonly<Record<number, FlyEdge>> = {
	1: 'bottom',
	2: 'left',
	4: 'top',
	8: 'right',
};

/** Split (`barn`) subtype -> reveal orientation + in/out direction. */
export type SplitVariant =
	| 'splitHorizontalIn'
	| 'splitHorizontalOut'
	| 'splitVerticalIn'
	| 'splitVerticalOut';

/**
 * Map a Split `presetSubtype` to its barn-door variant. 21 = `barn(inVertical)`
 * (verified against PowerPoint-authored XML), 26 = `barn(inHorizontal)`,
 * 10 = `barn(outVertical)`, 5 = `barn(outHorizontal)`.
 */
export const SPLIT_SUBTYPE_TO_VARIANT: Readonly<Record<number, SplitVariant>> = {
	5: 'splitHorizontalOut',
	10: 'splitVerticalOut',
	21: 'splitVerticalIn',
	26: 'splitHorizontalIn',
};

// ==========================================================================
// p:animEffect/@filter subtype token -> presetSubtype (for filter-only decks)
// ==========================================================================

/**
 * Inverse of the direction encoding documented on {@link WIPE_SUBTYPE_TO_EDGE}:
 * maps the literal `p:animEffect/@filter="wipe(<token>)"` subtype token to the
 * numeric `p:cTn/@presetSubtype` code PowerPoint pairs it with. Lets a
 * filter-only animation (no `presetSubtype` of its own) reuse the exact same
 * directional machinery ({@link import('./animation-directional').buildDirectionalKeyframe})
 * as a preset-driven one, by synthesising the equivalent numeric code. See
 * `resolveFilterPresetSubtype` in `animation-filter-effects`.
 */
export const WIPE_FILTER_TOKEN_TO_SUBTYPE: Readonly<Record<string, number>> = {
	up: 1,
	right: 2,
	down: 4,
	left: 8,
};

/**
 * Inverse of {@link SPLIT_SUBTYPE_TO_VARIANT}, keyed by the literal
 * `p:animEffect/@filter="barn(<token>)"` subtype token rather than the
 * numeric `presetSubtype`. Same four codes, just re-keyed for filter-only
 * decks; see `resolveFilterPresetSubtype` in `animation-filter-effects`.
 */
export const BARN_FILTER_TOKEN_TO_SUBTYPE: Readonly<Record<string, number>> = {
	outHorizontal: 5,
	outVertical: 10,
	inVertical: 21,
	inHorizontal: 26,
};
