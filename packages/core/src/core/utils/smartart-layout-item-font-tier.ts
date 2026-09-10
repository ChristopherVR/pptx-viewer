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
 * round-6/7 1pt-over residual was a HEIGHT-BUDGET problem, not a `K`-ratio
 * one (`resolveTieredItemFontSize`'s own doc comment has the derivation) -
 * 0.78 is kept because it is DERIVED (no single `K` in [0.70, 0.95]
 * satisfies hier5/hier8/both basic-process fixtures at once), not re-tuned
 * to chase a height-budget residual.
 *
 * **Still a known residual**: `basic-block-list--flat3.pptx` (36pt cached,
 * gives 37pt: no fold, plain `rect`) - COM-verified NOT a wrap-line-count
 * bug, a genuine sub-point greedy-advance-sum-vs-real-text-shaping
 * precision ceiling. `basic-block-list--hier8.pptx` carried the SAME
 * diagnosis through round 15 but is EXACT since round 16 (the real cause
 * there was the descendant indent, not this precision ceiling).
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
 * COM-derived formula above** (`margins.vertical + 2 * cornerInsetPx`,
 * `lineSpacingFactor` unconditional) - double-corner-inset on BOTH axes is
 * the correct term (round 12 only ever tried single). Fixes `vertical-
 * process--hier5.pptx` (exact at 24pt). **Residual, `--hier8.pptx` closed
 * in round 16, `--hier5.pptx` still open**: both moved from exact to 1pt
 * OVER (25 vs 24, 20 vs 19), WIDTH-bound - `itemFits` was wrapping the
 * folded DESCENDANT at the item's FULL width instead of the narrower
 * column PowerPoint uses (the descendant's cached `a:pPr marL` hanging
 * indent - `smartart-layout-item-font-tier-fit.ts`'s `descendantIndentPt`).
 * Round 16's fix closes `--hier8.pptx` exactly; `--hier5.pptx` stays 1pt
 * over - its real `BoundWidth` gap is ~3x `--hier8.pptx`'s.
 */

import type { PptxSmartArtLayoutNode } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { itemFontBoundsPx, nodeFontBounds } from './smartart-layout-item-font-role';
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

/**
 * Round 17's `topAnchored`-conditioned line-spacing factor was REVERTED in
 * round 18: COM proved `VerticalAnchor` never changes line height (only
 * position), and the real bug was `lineHeightRatio` itself (1.212, measured
 * via `Shape.Height - margins`, not `TextRange.BoundHeight` - PowerPoint's
 * `AutoFit` sizing carries its own small padding beyond real content bound).
 * Fixed at the source (regenerated every font's table at `BoundHeight`-true
 * 1.2); with that, the plain unconditional `SMARTART_LINE_SPACING_FACTOR=0.9`
 * alone reproduces round 13's whole dataset via the existing additive
 * `spcAft` model - see `smartart-track-l-successor.md`'s round 18 section
 * for the full derivation and COM numbers. `smartart-layout-item-tx-
 * anchor.ts` itself is unaffected, just no longer used for this.
 */

/** A folded item's own top-level text plus its descendant paragraphs, kept SEPARATE (see module doc comment). */
export interface TieredFontFitItem {
	rootText: string;
	descendantTexts: readonly string[];
	width: number;
	height: number;
	/**
	 * Round 23: true when `descendantTexts` render as their OWN SEPARATE box
	 * (a role-split item template - "Vertical Bullet List"'s `childText` -
	 * not a paragraph stacked below the root's own in the SAME box, as
	 * `basic-process`'s folded bullet text is). The root then never gets a
	 * trailing `spcAft` for a descendant it is not adjacent to: measured,
	 * removing this spurious term alone closes `vertical-bullet-list--
	 * hier5.pptx`'s "Node One" from 39pt to cached 46pt exactly. Omitted:
	 * unchanged behaviour (every fold-into-the-same-box fixture unaffected).
	 */
	separateDescendantBox?: boolean;
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
 *   inferred:** `avail = dimension - margins(that axis, REAL) - 2 *
 *   cornerInsetPx`, the SAME formula on BOTH axes, no special-casing by
 *   fold status - verified against `basic-process--flat3.pptx` (HEIGHT-
 *   bound) and `--hier5.pptx` (WIDTH-bound), each fixture's real
 *   `BoundWidth`/`BoundHeight` checked at the cached size and one size up.
 *   `SMARTART_LINE_SPACING_FACTOR` applies unconditionally (no
 *   `naturalAspect`-gated special case).
 *
 *   **A second, independent bug (round 8)**: the final
 *   `snapToWholePoint(rootPx)` can round a CONTINUOUS value that fits (e.g.
 *   19.9pt) UP to the next whole point (20pt) even when that whole point
 *   does NOT itself fit. Fixed generally: after rounding, re-verify the
 *   rounded-UP candidate against the same per-item fit check; fall back to
 *   the next point DOWN when it does not.
 *
 * @param fontRoleNode - Round 18: the item-bearing layoutNode to resolve
 *   `primFontSz`/margins/rules against, when the caller already knows it
 *   and `itemFontBoundsPx`'s own `itemNode(plan.node)` first-child
 *   heuristic would pick the wrong one (a `composite` arranger's item
 *   slot is not always `plan.node`'s first child). Omitted: falls back to
 *   `itemFontBoundsPx(plan, index)` exactly as before.
 */
export function resolveTieredItemFontSize(
	plan: ArrangementPlan,
	index: ConstraintIndex,
	items: readonly TieredFontFitItem[],
	fontName: string | undefined,
	naturalAspect: number | undefined,
	cornerInsetPx = 0,
	fontRoleNode?: PptxSmartArtLayoutNode,
): { rootSizePx: number; descendantSizePx: number } {
	const { ceilingPx, floorPx, role } = fontRoleNode
		? nodeFontBounds(fontRoleNode, plan.node, index)
		: itemFontBoundsPx(plan, index);
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
