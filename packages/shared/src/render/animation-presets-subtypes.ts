/**
 * `animation-presets-subtypes` - `p:cTn/@presetSubtype` direction/variant
 * lookup tables (Fly/Peek edge, Wipe travel direction, Split barn-door
 * variant) and their filter-token inverses, for the mask-reveal directional
 * keyframe builders. Split out of `animation-presets.ts` to keep that module
 * under the repo's file-size guideline.
 *
 * @module render/animation-presets-subtypes
 */

import type { EffectName } from './animation-timeline-types';
// Reused rather than re-declared: PowerPoint's Wheel "Spokes" Effect Option
// and `p:wheel/@spokes` (the Wheel SLIDE TRANSITION) offer the identical
// five-value set. Not re-exported from here, to avoid a barrel-export name
// collision with `slide-transition-types.ts`'s own export of the same name.
import { WHEEL_SPOKE_COUNTS } from './slide-transition-types';

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
 * Map a Wipe `presetSubtype` to the edge the wipe works FROM: the edge an
 * entrance reveals from first and an exit conceals from first.
 *
 * Subtype 1 pairs with `filter="wipe(up)"`, 2 with `wipe(right)`, 4 with
 * `wipe(down)` and 8 with `wipe(left)`, and `wipe(X)` starts at edge X. The
 * same bitmask Fly uses (1 = top, 2 = right, 4 = bottom, 8 = left).
 * CreateVideo ground truth (200 px square, 2 s): Wipe subtype 4, PowerPoint's
 * default "From Bottom", grows up from the bottom edge (visible top edge
 * 361 -> 238 px over the first 1.2 s, bottom fixed at 370); the exit with
 * subtype 1 conceals from the top down (top edge 170 -> 282, bottom fixed).
 * An earlier reading of the filter token as the direction the front
 * TRAVELS played every directional wipe entrance from the opposite side.
 */
export const WIPE_SUBTYPE_TO_EDGE: Readonly<Record<number, FlyEdge>> = {
	1: 'top',
	2: 'right',
	4: 'bottom',
	8: 'left',
};

/** Split (`barn`) subtype -> reveal orientation + in/out direction. */
export type SplitVariant =
	| 'splitHorizontalIn'
	| 'splitHorizontalOut'
	| 'splitVerticalIn'
	| 'splitVerticalOut';

/**
 * Map a Split `presetSubtype` to its barn-door variant. PowerPoint (COM
 * `EffectParameters.Direction` on msoAnimEffectSplit, saved and read back)
 * writes only 21 = `barn(inVertical)`, 26 = `barn(inHorizontal)`,
 * 37 = `barn(outVertical)` and 42 = `barn(outHorizontal)`. 5 and 10 are kept
 * for files that borrowed the Blinds codes for the two "out" variants.
 */
export const SPLIT_SUBTYPE_TO_VARIANT: Readonly<Record<number, SplitVariant>> = {
	5: 'splitHorizontalOut',
	10: 'splitVerticalOut',
	21: 'splitVerticalIn',
	26: 'splitHorizontalIn',
	37: 'splitVerticalOut',
	42: 'splitHorizontalOut',
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
	outHorizontal: 42,
	outVertical: 37,
	inVertical: 21,
	inHorizontal: 26,
};

// ==========================================================================
// Blinds / Checkerboard / Random Bars direction, Wheel spoke count
// ==========================================================================

/**
 * Direction/variant tokens for the `blinds`, `checkerboard`, and `randombar`
 * `p:animEffect/@filter` families (ECMA-376/SMIL 2.0 Transition Effects).
 * Unlike Wipe/Barn, this project has no COM-verified numeric
 * `p:cTn/@presetSubtype` table for these three families, but PowerPoint
 * pairs a preset-driven Blinds/Checkerboard/Random-Bars entrance with the
 * exact same literal filter token regardless (the same pairing already
 * relied on for Wipe/Barn, see {@link WIPE_SUBTYPE_TO_EDGE}'s doc), so
 * reading `anim.effectFilter?.subtype` directly is a reliable signal that
 * needs no numeric guessing.
 */
