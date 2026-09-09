/**
 * Split out of `smartart-layout-item-font-tier.ts` (the file-size budget):
 * the pure per-item fit check `resolveTieredItemFontSize`'s binary search
 * calls at every candidate size - whether a folded item's root paragraph
 * plus its descendant paragraph(s) together fit a given available box, per
 * that module's own doc comment (the joint search, per-level `spcAft`, and
 * the `SMARTART_DESCENDANT_FONT_SCALE` derivation all live there).
 *
 * Round 15: a `indent + widestDescendantLine <= availWidthPx` check (the
 * descendant's cached `a:pPr marL` hanging indent) was tried as an
 * INDEPENDENT width criterion BOLTED ON to a wrap that still ran against
 * the FULL `availWidthPx`. It reproduced `basic-process--hier5.pptx`/`--
 * hier8.pptx`'s cached boundaries but REGRESSED `basic-block-list--
 * hier5.pptx` and `vertical-process--hier5.pptx`: adding `indent` on top
 * of a width already computed WITHOUT room for it spuriously rejected
 * candidates that really do fit. REVERTED.
 *
 * **Round 16: the fix is geometric, not a bolted-on check.** A folded
 * descendant is really laid out by PowerPoint in a NARROWER column -
 * `availWidthPx - descendantIndentPx(descendantPx)` - not the item's full
 * width; wrapping the descendant text directly at that narrower column
 * (rather than wrapping at the full width first) keeps the resulting LINE
 * COUNT self-consistent with the height budget below, so a text that only
 * needs one extra wrapped line to clear the indent costs exactly one
 * extra line of height, never an unconditional hard reject. This is what
 * fixes round 15's regression: `basic-block-list--hier5.pptx`'s and
 * `vertical-process--hier5.pptx`'s descendant texts already wrap onto an
 * extra line inside the narrower column at the SAME candidate size their
 * root paragraph needs, so the height budget (which already accounts for
 * per-line height) absorbs the indent correctly instead of a separate
 * width gate rejecting them outright.
 *
 * `descendantIndentPt` (below) is the corpus-derived indent-vs-size rule:
 * scanned every folded `lin`/`snake` gallery fixture's cached
 * `drawing1.xml` (not just the 2-3 fixtures round 14/15 used), see its own
 * doc comment for the full derivation and the 30+ fixtures checked.
 *
 * @module smartart-layout-item-font-tier-fit
 */

import type { FontAdvanceTable } from './font-advance-widths.generated';
import type { TieredFontFitItem } from './smartart-layout-item-font-tier';
import { wrappedLineCount, wrappedWidestLineWidth } from './smartart-text-wrap-fit';

const ROOT_SPCAFT_FACTOR = 0.35;
const DESCENDANT_SPCAFT_FACTOR = 0.15;

/**
 * Duplicated from `smartart-layout-item-font-tier.ts` (not imported: that
 * module imports `itemFits` FROM this one, so importing a runtime value
 * back would be a circular value dependency). Both copies convert the same
 * CSS-px-per-point ratio and can never disagree in practice.
 */
const PX_PER_PT = 96 / 72;

/**
 * PowerPoint's own cached hanging indent (`a:pPr marL`, `indent="-marL"`)
 * for a folded item's DESCENDANT (level-2) paragraph, in points, keyed
 * purely by the descendant's OWN rendered font size in points.
 *
 * Corpus-derived (round 16): scanned every folded `lin`/`snake` gallery
 * fixture's cached `ppt/diagrams/drawing1.xml` (not the 2-3 fixtures round
 * 14/15 measured by hand) for the `<a:p>` with `lvl="1"` and read its
 * `marL` directly. Found: `marL` is ALWAYS an exact multiple of 4.5pt
 * (1/16 inch), and is a clean, ZERO-CONTRADICTION step function of the
 * descendant's own cached `a:rPr/@sz` alone - independent of the root
 * paragraph's size, the layout family (`basic-process`, `basic-block-
 * list`, `basic-cycle`, `basic-pie`, `pyramid-list`, `basic-timeline`,
 * `basic-venn`, every `picture-*`/`*-process`/`*-cycle` family sampled),
 * and the item box's own width/height - checked against 30+ distinct
 * fixtures with zero exceptions. The measured steps: 4.5pt for descendant
 * size in `[5, 11]`, 9.0pt for `[12, 15]`, 13.5pt for `[16, 19]`, 18.0pt
 * for `[20, 27]`, 22.5pt for `[28, 40]` (the corpus's own descendant-size
 * range tops out at 40pt; sizes above that are extrapolated, see below).
 * Matches round 14/15's own hand-measured numbers exactly: `basic-
 * process--hier5.pptx`/`vertical-process--hier5.pptx` (descendant 19pt)
 * both fall in `[16,19]` -> 13.5pt; `basic-process--hier8.pptx`
 * (descendant 15pt) falls in `[12,15]` -> 9.0pt; `basic-block-list--
 * hier5.pptx` (descendant 37pt) falls in `[28,40]` -> 22.5pt.
 */
