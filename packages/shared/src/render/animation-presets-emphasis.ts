/**
 * `animation-presets-emphasis` - OOXML emphasis presetId -> effect-name table,
 * plus the filter-based emphasis presets (desaturate / darken / lighten /
 * colour-remap) that render as a dynamic CSS `filter` keyframe rather than a
 * static playback effect. Split out of `animation-presets.ts` to keep that
 * module under the repo's file-size guideline; see `animation-presets.ts`
 * for the composed `PRESET_ID_TO_EFFECT.emph` this feeds.
 *
 * @module render/animation-presets-emphasis
 */

import type { EffectName } from './animation-timeline-types';

/**
 * OOXML emphasis `p:cTn/@presetId` -> playback effect name.
 *
 * ==================================================================
 * FULL GROUND TRUTH (this pass, 2026-09-05): every one of the 26 named
 * effects in PowerPoint's own "Add Emphasis Effect" dialog (its Basic /
 * 3D / Subtle / Moderate / Exciting categories, enumerated exhaustively
 * via UI Automation) was reproduced and its raw OOXML inspected, via
 * TWO independent COM methods that cross-check each other:
 *  (1) `MainSequence.AddEffect(shape, <msoAnimEffect*>, 0,
 *      msoAnimTriggerOnPageClick)` for every named `MsoAnimEffect`
 *      constant in the 54-82 range (Change Fill Color..Wave per the
 *      VBA docs), one shape per slide, SaveAs + raw XML inspection.
 *  (2) UI Automation: selected a shape, switched the ribbon to the
 *      Animations tab, and INVOKED the literal gallery / "Add
 *      Emphasis Effect" dialog list items by their displayed name
 *      (Pulse, Color Pulse, Object Color, Line/Fill/Font/Brush Color,
 *      Underline, Blink, Shimmer, and the dialog's two unnamed "3D"
 *      group items), SaveAs + raw XML inspection.
 * Method (2) was required because five ribbon-only names (Pulse,
 * Color Pulse, Object Color, Blink, Shimmer, plus two 3D-only
 * effects) have NO corresponding `MsoAnimEffect` constant, so method
 * (1) alone cannot reach them.
 *
 * RESULT ON THE KNOWN emph.26 QUESTION: emph.26 IS Pulse, and there is
 * no separate "Pulse id" to find, because Pulse and Flash Bulb are the
 * SAME preset under two different PowerPoint-history names.
 * `msoAnimEffectFlashBulb` (method 1) and clicking the ribbon's
 * literal "Pulse" gallery item (method 2) produced BYTE-IDENTICAL
 * timing XML: `presetID="26" presetClass="emph" presetSubtype="0"`,
 * `<p:animEffect transition="out" filter="fade">` with a
 * `tmFilter="0,0;.2,.5;.8,.5;1,0"` flash curve PLUS a `<p:animScale>`
 * to 105%/105% with `autoRev="1"` (grow-and-settle). The existing
 * `pulse` mapping below was already correct; nothing was swapped.
 * (Likewise emph.27 is BOTH `msoAnimEffectFlicker` and the ribbon's
 * "Color Pulse" - the same pattern, one preset under two names.)
 *
 * Full resolved id -> effect table from this pass (see
 * `animation-emphasis-ground-truth.ts` for the per-id raw XML this
 * comment summarises):
 *   1 Fill Color / Change Fill Color   20 Color Wave
 *   2 Change Font                      21 Complementary Color
 *   3 Font Color / Change Font Color   22 Complementary Color 2
 *   4 Change Font Size                 23 Contrasting Color
 *   5 Change Font Style                24 Darken
 *   6 Grow/Shrink                      25 Desaturate
 *   7 Line Color / Change Line Color   26 Pulse / Flash Bulb
 *   8 Spin                             27 Color Pulse / Flicker
 *   9 Transparency                     28 Grow With Color
 *  10 Bold Flash                       30 Lighten
 *  14 Blast                            31 Style Emphasis
 *  15 Bold Reveal                      32 Teeter
 *  16 Brush Color / Brush on Color     33 Vertical Grow
 *  18 Underline / Brush on Underline   34 Wave
 *  19 Object Color / Color Blend       35 Blink
 *                                      36 Shimmer
 *                                   40/41 3D-only (empty `<p:childTnLst>`,
 *                                         no 2D-representable animation)
 * ids 11/12/13/17/29/37/38/39 correspond to NO named `MsoAnimEffect`
 * constant, NO item in the default ribbon gallery, and NO item in the
 * full "Add Emphasis Effect" dialog (all 26 dialog items across all
 * five of its categories were enumerated via UI Automation and every
 * one of them resolves into the table above) - they are
 * reserved/unreachable ids, not effects this pass failed to find, and
 * are correctly absent from every table rather than guessed.
 * ==================================================================
 */
