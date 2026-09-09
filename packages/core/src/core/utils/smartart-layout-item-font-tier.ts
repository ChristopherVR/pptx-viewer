/**
 * SmartArt DiagramML interpreter - two-tier font size for a folded item's own
 * text vs. its folded descendant paragraph(s).
 *
 * `smartart-layout-item-font-size.ts`'s `resolveSharedItemFontSize` (and the
 * `foldedItemText` it is fed) treats a folded item's WHOLE text - the node's
 * own top-level paragraph plus every folded descendant paragraph
 * (`collectFoldedDescendants`, added a level deeper via the text pane's
 * Tab/"Add Bullet") - as ONE string rendered at ONE uniform font size. Real
 * PowerPoint does not: every gallery fixture with a folded descendant
 * paragraph renders that descendant at a SMALLER, INDEPENDENTLY-shrunk size
 * than the item's own top-level text, in the SAME box. Confirmed directly
 * from the cached `dsp:sp`'s own `txBody` (not a derived/rounded value): e.g.
 * `basic-block-list--hier5.pptx`'s "Node One" (top-level) run carries
 * `sz="4800"` (48pt) while its folded child "Node Two has a longer label"
 * carries `sz="3700"` (37pt) in the SAME shape - the uniform model can only
 * ever report ONE of these two numbers, and the gallery's own font-size
 * check reads the FIRST paragraph's run (`extractDrawingShapeTextStyle`),
 * i.e. the LARGER, top-level size - so a uniform fit that (correctly, per
 * the old model) shrinks to accommodate the smaller descendant text
 * UNDER-reports the item's real cached size by a wide margin (e.g. 46pt
 * instead of 48pt: not a rounding residue, a structurally wrong target).
 *
 * A corpus-wide scan (`smartart-gallery/*.pptx`'s cached `drawing1.xml`,
 * every `<dsp:sp>` with more than one distinct run `sz` across its
 * paragraphs) found this same two-tier pattern in **53 of the 134** `lin`/
 * `snake` gallery fixtures - not a `basic-block-list`-specific quirk.
 *
 * **The descendant/root ratio is a FIXED constant, not text- or geometry-
 * dependent** (model (a), "descendant independently fit to its own width/
 * height", is DISPROVEN; model (b), "fixed per-level ratio", is confirmed).
 * Across every unique (rootSz, descSz) whole-point pair in a corpus-wide scan
 * (34 pairs, excluding `numbered-linear-arrow-process`/`numbered-card-list`/
 * `numbered-title-list` - independent-role composites per `smartart-layout-
 * item-font-role.ts`'s `resolveRoleFontSize`, a different mechanism - and
 * `small-dots-horizontal--hier8` - ratio > 1, not a real demotion), the set
 * of `K` satisfying `round(rootSz * K) === descSz` for EVERY pair
 * simultaneously is `[0.78, 0.78125]` - non-empty, reproducing 54/56 rows
 * exactly (full derivation, incl. the width-independence proof: `smartart-
 * track-l-successor.md`, round 6 section). `data1.xml` carries NO paragraph
 * properties for either paragraph - the split is a rendering-time DEFAULT,
 * not authored data this codebase could read instead.
 *
 * `SMARTART_DESCENDANT_FONT_SCALE = 0.78` feeds a JOINT search (not two
 * independent fits): the folded item's own paragraph and its descendant
 * paragraph(s) are laid out top-to-bottom in the SAME box, so the search
 * variable is the item's own top-level size `R`; a candidate `R` "fits"
 * only when the ROOT paragraph's own block (with the REAL per-level
 * paragraph spacing below) PLUS every descendant paragraph's block, each
 * wrapped and measured at `R * SMARTART_DESCENDANT_FONT_SCALE`, together fit
 * the available height - never independently. Reproduces
 * `basic-block-list--hier5.pptx`'s cached 48pt EXACTLY.
 *
 * **`basic-process--hier5.pptx`/`--hier8.pptx` now EXACT (round 8)**: the
 * round-6/7 1pt-over residual on these two was NOT a `K`-ratio problem at
 * all - it was a HEIGHT-BUDGET problem (`resolveTieredItemFontSize`'s own
 * doc comment has the full derivation: a `roundRect`-family item's real
 * available height is its cached `dsp:txXfrm` height, not its `spPr`
 * straight-edge box height, and the FINAL continuous-to-whole-point snap
 * could round UP past a size that does not itself fit). An arbitrary
 * re-tuned `K` can still paper over any ONE font residual at the cost of
 * breaking `basic-block-list--hier5.pptx`'s exact match (verified: no
 * single `K` in [0.70, 0.95] satisfies all of hier5, hier8, and both
 * basic-process fixtures at once, back when the height budget was still
 * wrong) - 0.78 is kept because it is the DERIVED, correct rule, not the
 * gate-score-maximising one; do not re-tune it to chase a REMAINING height-
 * budget residual (see below) again.
 *
 * **Still a known residual**: `basic-block-list--hier8.pptx` (37pt cached,
 * gives 38pt: TWO stacked descendants, plain `rect`, none of round 8's
 * `roundRect`-specific work applies) and `basic-block-list--flat3.pptx`
 * (36pt cached, gives 37pt: no fold, also plain `rect`). COM-verified NOT a
 * wrap-line-count bug (`smartart-text-wrap-fit.test.ts`'s history and the
 * successor doc's round 6 section: real PowerPoint gives the IDENTICAL line
 * count this codebase predicts at the boundary sizes) - a genuine sub-point
 * greedy-advance-sum-vs-real-text-shaping precision ceiling, not (as far as
 * round 8 determined) the same height-budget mechanism as the `roundRect`
 * pair.
 *
 * Per-level paragraph spacing (`ROOT_SPCAFT_FACTOR`/`DESCENDANT_SPCAFT_FACTOR`
 * in `smartart-layout-item-font-tier-fit.ts`) is likewise a rendering default
 * absent from `data1.xml`: every cached `dsp:sp` with a folded descendant
 * carries `spcAft` 35% on the top-level paragraph and 15% on every
 * descendant, applied additively (not scaled by `SMARTART_LINE_SPACING_FACTOR`)
 * except after the box's LAST paragraph (`spcFirstLastPara="0"` skips it
 * there).
 */

