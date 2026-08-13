/**
 * Per-paragraph line-height and vertical margins (`a:lnSpc` / `a:spcBef` /
 * `a:spcAft`), resolved against the text body's own spacing.
 *
 * Split out of `text-paragraphs` to keep the builder focused; every binding
 * reaches it through the same barrel, so the import path is unchanged.
 */
import type { TextStyle } from 'pptx-viewer-core';

import { proportionalLineHeight } from './text-style-helpers';

/** Points to CSS px. */
const PT_TO_PX = 96 / 72;

/** Resolved per-paragraph line-height + space-before/after. */
export interface ParagraphSpacing {
	/** Unitless multiplier (`a:spcPct`) or a `"<n>pt"` / `"<n>px"` string (`a:spcPts`). */
	lineHeight?: number | string;
	/** `margin-top` in px from `a:spcBef`. */
	spaceBeforePx?: number;
	/** `margin-bottom` in px from `a:spcAft`. */
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
	 * `a:bodyPr/@spcFirstLastPara`. When false, the first paragraph's
	 * before-spacing and the last paragraph's after-spacing are suppressed;
	 * they would otherwise fight the body anchor. Defaults to true (no
	 * suppression) when omitted.
	 *
	 * PowerPoint's real rule is more involved than this: measured over COM, an
	 * omitted attribute behaves as `false` AND the flag governs the *second*
	 * paragraph's before-spacing, which this model has no way to express. Left
	 * as-is deliberately rather than half-changed.
	 */
	spaceFirstLast?: boolean;
}

/**
 * Resolve a paragraph's line-height and vertical margins.
 *
 * OOXML puts line spacing (`a:lnSpc`), space-before (`a:spcBef`) and
 * space-after (`a:spcAft`) on the paragraph, so collapsing them into one
 * body-level padding gives every paragraph the same gap and loses the authored
 * rhythm. Values the paragraph does not set fall back to the text body's, and
 * an exact measure (`a:spcPts`) beats a proportional one (`a:spcPct`) taken
 * from the same level; a paragraph's own multiplier is never mixed with an
 * exact value inherited from the body.
 *
 * `paragraphSpacingBefore` / `paragraphSpacingAfter` are already px from core.
 */
export function resolveParagraphSpacing(input: ParagraphSpacingInput): ParagraphSpacing {
	const { paraProps, bodyStyle, isFirst = false, isLast = false, spaceFirstLast = true } = input;
	const out: ParagraphSpacing = {};

	const before = paraProps?.paragraphSpacingBefore ?? bodyStyle?.paragraphSpacingBefore;
	if (typeof before === 'number' && before > 0 && (!isFirst || spaceFirstLast)) {
		out.spaceBeforePx = before;
	}

	const after = paraProps?.paragraphSpacingAfter ?? bodyStyle?.paragraphSpacingAfter;
	if (typeof after === 'number' && after > 0 && (!isLast || spaceFirstLast)) {
		out.spaceAfterPx = after;
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
		out.lineHeight = proportionalLineHeight(multiplier);
	}

	return out;
}