export const EMPH_PRESETS: Record<number, EffectName> = {
	6: 'growShrink',
	8: 'spin',
	9: 'transparency',
	10: 'boldFlash',
	20: 'colorWave',
	26: 'pulse',
	32: 'teeter',
	34: 'wave',
	35: 'blink',
	36: 'shimmer',
	// emph.1/2/3/7/14/15/16/18/19/21/22/23/24/25/27/28/30/31/33 are all
	// `p:animClr` / `p:anim` / `p:set` attribute or colour animations
	// (fill/line/font colour, font size/style, underline, grow-with-color)
	// with no transform component PowerPoint itself authors beyond the
	// colour/attribute change; each renders correctly via the
	// colour-animation (`animation-color.ts`) or attribute-transform
	// (`animation-attribute-transform.ts`) path once the raw `p:animClr`/
	// `p:anim`/`p:set` node is parsed, so intentionally NOT given a static
	// effect here - a static effect would SHORT-CIRCUIT that path with the
	// wrong visual, exactly the emph.1/emph.7 bug this table already fixed
	// once (see the module-level history in `animation-emphasis-ground-truth.ts`).
	// emph.35 (Blink, a discrete `style.visibility` hidden/visible toggle)
	// and emph.36 (Shimmer, an `animScale` + horizontal-wiggle `p:anim`
	// pair) play the keyframes in `animation-emphasis-blink-shimmer.ts`.
	// emph.40/41 carry no animation content at all in the saved XML, so
	// there is nothing to render.
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
 * id not covered here (or by {@link EMPH_PRESETS}) still animates via the
 * neutral emphasis fallback, so an unrecognised id is never dropped.
 */
export const EMPH_FILTER_PRESETS: Readonly<Record<number, { name: string; filterMid: string }>> = {
	// Real ids confirmed via COM + UI Automation (see the ground-truth block
	// on {@link EMPH_PRESETS} above and `animation-emphasis-ground-truth.ts`):
	// Desaturate=25, Lighten=30, Darken=24 - matching what this comment
	// already guessed before verification - plus the three other colour-remap
	// emphases that read the same way visually (a filter pulse, then settle
	// back to neutral): Complementary Color=21, Complementary Color 2=22,
	// Contrasting Color=23. Each targets `style.color`/`fillcolor`/
	// `stroke.color` via a `p:animClr` + `p:set` pair in the real XML, so
	// `filterMid` is a CSS approximation of PowerPoint's underlying colour
	// transform (which recomputes an actual complementary/contrasting RGB
	// value from the shape's current fill), not a literal re-implementation
	// of it. emph.3 (Change Font Color) and emph.4/5 (Change Font Size/Style)
	// are NOT filter pulses (confirmed via COM: they target `style.color` via
	// `p:animClr`, and `style.fontSize`/`style.fontStyle` via `p:anim`/`p:set`
	// respectively, no CSS filter of any kind) and correctly stay out of this
	// table; Change Font Color already renders via the `p:animClr`
	// colour-animation path, and Font Size/Style fall back to the neutral
	// emphasis animation until `animation-attribute-transform.ts` grows
	// support for them (see this fix's report for the "needs:" detail).
	24: { name: 'Darken', filterMid: 'brightness(0.6)' },
	25: { name: 'Desaturate', filterMid: 'grayscale(1)' },
	30: { name: 'Lighten', filterMid: 'brightness(1.5)' },
	21: { name: 'Complementary Color', filterMid: 'invert(1) hue-rotate(180deg)' },
	22: { name: 'Complementary Color 2', filterMid: 'invert(1)' },
	23: { name: 'Contrasting Color', filterMid: 'invert(0.75) saturate(2)' },
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