import type { ConstraintIndex } from './smartart-constraint-solver';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { itemFontBoundsPx } from './smartart-layout-item-font-role';
import {
	itemMarginsPx,
	proportionalMarginFraction,
	resolveFontTable,
	snapToWholePoint,
} from './smartart-layout-item-font-size';
import { itemFits } from './smartart-layout-item-font-tier-fit';
import { SMARTART_LINE_SPACING_FACTOR } from './smartart-text-wrap-fit';

/**
 * See the module doc comment: the data-derived, FIXED top-level/descendant
 * size ratio (not text- or geometry-dependent). Any value in `[0.78,
 * 0.78125]` reproduces the corpus equally well; 0.78 is the round number in
 * that range.
 */
export const SMARTART_DESCENDANT_FONT_SCALE = 0.78;

/** A folded item's own top-level text plus its descendant paragraphs, kept SEPARATE (see module doc comment). */
export interface TieredFontFitItem {
	rootText: string;
	descendantTexts: readonly string[];
	width: number;
	height: number;
}

const PX_PER_PT = 96 / 72;

/**
 * Resolve the shared TOP-LEVEL font size (in pixels) for a group of `items`
 * that may each carry folded descendant paragraphs, plus the shared
 * DESCENDANT font size those paragraphs render at - see the module doc
 * comment for the joint search this runs and why it cannot be two
 * independent fits. Items with no descendants behave exactly like
 * `resolveSharedItemFontSize`'s existing single-paragraph fit (the
 * descendant term drops out entirely).
 *
 * @param cornerInsetPx - Extra per-side inset (pixels) beyond the item
 *   role's own margins, for a `roundRect`-family item shape (see
 *   `roundRectCornerInsetPx`'s doc comment). Applied AFTER the
 *   `naturalAspect` height cap (not folded into the caller's `item.width`/
 *   `item.height`), so it does not distort that cap's own `width * aspect`
 *   multiplication. Zero for a plain `rect`/other preset, where none of this
 *   applies.
 *
 *   **The real vertical budget, round 8 (COM was tried again and found
 *   unreliable for this corpus, same failure mode as round 5/7 - the
 *   derivation below is from the cached `drawing1.xml` directly, the ONLY
 *   reliable ground truth for this specific question):** the WIDTH loses
 *   `2 * cornerInsetPx` unconditionally (word-wrap must clear the rounded
 *   corner on either edge, at any line - reproducing the cached
 *   `dsp:txXfrm` width exactly for every `roundRect` item checked). The
 *   HEIGHT is where the round-6/7 residual actually lived, and the fix is
 *   NOT a tuned single-vs-double-sided deduction (that was curve-fitting,
 *   not a mechanism, and the coordinator correctly rejected it): it is that
 *   a NON-folded item's real avail height IS the cached `dsp:txXfrm` height
 *   with NO further margin subtraction, while a FOLDED item's real avail
 *   height IS `spPr height - marginsVertical - cornerInsetPx` (margins
 *   applied normally, corner ONCE, matching round 7's original finding
 *   exactly). First measured on `basic-process--flat3.pptx`'s (non-folded)
 *   cached `dsp:sp`, which shows `anchor="ctr"`, against its OWN sibling
 *   `basic-process--hier5.pptx`'s FOLDED item (same layoutDef, same box),
 *   which shows `anchor="t"` - suggesting the real PowerPoint mechanism is
 *   an anchor difference (a folded, top-anchored item tolerates wrapped
 *   text extending toward/past the nominal bottom edge, per round 4's
 *   un-confirmed hypothesis; a non-folded, center-anchored one does not).
 *   **`hasDescendants` (fold status) is what this codebase actually branches
 *   on, NOT a parsed `anchor` value - and the two are not perfectly
 *   correlated**: `vertical-process--hier5.pptx`'s folded item is cached
 *   `anchor="ctr"` (not `"t"`), yet needs the FOLDED (margin-included)
 *   branch to reproduce its cached 24pt exactly (verified against its own
 *   cached `dsp:txXfrm`/`spPr` box, 180x100pt, txXfrm 174x94pt). Treat
 *   `hasDescendants` as an empirically-confirmed proxy for which vertical
 *   BUDGET a folded/non-folded item needs (2 layoutDefs, 3 fixtures), not
 *   as a literal stand-in for the cached `anchor` attribute - the two
 *   disagree in at least one real fixture while the BUDGET choice it drives
 *   is still correct there. **This distinction is gated on
 *   `cornerInsetPx > 0`** (a `roundRect`-family preset): for a plain `rect`
 *   (`cornerInsetPx === 0`), dropping the margin from a non-folded item's
 *   height collapses to "no height constraint at all" and is WRONG -
 *   verified as a real regression (`basic-block-list--flat3.pptx` moved
 *   from a 1pt-over residual to 6pt-over) before this guard was added; a
 *   plain `rect` keeps the ORIGINAL always-subtract-margin behaviour
 *   regardless of fold status.
 *
 *   **A second, independent bug found while chasing this**: the final
 *   `snapToWholePoint(rootPx)` can round a CONTINUOUS value that fits (e.g.
 *   19.9pt) UP to the next whole point (20pt) even when that whole point
 *   does NOT itself fit - the binary search only guarantees its OWN
 *   continuous `lo` fits, never the ROUNDED result. Fixed generally (not
 *   `roundRect`-specific): after rounding, re-verify the rounded-UP
 *   candidate against the same per-item fit check; fall back to the next
 *   point DOWN when it does not (this is what closes `basic-process--
 *   hier5.pptx`'s remaining gap even before the anchor-conditioned height
 *   fix above is applied - see `smartart-layout-interpreter-linear.test.ts`'s
 *   `cornerInsetPx=0` case, which now lands on 24pt through THIS mechanism
 *   alone).
 */
