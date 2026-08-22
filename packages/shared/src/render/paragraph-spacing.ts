/**
 * Per-paragraph line-height and vertical margins (`a:lnSpc` / `a:spcBef` /
 * `a:spcAft`), resolved against the text body's own spacing.
 *
 * Split out of `text-paragraphs` to keep the builder focused; every binding
 * reaches it through the same barrel, so the import path is unchanged.
 */
import type { TextStyle } from 'pptx-viewer-core';

import { proportionalLineHeight } from './text-line-height';

/** Points to CSS px. */
const PT_TO_PX = 96 / 72;

/** Resolved per-paragraph line-height + space-before/after. */
export interface ParagraphSpacing {
	/** Unitless multiplier (`a:spcPct`) or a `"<n>pt"` / `"<n>px"` string (`a:spcPts`). */
	lineHeight?: number | string;
	/**
	 * `margin-top` in px. Always `undefined`: PowerPoint never renders a
	 * paragraph's own `a:spcBef` as space above it - see
	 * {@link resolveParagraphSpacing}'s doc comment. Kept on the type for API
	 * stability (every binding's paragraph renderer already reads it and maps
	 * it to `margin-top`, so removing the field is unnecessary churn); it is
	 * simply never populated any more.
	 */
	spaceBeforePx?: number;
	/**
	 * `margin-bottom` in px, from BOTH this paragraph's own `a:spcAft` AND its
	 * own `a:spcBef` combined - see {@link resolveParagraphSpacing}.
	 */
	spaceAfterPx?: number;
}

/** Input for {@link resolveParagraphSpacing}. */
export interface ParagraphSpacingInput {
	/** This paragraph's own `a:pPr` geometry (from its first segment). */
	paraProps: TextStyle | undefined;
	/** The text body's style, used as the inheritance fallback. */
	bodyStyle?: TextStyle | undefined;
	/** True for the first paragraph in the body. */
	isFirst?: boolean;
	/** True for the last paragraph in the body. */
	isLast?: boolean;
	/**
	 * `a:bodyPr/@spcFirstLastPara`. Gates two things, each scoped to ONE edge
	 * paragraph only: the very first paragraph's own `spcBef`, and the very
	 * last paragraph's own `spcAft`. Off (the default, including omitted)
	 * suppresses both; every other paragraph's own spacing is unaffected by
	 * this flag either way. See {@link resolveParagraphSpacing} for how a
	 * paragraph's own `spcBef` and `spcAft` combine once resolved - that part
	 * is NOT what this flag controls, and is where the real complexity in
	 * this area actually lives.
	 *
	 * Measured over PowerPoint COM (`TextRange2.Paragraphs(n).BoundTop` /
	 * `.BoundHeight`) on bodies of N=1, 2, 3 and 4 paragraphs, both with
	 * uniform `spcBef=40pt`/`spcAft=30pt` and with every paragraph carrying a
	 * DISTINCT `spcBef`/`spcAft` pair (11/21, 32/42, 53/63, 74/84 pt) so a
	 * measured number can be traced to exactly one paragraph's authored value
	 * rather than several candidates that happen to sum the same:
	 *
	 * - The first paragraph's own `BoundHeight` grows by exactly ITS OWN
	 *   `spcBef` when the flag is on (e.g. 42.6pt -> 53.6pt on the distinct-
	 *   value deck, a +11pt delta matching p1's own 11pt `spcBef` exactly);
	 *   its `BoundTop` never moves either way. The last paragraph's own
	 *   `BoundHeight` mirrors it for `spcAft` (95.6pt -> 179.6pt, +84pt,
	 *   matching p4's own 84pt `spcAft` exactly).
	 * - Every paragraph strictly between the first and last is completely
	 *   unaffected by the flag in every N tested: its own gap to the next
	 *   paragraph is identical whether the flag is omitted, `"0"` or `"1"`.
	 *
	 * This confirms an earlier reading of the ORIGINAL 3-paragraph,
	 * `BoundTop`-only measurement (`project_spcfirstlastpara_com_measurement`
	 * memory), which concluded the flag "governs the SECOND paragraph's
	 * before-spacing": with only 3 paragraphs and uniform spacing, "p1's own
	 * spcBef, rendered after p1 instead of before it" and "p2's own spcBef"
	 * are numerically indistinguishable (both predict the exact same gap).
	 * The distinct-value deck (which paragraph's specific number shows up)
	 * and the `BoundHeight` reads (which paragraph's box the change lives in)
	 * together rule that reading out: it is the edge paragraph's OWN value,
	 * not its neighbour's.
	 */
	spaceFirstLast?: boolean;
	/**
	 * `a:normAutofit/@lnSpcReduction`: the shrink-to-fit line-spacing reduction,
	 * in 0..1. Applied to a resolved proportional (`a:spcPct`) line-height the
	 * same way `computeAutoFitTextStyle` applies it at the block level - it has
	 * to be applied here too because a paragraph or body line-spacing value
	 * produces an explicit per-paragraph `line-height`, which always outranks
	 * the block's own CSS `line-height` in the cascade. Not applied to an exact
	 * (`a:spcPts`) line-height: PowerPoint's reduction only affects the
	 * proportional form.
	 */
	lineSpacingReduction?: number;
}