const DESCENDANT_INDENT_STEPS_PT: ReadonlyArray<{
	readonly maxSz: number;
	readonly indentPt: number;
}> = [
	{ maxSz: 11, indentPt: 4.5 },
	{ maxSz: 15, indentPt: 9.0 },
	{ maxSz: 19, indentPt: 13.5 },
	{ maxSz: 27, indentPt: 18.0 },
	{ maxSz: 40, indentPt: 22.5 },
];

/**
 * `descendantIndentPt`'s value for a descendant size beyond the sampled
 * corpus (round 16's scan tops out at 40pt): the last measured tier
 * spanned `[28, 40]` (a 13pt-wide step) at 22.5pt; continue at the SAME
 * +4.5pt-per-13pt rate rather than assuming the table stops growing. Not
 * itself corpus-verified (no fixture samples above 40pt) - a defensive
 * extrapolation, not a measured rule.
 */
function extrapolatedIndentPt(descendantSizePt: number): number {
	const last = DESCENDANT_INDENT_STEPS_PT[DESCENDANT_INDENT_STEPS_PT.length - 1];
	const tiersBeyond = Math.floor((descendantSizePt - last.maxSz - 1) / 13) + 1;
	return last.indentPt + tiersBeyond * 4.5;
}

/** See {@link DESCENDANT_INDENT_STEPS_PT}'s doc comment. */
export function descendantIndentPt(descendantSizePt: number): number {
	for (const step of DESCENDANT_INDENT_STEPS_PT) {
		if (descendantSizePt <= step.maxSz) {
			return step.indentPt;
		}
	}
	return extrapolatedIndentPt(descendantSizePt);
}

/** One paragraph's own content-height contribution, including its trailing `spcAft` unless it is the box's last paragraph. */
function paragraphBlockPx(
	lines: number,
	sizePx: number,
	ratio: number,
	lineSpacingFactor: number,
	spcAftFactor: number,
	isLastParagraph: boolean,
): number {
	const content = lines * sizePx * ratio * lineSpacingFactor;
	return isLastParagraph ? content : content + spcAftFactor * sizePx * ratio;
}

/**
 * Whether `item`'s root paragraph at `rootPx` (laid out in the full
 * `availWidthPx` column) plus its descendants at `descendantPx` (each laid
 * out in the narrower `availWidthPx - descendantIndentPt(...)` column, see
 * the module doc comment) together fit `availHeightPx`. Also rejects a
 * candidate outright when any single word - root or descendant - cannot
 * fit its own column at all (a real overflow, not a wrap boundary).
 */
export function itemFits(
	item: TieredFontFitItem,
	availWidthPx: number,
	availHeightPx: number,
	rootPx: number,
	descendantPx: number,
	table: FontAdvanceTable,
	lineSpacingFactor: number,
): boolean {
	const hasDescendants = item.descendantTexts.length > 0;
	if (wrappedWidestLineWidth(item.rootText, availWidthPx, rootPx, table) > availWidthPx) {
		return false;
	}
	const rootLines = wrappedLineCount(item.rootText, availWidthPx, rootPx, table);
	let totalPx = paragraphBlockPx(
		rootLines,
		rootPx,
		table.lineHeightRatio,
		lineSpacingFactor,
		ROOT_SPCAFT_FACTOR,
		!hasDescendants,
	);
	const descendantIndentPx = descendantIndentPt(descendantPx / PX_PER_PT) * PX_PER_PT;
	const descendantWidthPx = Math.max(1, availWidthPx - descendantIndentPx);
	for (let i = 0; i < item.descendantTexts.length; i++) {
		const isLast = i === item.descendantTexts.length - 1;
		const text = item.descendantTexts[i];
		if (wrappedWidestLineWidth(text, descendantWidthPx, descendantPx, table) > descendantWidthPx) {
			return false;
		}
		const lines = wrappedLineCount(text, descendantWidthPx, descendantPx, table);
		totalPx += paragraphBlockPx(
			lines,
			descendantPx,
			table.lineHeightRatio,
			lineSpacingFactor,
			DESCENDANT_SPCAFT_FACTOR,
			isLast,
		);
	}
	return totalPx <= availHeightPx;
}
