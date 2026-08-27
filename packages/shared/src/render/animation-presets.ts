/**
 * `animation-presets` — OOXML preset-id → effect-name lookup tables for the
 * native-animation timeline. Pure data, framework-free.
 *
 * @module render/animation-presets
 */

import type { EffectName } from './animation-timeline-types';

// ==========================================================================
// OOXML presetId → effect name mapping
// ==========================================================================

interface PresetIdMap {
	entr: Record<number, EffectName>;
	exit: Record<number, EffectName>;
	emph: Record<number, EffectName>;
}

export const PRESET_ID_TO_EFFECT: PresetIdMap = {
	entr: {
		1: 'appear',
		2: 'flyInBottom',
		3: 'blindsIn',
		4: 'boxIn',
		5: 'checkerboardIn',
		// entr.6 = Circle: a genuine iris-style mask reveal, not a plain scale.
		// It used to duplicate entr.31 (Expand)'s `expandIn`, so a Circle
		// entrance was visually indistinguishable from Expand.
		6: 'circleIn',
		9: 'dissolveIn',
		10: 'fadeIn',
		// entr.11 = Flash Once, entr.12 = Peek In, entr.16 = Split per the
		// MS-OI29500 entrance catalog. (12 was mislabelled Flash Once and 16
		// Peek In, so a Peek In entrance BLINKED and a Split entrance peeked.)
		// Ground truth from a real PowerPoint deck (issue #132): preset 12
		// carries `p:animEffect filter="wipe(...)"` (a peek reveal) and preset
		// 16 carries `filter="barn(...)"` (the split barn-door reveal).
		// Re-verified directly against retail PowerPoint via COM automation
		// (AddEffect + raw OOXML inspection): entr.11 emits no filter (a plain
		// visibility flash, matching `flashIn`'s blink keyframe), entr.12
		// carries `filter="wipe(up)"`, and entr.16 carries
		// `filter="barn(inVertical)"`. This block is intentionally UNCHANGED
		// from the #132 fix; `animation-write-mappings.ts` and
		// `animation-preset-catalog.ts` were the ones still mislabelled (their
		// entr.11/12/16/17 labels were shifted one preset too high) and have
		// been corrected to match this table instead.
		11: 'flashIn',
		12: 'peekIn',
		14: 'randomBarsIn',
		16: 'splitIn',
		// entr.17 = Stretch (confirmed via COM: a plain `ppt_w`/`ppt_h` grow
		// from 0 to full size, no filter); an expand-from-nothing scale is the
		// closest existing match.
		17: 'expandIn',
		22: 'wipeIn',
		23: 'zoomIn',
		// entr.26/37 verified via COM (AddEffect + raw OOXML inspection):
		// `msoAnimEffectBounce` serializes as presetID 26 and
		// `msoAnimEffectRiseUp` serializes as presetID 37. These were
		// previously swapped in this table (26 played 'riseUp', 37 played
		// 'bounceIn'); PowerPoint's own internal MsoAnimEffect id and the
		// OOXML presetID are different numbering spaces that only coincide
		// for some effects.
		26: 'bounceIn',
		21: 'wheelIn',
		31: 'expandIn',
		37: 'riseUp',
		42: 'floatIn',
		// entr.19 = Swivel, confirmed via COM (`msoAnimEffectSwivel` serializes
		// as presetID 19, presetClass="entr", no filter); already COM-verified
		// in `animation-write-mappings.ts`'s `ENTR_CANONICAL` and in the UI
		// catalog, but never wired up here even though the `swivel` keyframe
		// (rotateY entrance) already existed and was already used for its
		// initial-style resolution in `animation-effects.ts`.
		19: 'swivel',
		49: 'spinnerIn',
		53: 'growTurnIn',
		// entr.8/13/20 (Diamond/Plus/Wedge) confirmed via a fresh COM pass
		// (AddEffect + raw OOXML inspection): each serializes as
		// presetClass="entr" with exactly the presetID this table already
		// assumed in `animation-write-mappings.ts`'s `diamondIn`/`plusIn`/
		// `wedgeIn` entries. Their dedicated mask-reveal keyframes already
		// existed (used by the `p:animEffect/@filter` fallback path in
		// `animation-filter-effects.ts`) but were never wired up here, so a
		// deck whose `p:cTn` carries the presetId without an accompanying
		// filter attribute fell through to the generic fade safety net.
		8: 'diamondIn',
		13: 'plusIn',
		20: 'wedgeIn',
		// entr.18 (Strips) confirmed via the same COM pass: presetID 18,
		// matching the already-COM-verified catalog label ("Strips"). There is
		// no dedicated diagonal-strip keyframe, so this reuses the `wipeIn`
		// mask (the same approximation already used by the Strips filter
		// family in `animation-filter-effects.ts`); see the
		// APPROXIMATION_ALLOWLIST entry in
		// `animation-preset-tables-consistency.test.ts`.
		18: 'wipeIn',
		// entr.47 (Descend) confirmed via the same COM pass: presetID 47,
		// matching the already-COM-verified catalog label ("Descend"; see
		// `animation-preset-catalog.ts`). No dedicated "falls from above"
		// keyframe exists, so this reuses `flyInTop` (falls from the top edge
		// into place), the closest existing motion; see the
		// APPROXIMATION_ALLOWLIST entry in
		// `animation-preset-tables-consistency.test.ts`.
		47: 'flyInTop',
	},
	exit: {
		1: 'disappear',
		2: 'flyOutBottom',
		// exit.6 = Circle, confirmed via COM (`msoAnimEffectCircle` with
		// `Effect.Exit = True` serializes as presetID 6, filter="circle(in)"),
		// matching the catalog label and `circleOut` in the authoring reverse
		// lookup. There is no dedicated exit iris/circle-mask keyframe yet, so
		// `shrinkOut` remains as a documented visual APPROXIMATION (both read
		// as "collapse to nothing"); see the APPROXIMATION_ALLOWLIST entry in
		// `animation-preset-tables-consistency.test.ts`.
		6: 'shrinkOut',
		9: 'dissolveOut',
		10: 'fadeOut',
		22: 'wipeOut',
		23: 'zoomOut',
		// exit.26/37 verified via a fresh COM pass (AddEffect + `Effect.Exit =
		// True` + raw OOXML inspection): `msoAnimEffectBounce` with
		// `Effect.Exit = True` re-emits presetID 26 (the SAME id as its
		// entrance form, filter="wipe(down)" on both), and
		// `msoAnimEffectRiseUp` with `Effect.Exit = True` re-emits presetID 37
		// (again the same id as its entrance form, filter="fade" on both).
		// This table previously had `bounceOut` on 37 and no entry for 26,
		// i.e. exactly the same "Bounce"/"Rise Up" mix-up already fixed on the
		// entrance side (entr.26/37) but never propagated to exit. Bounce's
		// exit form reuses the existing `bounceOut` keyframe; Rise Up's exit
		// form ("Sink Down" in the gallery) gets its own `sinkDown` keyframe.
		26: 'bounceOut',
		37: 'sinkDown',
		// exit.3/4/5/8/13/14/20/21 (Blinds/Box/Checkerboard/Diamond/Plus/Random
		// Bars/Wedge/Wheel) confirmed via a fresh COM pass (AddEffect +
		// `Effect.Exit = True` + raw OOXML inspection): each reuses the SAME
		// numeric presetID as its entrance form, mirroring the
		// already-documented Bounce/Rise Up/Circle pattern above. Each gets a
		// dedicated exit keyframe in `animation-keyframes-exit-shapes.ts` that
		// reuses its entrance counterpart's mask/transform technique played in
		// reverse (shown -> hidden), rather than falling back to the generic
		// fade.
		3: 'blindsOut',
		4: 'boxOut',
		5: 'checkerboardOut',
		8: 'diamondOut',
		13: 'plusOut',
		14: 'randomBarsOut',
		20: 'wedgeOut',
		21: 'wheelOut',
		// exit.18 (Strips) confirmed via the same COM pass: presetID 18 (the
		// SAME id as its entrance form, entr.18). This CONTRADICTS
		// `animation-write-mappings.ts`'s existing (unverified) `collapseOut`
		// entry at exit.18; that entry is almost certainly a pre-existing
		// guess that was never COM-checked, and correcting it is a separate,
		// larger fix out of this pass's scope (see the APPROXIMATION_ALLOWLIST
		// entry in `animation-preset-tables-consistency.test.ts`). No
		// dedicated diagonal-strip exit keyframe exists, so this reuses
		// `wipeOut`, matching the approximation `animation-filter-effects.ts`
		// already uses for the Strips filter family's exit form.
		18: 'wipeOut',
	},
	emph: {
		// emph.1 used to be mislabelled 'boldFlash', but emph.1 is really
		// Change Fill Color (confirmed via COM: emph.1 emits `p:animClr` with
		// a fill-color target), not Bold Flash (that is emph.10, see below).
		// Leaving this id unmapped lets the animClr colour-animation path in
		// `animation-timeline-helpers.ts` render it, instead of being
		// short-circuited by a wrong static effect.
		6: 'growShrink',
		// emph.7 used to be mislabelled 'flash' (a Blink approximation), but
		// emph.7 is Change Line Color, not Blink: a real Change Line Color
		// emphasis carries a `p:animClr` node, which `buildDynamicKeyframe`
		// already renders correctly via the colour-animation path in
		// `animation-timeline-helpers.ts`. Leaving this id unmapped here lets
		// that path run instead of being short-circuited by a wrong static
		// effect (verified via COM: emph.7 emits `p:animClr` and a
		// `stroke.color` target, no flash/blink filter of any kind).
		8: 'spin',
		9: 'transparency',
		// emph.10 = Bold Flash, confirmed via COM (`msoAnimEffectBoldFlash`
		// targets `style.fontWeight`, no colour animation); previously
		// mislabelled onto emph.1 (see above) and emph.4 wrongly claimed as
		// Change Font Size's slot.
		10: 'boldFlash',
		// emph.14 used to be mislabelled 'teeter', but a fresh COM pass
		// (AddEffect + raw OOXML inspection) shows `msoAnimEffectBlast`
		// serializes as emph.14 and `msoAnimEffectTeeter` serializes as
		// emph.32; the two were swapped in this table (the real Blast has no
		// dedicated keyframe, so 14 is correctly left unmapped below).
		32: 'teeter',
		// CONFIRMED, UNRESOLVED: a fresh COM pass for THIS fix (AddEffect with
		// no Exit flag, raw OOXML inspection) shows `msoAnimEffectFlashBulb`
		// serializes as presetClass="emph" presetID="26", i.e. emph.26 is
		// really Flash Bulb, not Pulse/Bounce as this table (and
		// `animation-write-mappings.ts`'s `pulse`/`bounce` aliases, and the UI
		// catalog's "Pulse" label) currently assume. This directly confirms
		// the suspicion already flagged as an out-of-scope, unresolved finding
		// next to `PRESET_TO_OOXML.flashBulbOut` in `animation-write-mappings.ts`.
		// Correcting it requires coordinated changes across three tables
		// (this one, the authoring reverse lookup, and the UI catalog) plus
		// their own test suites, which is a separate, larger fix; left as
		// `pulse` here rather than half-corrected. See this fix's report for
		// the full COM evidence.
		26: 'pulse',
		// emph.20/34 verified via COM: `msoAnimEffectColorWave` serializes as
		// emph.20 and `msoAnimEffectWave` as emph.34 (already documented, and
		// re-confirmed by a fresh COM pass, in `animation-write-mappings.ts`'s
		// `colorWave`/`wave` entries and the matching catalog labels). Both
		// dedicated keyframes (`colorWave`: a hue-rotate pulse; `wave`: a
		// vertical bob) already existed but were never wired to a preset id.
		20: 'colorWave',
		34: 'wave',
		// emph.2 (Change Font, a font-family swap) and emph.16 (Brush on
		// Color) are intentionally NOT covered here: neither has a dynamic
		// keyframe or animClr path today, so both correctly fall back to the
		// neutral emphasis animation rather than a fabricated static effect
		// (matching the emph.4/5 precedent below).
	},
};