export function resolveTieredItemFontSize(
	plan: ArrangementPlan,
	index: ConstraintIndex,
	items: readonly TieredFontFitItem[],
	fontName: string | undefined,
	naturalAspect: number | undefined,
	cornerInsetPx = 0,
): { rootSizePx: number; descendantSizePx: number } {
	const { ceilingPx, floorPx, role } = itemFontBoundsPx(plan, index);
	if (items.length === 0) {
		return { rootSizePx: ceilingPx, descendantSizePx: ceilingPx * SMARTART_DESCENDANT_FONT_SCALE };
	}
	const table = resolveFontTable(fontName);
	const fixedMargins = itemMarginsPx(index, role, table);
	const proportional = proportionalMarginFraction(index, role);
	const lineSpacingFactor = typeof naturalAspect === 'number' ? 1 : SMARTART_LINE_SPACING_FACTOR;

	/** Whether every item fits at candidate `rootPx`, with margins resolved against `marginBasisPx`. */
	const fitsAtMarginBasis = (rootPx: number, marginBasisPx: number): boolean => {
		const margins = proportional
			? {
					horizontal: proportional.horizontal * marginBasisPx,
					vertical: proportional.vertical * marginBasisPx,
				}
			: fixedMargins;
		for (const item of items) {
			const naturalHeight =
				typeof naturalAspect === 'number'
					? Math.min(item.height, item.width * naturalAspect)
					: item.height;
			const availWidthPx = Math.max(1, item.width - margins.horizontal - 2 * cornerInsetPx);
			// See this function's own doc comment ("the real vertical budget,
			// round 8") for the anchor-conditioned derivation and why it is
			// gated on `cornerInsetPx > 0`.
			const hasDescendants = item.descendantTexts.length > 0;
			const verticalReduction =
				hasDescendants || cornerInsetPx === 0
					? margins.vertical + cornerInsetPx
					: 2 * cornerInsetPx;
			const availHeightPx = Math.max(1, naturalHeight - verticalReduction);
			const descendantPx = rootPx * SMARTART_DESCENDANT_FONT_SCALE;
			const fits = itemFits(
				item,
				availWidthPx,
				availHeightPx,
				rootPx,
				descendantPx,
				table,
				lineSpacingFactor,
			);
			if (!fits) {
				return false;
			}
		}
		return true;
	};

	/** Largest `rootPx` in `[floorPx, ceilingPx]` for which every item fits, margins fixed for this pass. */
	const solveRootAtMarginBasis = (marginBasisPx: number): number => {
		const fitsAt = (rootPx: number): boolean => fitsAtMarginBasis(rootPx, marginBasisPx);
		if (fitsAt(ceilingPx)) {
			return ceilingPx;
		}
		if (!fitsAt(floorPx)) {
			return floorPx;
		}
		let lo = floorPx;
		let hi = ceilingPx;
		for (let i = 0; i < 20; i++) {
			const mid = (lo + hi) / 2;
			if (fitsAt(mid)) {
				lo = mid;
			} else {
				hi = mid;
			}
		}
		return lo;
	};

	let rootPx = solveRootAtMarginBasis(ceilingPx);
	if (proportional) {
		// Same margin-shrinks-with-font convergence as `fitSharedFontSize`.
		for (let i = 0; i < 6; i++) {
			const next = solveRootAtMarginBasis(rootPx);
			if (Math.abs(next - rootPx) < 0.01) {
				rootPx = next;
				break;
			}
			rootPx = next;
		}
	}
	// `rootPx` is a CONTINUOUS value the binary search proved fits (its own
	// `lo` invariant). `Math.round` can snap it to the whole point ABOVE that
	// continuous value (e.g. a converged 19.9pt rounds to 20pt) even when
	// that rounded-UP point size does NOT itself fit - `basic-process--
	// flat3.pptx`'s cached 19pt (continuous convergence ~19.9pt) is exactly
	// this case: the wrapped content only barely clears 19pt's own budget,
	// and 20pt's needs MORE room than even the continuous search found, not
	// less. Verify the rounded-up candidate against the SAME per-item fit
	// check (at the final, self-consistent margin basis) before accepting
	// it; fall back to the next point DOWN when it does not (never fails:
	// `rootPx` itself already fits, and fit is monotonic in size, so
	// anything at or below `rootPx` fits too).
	const rounded = snapToWholePoint(rootPx);
	const roundedUp = rounded > rootPx;
	const rootSizePx =
		roundedUp && !fitsAtMarginBasis(rounded, rootPx)
			? Math.floor(rootPx / PX_PER_PT) * PX_PER_PT
			: rounded;
	const descendantSizePx = snapToWholePoint(rootSizePx * SMARTART_DESCENDANT_FONT_SCALE);
	return { rootSizePx, descendantSizePx };
}