/**
 * Resolve a paragraph's line-height and vertical margin.
 *
 * OOXML puts line spacing (`a:lnSpc`), space-before (`a:spcBef`) and
 * space-after (`a:spcAft`) on the paragraph, so collapsing them into one
 * body-level padding gives every paragraph the same gap and loses the authored
 * rhythm. Values the paragraph does not set fall back to the text body's, and
 * an exact measure (`a:spcPts`) beats a proportional one (`a:spcPct`) taken
 * from the same level; a paragraph's own multiplier is never mixed with an
 * exact value inherited from the body.
 *
 * **A paragraph's own `spcBef` is never rendered as space above it.** This
 * function used to (and every other rendering engine's intuition says it
 * should) emit the resolved `spcBef` as THIS paragraph's own `margin-top` and
 * `spcAft` as its own `margin-bottom`, so the visible gap between paragraph i
 * and i+1 came out as `spcAft(i) + spcBef(i+1)` (two independent, adjacent,
 * non-collapsing flex-item margins). Measured over PowerPoint COM with a
 * DISTINCT `spcBef`/`spcAft` pair on every paragraph (so a measured gap can be
 * traced to exactly one paragraph's authored value, unlike a uniform deck
 * where every hypothesis predicts the same total): that is wrong. An isolation
 * deck makes it unambiguous - three paragraphs, only the MIDDLE one authoring
 * a `spcBef` of 100pt (everything else 0) - measured `BoundTop` gaps:
 *
 * | gap    | measured  |
 * | ------ | --------- |
 * | p1->p2 | line only (21.6pt); p2's 100pt `spcBef` contributes NOTHING |
 * | p2->p3 | line + 100pt; ALL of it lands here, after p2, not before    |
 *
 * A paragraph's own `spcBef` and its own `spcAft` are both folded into the
 * SAME trailing gap (the one after that paragraph), never the leading one;
 * `spcBef` behaves as a second `spcAft` contribution, not as its mirror image.
 * The one exception is the two paragraphs `spaceFirstLast` gates (see that
 * field's doc comment): the very first paragraph's own `spcBef` and the very
 * last paragraph's own `spcAft`, each defaulting to suppressed. Cross-checked
 * against a 4-paragraph deck with four distinct `spcBef`/`spcAft` pairs (own
 * `BoundHeight` per paragraph matches `line + effective(spcBef) +
 * effective(spcAft)` to 0.1pt on every paragraph, in every `spaceFirstLast`
 * state) and against the original 3-paragraph uniform-value deck (which this
 * model reproduces exactly - see the test file).
 *
 * `paragraphSpacingBefore` / `paragraphSpacingAfter` are already px from core.
 */
export function resolveParagraphSpacing(input: ParagraphSpacingInput): ParagraphSpacing {
	const {
		paraProps,
		bodyStyle,
		isFirst = false,
		isLast = false,
		spaceFirstLast = false,
		lineSpacingReduction,
	} = input;
	const out: ParagraphSpacing = {};

	const before = paraProps?.paragraphSpacingBefore ?? bodyStyle?.paragraphSpacingBefore;
	const effectiveBefore =
		typeof before === 'number' && before > 0 && (!isFirst || spaceFirstLast) ? before : 0;

	const after = paraProps?.paragraphSpacingAfter ?? bodyStyle?.paragraphSpacingAfter;
	const effectiveAfter =
		typeof after === 'number' && after > 0 && (!isLast || spaceFirstLast) ? after : 0;

	// Both fold into the TRAILING margin (never the leading one) - see the
	// doc comment above for the COM measurement behind this.
	const combinedAfter = effectiveBefore + effectiveAfter;
	if (combinedAfter > 0) {
		out.spaceAfterPx = combinedAfter;
	}

	const hasOwnLineSpacing =
		paraProps?.lineSpacing !== undefined || paraProps?.lineSpacingExactPt !== undefined;
	const lineSource = hasOwnLineSpacing ? paraProps : bodyStyle;
	const exactPt = lineSource?.lineSpacingExactPt;
	const multiplier = lineSource?.lineSpacing;
	if (typeof exactPt === 'number' && exactPt > 0) {
		out.lineHeight = `${exactPt * PT_TO_PX}px`;
	} else if (typeof multiplier === 'number' && multiplier > 0) {
		// `a:spcPct` stacks on PowerPoint's 1.2 single-spacing pitch; see
		// `proportionalLineHeight` for the COM measurement behind it.
		// `compatLnSpc` (`a:bodyPr` only, never per-paragraph) opts out of that
		// stacking.
		const proportional = proportionalLineHeight(multiplier, bodyStyle?.compatibleLineSpacing);
		out.lineHeight =
			typeof lineSpacingReduction === 'number' && lineSpacingReduction > 0
				? proportional * (1 - lineSpacingReduction)
				: proportional;
	}

	return out;
}
