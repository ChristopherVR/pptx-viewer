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
 * than the item's own top-level text, in the SAME box - confirmed directly
 * from the cached `dsp:sp`'s own `txBody`: `basic-block-list--hier5.pptx`'s
 * "Node One" run carries `sz="4800"` (48pt) while its folded child "Node
 * Two has a longer label" carries `sz="3700"` (37pt) in the SAME shape - a
 * uniform-size fit can only ever report ONE of these two numbers.
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
 * **Still a known residual**: `basic-block-list--flat3.pptx` (36pt cached,
 * gives 37pt: no fold, plain `rect`). COM-verified NOT a wrap-line-count bug
 * (`smartart-text-wrap-fit.test.ts`'s history and the successor doc's round
 * 6 section: real PowerPoint gives the IDENTICAL line count this codebase
 * predicts at the boundary sizes) - a genuine sub-point greedy-advance-sum-
 * vs-real-text-shaping precision ceiling. `basic-block-list--hier8.pptx`
 * (37pt cached, TWO stacked descendants) carried the SAME diagnosis through
 * round 15 but is now EXACT (round 16, see below) - the real cause there
 * was the descendant indent, not this precision ceiling.
 *
 * Per-level paragraph spacing (`ROOT_SPCAFT_FACTOR`/`DESCENDANT_SPCAFT_FACTOR`
 * in `smartart-layout-item-font-tier-fit.ts`) is likewise a rendering default
 * absent from `data1.xml`: every cached `dsp:sp` with a folded descendant
 * carries `spcAft` 35% on the top-level paragraph and 15% on every
 * descendant, applied additively (not scaled by `SMARTART_LINE_SPACING_FACTOR`)
 * except after the box's LAST paragraph (`spcFirstLastPara="0"` skips it
 * there).
 *
 * **Round 13: both special-case branches DELETED, replaced by the single
 * COM-derived formula above (`margins.vertical + 2 * cornerInsetPx`,
 * `lineSpacingFactor` always 0.9).** Round 12 tried the margin-unconditional
 * and lineSpacing-unconditional fixes SEPARATELY and in combination and
 * regressed `basic-process--flat3.pptx` every time - because round 12 (like
 * every round before it) kept the height term at a SINGLE `cornerInsetPx`,
 * never tried DOUBLE. Round 13's direct COM measurement of real
 * `BoundWidth`/`BoundHeight` proved double-corner is the correct term on
 * BOTH axes (see above) - with it, the margin and line-spacing fixes no
 * longer regress `basic-process--flat3.pptx` (still exact at 19pt) and
 * additionally fix `vertical-process--hier5.pptx` (now exact at 24pt,
 * previously 1pt under). **Round 13's residual, `--hier8.pptx` closed in
 * round 16, `--hier5.pptx` still open**: both had moved from exact to 1pt
 * OVER (25 vs 24, 20 vs 19), WIDTH-bound. Cause: `itemFits` was wrapping the
 * folded DESCENDANT paragraph at the item's FULL width instead of the
 * narrower column PowerPoint actually uses (the descendant's own cached
 * `a:pPr marL` hanging indent - see `smartart-layout-item-font-tier-fit.ts`'s
 * `descendantIndentPt`), not a glyph-advance precision ceiling as round
 * 13/14 first suspected. Wrapping at `availWidthPx - descendantIndentPt(...)`
 * (round 16) closes `--hier8.pptx` exactly; `--hier5.pptx` stays 1pt over
 * (25 vs 24) - its real `BoundWidth` gap at the rejected candidate is ~3x
 * `--hier8.pptx`'s, too large for the indent term alone to close.
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
 *   **The real vertical budget, round 13 - derived from live COM, not
 *   inferred (superseding every prior round's `anchor`/`hasDescendants`-
 *   gated special case, all now DELETED):** opened a COPY of 7 named
 *   fixtures, converted each SmartArt item to a real, independent AutoShape
 *   (`CommandBars.ExecuteMso("SmartArtConvertToShapes")`), restored its REAL
 *   cached `TextFrame2` margins (conversion resets them to an AutoShape
 *   default), then swept `Font.Size` through the cached size N-1..N+2 and
 *   read `TextRange.BoundHeight`/`BoundWidth` directly - PowerPoint's own
 *   real text layout, with none of this codebase's own wrap/line-height
 *   approximations in the loop. Result: `avail = dimension - margins(that
 *   axis, REAL, exactly as `TextFrame2` reports them) - 2 * cornerInsetPx`,
 *   the SAME formula on BOTH axes, with NO special-casing by fold status.
 *   Verified by hand against the measured `BoundWidth`/`BoundHeight`:
 *   `basic-process--flat3.pptx` (non-folded) is HEIGHT-bound (avail
 *   102.4511-11.4-6.00=85.05pt; real `BoundHeight` 83.64pt at cached 19pt
 *   fits, 88.05pt at 20pt does not); `basic-process--hier5.pptx` (folded)
 *   is WIDTH-bound (avail 170.7519-14.4-6.00=150.35pt; real `BoundWidth`
 *   146.02pt at cached 24pt fits, 152.98pt at 25pt does not) - the OLD
 *   model never checked width against its own avail at all, and the two
 *   special-cased branches were each tuned against only ONE of these two
 *   axes being the true binding constraint. Content height itself: the
 *   existing `SMARTART_LINE_SPACING_FACTOR` (0.9) applies UNCONDITIONALLY
 *   now (deleted the `naturalAspect ? 1 : 0.9` special case - COM confirms
 *   `basic-process--flat3.pptx`'s cached paragraphs carry the SAME 90%
 *   `spcPct` as every other fixture regardless of whether the item declares
 *   a geometric self-aspect).
 *
 *   **A second, independent bug found while chasing this** (round 8):
 *   the final
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
	const lineSpacingFactor = SMARTART_LINE_SPACING_FACTOR;

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
			const verticalReduction = margins.vertical + 2 * cornerInsetPx;
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