// ==========================================================================
// Filter-based emphasis effects (desaturate / darken / lighten)
// ==========================================================================

/**
 * Emphasis presets whose effect is a CSS `filter` pulse rather than a transform
 * or opacity change. These are generated as dynamic `@keyframes` (see
 * {@link import('./animation-timeline-helpers').buildDynamicKeyframe}) because
 * there is no static keyframe for them.
 *
 * The `filterMid` is applied at the animation midpoint and eased back to the
 * neutral value, matching PowerPoint's "emphasise then settle" feel. The preset
 * IDs are a best-effort mapping of the ECMA-376 emphasis catalogue; any preset
 * id not covered here (or by {@link PRESET_ID_TO_EFFECT}) still animates via the
 * neutral emphasis fallback, so an unrecognised id is never dropped.
 */
export const EMPH_FILTER_PRESETS: Readonly<Record<number, { name: string; filterMid: string }>> = {
	// emph.3/4/5 used to hold desaturate/darken/lighten here, but those three
	// IDs are actually Change Font Color, Change Font Size and Change Font
	// Style (confirmed via COM: emph.3 and emph.4/5 target `style.color`,
	// `style.fontSize` and `style.fontStyle`/`style.fontWeight`, not a
	// colour-filter pulse). Change Font Color already renders correctly via
	// the `p:animClr` colour-animation path (see the emph.7 note in
	// `PRESET_ID_TO_EFFECT` above); Change Font Size/Style have no dynamic
	// keyframe support yet, so they correctly fall back to the neutral
	// emphasis animation rather than a fabricated filter. The real
	// Desaturate/Lighten/Darken IDs (25/30/24) are not covered here either;
	// adding them is a separate, larger extraction beyond this fix's scope.
};

/**
 * Build a CSS `filter` emphasis `@keyframes` block (desaturate / darken /
 * lighten) for an emphasis preset id in {@link EMPH_FILTER_PRESETS}. The filter
 * is applied at the midpoint and eased back to neutral. Returns `undefined` for
 * any preset id without a filter mapping.
 */
export function emphasisFilterKeyframeCss(
	presetId: number | undefined,
	name: string,
): string | undefined {
	if (presetId === undefined) {
		return undefined;
	}
	const preset = EMPH_FILTER_PRESETS[presetId];
	if (!preset) {
		return undefined;
	}
	return `@keyframes ${name} {\n\t0% { filter: none; }\n\t50% { filter: ${preset.filterMid}; }\n\t100% { filter: none; }\n}`;
}

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
