/**
 * Per-paragraph spacing derived from a paragraph's own `a:pPr` (#69), mirroring
 * the shared `resolveParagraphSpacing` folded into `buildParagraphs`
 * (`render/text-paragraphs.ts`). The Angular renderer builds its paragraph
 * view-model in-component (custom bullet/indent handling), so it consumes the
 * same core `paragraphProperties` here rather than the shared `RenderParagraph`.
 */
import type { TextSegment } from 'pptx-viewer-core';

/** Resolved per-paragraph line-height + space-before/after. */
export interface ParagraphSpacing {
	/** Unitless multiplier (`a:spcPct`) or a `"<n>pt"` string (`a:spcPts`). */
	lineHeight?: number | string;
	/** `margin-top` in px from `a:spcBef`. */
	spaceBeforePx?: number;
	/** `margin-bottom` in px from `a:spcAft`. */
	spaceAfterPx?: number;
}

/**
 * Resolve a paragraph's own line-height + space-before/after from its parsed
 * `paragraphProperties` (the first segment's per-paragraph `a:pPr`). Only keys
 * the paragraph explicitly overrides are set, so a paragraph without its own
 * spacing inherits the body-level defaults the binding already applies. Exact
 * `lineSpacingExactPt` (`a:spcPts`) wins over the proportional multiplier.
 */
export function resolveParagraphSpacing(pPr: TextSegment['paragraphProperties']): ParagraphSpacing {
	const out: ParagraphSpacing = {};
	if (!pPr) {
		return out;
	}
	if (typeof pPr.lineSpacingExactPt === 'number' && pPr.lineSpacingExactPt > 0) {
		out.lineHeight = `${pPr.lineSpacingExactPt}pt`;
	} else if (typeof pPr.lineSpacing === 'number' && pPr.lineSpacing > 0) {
		out.lineHeight = pPr.lineSpacing;
	}
	if (typeof pPr.paragraphSpacingBefore === 'number') {
		out.spaceBeforePx = pPr.paragraphSpacingBefore;
	}
	if (typeof pPr.paragraphSpacingAfter === 'number') {
		out.spaceAfterPx = pPr.paragraphSpacingAfter;
	}
	return out;
}