export type BlindsDirection = 'vertical' | 'horizontal';
export type CheckerboardDirection = 'across' | 'down';
export type RandomBarsDirection = 'vertical' | 'horizontal';

/**
 * Map a `wheel(<n>)` `p:animEffect/@filter` subtype token to the nearest of
 * PowerPoint's five selectable Wheel "Spokes" Effect Option counts (the same
 * `1, 2, 3, 4, 8` set `p:wheel/@spokes` uses for the Wheel SLIDE TRANSITION,
 * see {@link import('./slide-transition-types').WHEEL_SPOKE_COUNTS}, reused
 * here rather than re-declared). Defaults to 4 (this Effect Option's own
 * default) when the token is absent or unparsable; the slide-transition
 * schema's own default of 1 does not apply here, so this is a distinct
 * resolver rather than a call to that module's `resolveWheelSpokeCount`
 * (named differently to avoid a barrel-export collision with it).
 */
export function resolveAnimationWheelSpokeCount(subtypeToken: string | undefined): number {
	const parsed = subtypeToken !== undefined ? Number.parseInt(subtypeToken, 10) : Number.NaN;
	if (!Number.isFinite(parsed)) {
		return 4;
	}
	let nearest = WHEEL_SPOKE_COUNTS[0];
	let bestDiff = Number.POSITIVE_INFINITY;
	for (const count of WHEEL_SPOKE_COUNTS) {
		const diff = Math.abs(count - parsed);
		if (diff < bestDiff) {
			bestDiff = diff;
			nearest = count;
		}
	}
	return nearest;
}

/** Shape reveals whose Effect Options "Out" grows from the centre on entrance. */
const FROM_CENTER_REVEAL: Partial<Record<EffectName, { family: string; variant: EffectName }>> = {
	boxIn: { family: 'box', variant: 'boxInFromCenter' },
	circleIn: { family: 'circle', variant: 'circleInFromCenter' },
	diamondIn: { family: 'diamond', variant: 'diamondInFromCenter' },
	plusIn: { family: 'plus', variant: 'plusInFromCenter' },
};

/**
 * Redirect the DEFAULT `blindsIn`/`checkerboardIn`/`randomBarsIn`/`wheelIn`
 * {@link EffectName} to its direction/spoke-count-aware variant, when the
 * animation's own `p:animEffect/@filter` names a matching family with a
 * recognised subtype token. Used by both `resolveEffect` (the presetId-driven
 * primary path, `animation-timeline-helpers.ts`) and `resolveFilterEffect`
 * (the filter-only fallback path, `animation-filter-effects.ts`) so a deck
 * reaches the same subtype-aware keyframe regardless of which path resolved
 * it. Returns `effect` unchanged when there is no filter, a family mismatch,
 * or an unrecognised subtype token (falls back to PowerPoint's own default
 * direction/spoke-count, matching the default keyframe's own choice).
 */
export function redirectMaskEffectByFilterSubtype(
	effect: EffectName | undefined,
	filter: { family: string; subtype?: string } | undefined,
): EffectName | undefined {
	if (!effect || !filter) {
		return effect;
	}
	if (effect === 'blindsIn' && filter.family === 'blinds') {
		if (filter.subtype === 'vertical') {
			return 'blindsInVertical';
		}
		if (filter.subtype === 'horizontal') {
			return 'blindsInHorizontal';
		}
	}
	if (effect === 'checkerboardIn' && filter.family === 'checkerboard') {
		if (filter.subtype === 'across') {
			return 'checkerboardInAcross';
		}
		if (filter.subtype === 'down') {
			return 'checkerboardInDown';
		}
	}
	if (effect === 'randomBarsIn' && filter.family === 'randombar') {
		if (filter.subtype === 'vertical') {
			return 'randomBarsInVertical';
		}
		if (filter.subtype === 'horizontal') {
			return 'randomBarsInHorizontal';
		}
	}
	const fromCenter = FROM_CENTER_REVEAL[effect];
	if (filter.subtype === 'out' && fromCenter?.family === filter.family) {
		return fromCenter.variant;
	}
	if (effect === 'wheelIn' && filter.family === 'wheel') {
		return `wheelIn${resolveAnimationWheelSpokeCount(filter.subtype)}` as EffectName;
	}
	return effect;
}
