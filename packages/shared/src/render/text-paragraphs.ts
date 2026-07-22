/**
 * Build a slide element's rich text into rendered paragraphs of styled runs,
 * enriched with bullet markers + hanging-indent layout (framework-agnostic).
 *
 * Mirrors React's `renderTextSegments` (`text-paragraph-render.tsx`): groups
 * `textSegments` into paragraphs, resolves each paragraph's bullet glyph /
 * auto-number / font / colour and its marginLeft/text-indent, and drops the
 * core-inserted bullet-marker segment from the runs (the marker is rendered
 * separately so it can pick up bullet font/size/colour). Each binding maps the
 * returned plain-object styles onto its own style binding.
 */

import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import type { PictureBulletMarker } from './bullet-list';
import { resolveParagraphBullet, resolveParagraphIndent } from './bullet-list';
import type { FieldSubstitutionContext } from './text-field-substitution';
import { substituteFieldText } from './text-field-substitution';
import { buildRunEffectStyle } from './text-run-effects';
import type { RunStyle } from './text-run-style';
import { applyUnderlineVariant, segmentStyleToCss } from './text-run-style';

// Re-exported so existing `pptx-viewer-shared` / `./text-paragraphs` import
// paths for the run-style types + builder keep working after the split.
export type { RunStyle };
export { segmentStyleToCss };

/** A single rendered run within a paragraph. */
export interface ParagraphRun {
	text: string;
	style: RunStyle;
}

/** A rendered paragraph: runs plus resolved bullet + hanging-indent metadata. */
export interface RenderParagraph {
	runs: ParagraphRun[];
	/** Bullet glyph / number to render before the runs (or `undefined`). */
	bulletMarker?: string;
	/** Picture marker rendered before runs, or fallback metadata when unresolved. */
	bulletPicture?: PictureBulletMarker;
	/** Inline style for the bullet marker (font / size / colour). */
	bulletStyle: RunStyle;
	/** `margin-left` in px for the whole paragraph (hanging-indent layout). */
	marginLeftPx?: number;
	/** `text-indent` in px (first-line / hanging indent). */
	textIndentPx?: number;
	/**
	 * Per-paragraph `line-height` from this paragraph's own `a:pPr > a:lnSpc`.
	 * A unitless multiplier for proportional spacing (`a:spcPct`) or a `"<n>pt"`
	 * string for exact spacing (`a:spcPts`). Undefined when the paragraph does
	 * not override spacing (binding keeps the body-level line-height).
	 */
	lineHeight?: number | string;
	/** `margin-top` in px from this paragraph's `a:pPr > a:spcBef` (space before). */
	spaceBeforePx?: number;
	/** `margin-bottom` in px from this paragraph's `a:pPr > a:spcAft` (space after). */
	spaceAfterPx?: number;
}

/** Per-paragraph spacing derived from a paragraph's own `a:pPr`. */
interface ParagraphSpacing {
	lineHeight?: number | string;
	spaceBeforePx?: number;
	spaceAfterPx?: number;
}

/**
 * Resolve a paragraph's own line-height + space-before/after from its parsed
 * `paragraphProperties` (the first segment's per-paragraph `a:pPr`, #69). Only
 * keys the paragraph explicitly overrides are set, so a paragraph without its
 * own spacing inherits the body-level defaults each binding already applies.
 *
 * `lineSpacingExactPt` (exact `a:spcPts`) wins over the proportional
 * `lineSpacing` multiplier (`a:spcPct`), mirroring the body-level resolver in
 * `text-style-helpers`. `paragraphSpacingBefore` / `paragraphSpacingAfter` are
 * already parsed into px by core.
 */
function resolveParagraphSpacing(pPr: TextSegment['paragraphProperties']): ParagraphSpacing {
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

/**
 * Group `element`'s text segments into rendered paragraphs. Paragraph
 * separators are `isParagraphBreak` segments (post-edit remap) or bare `"\n"`
 * text segments (the slide-load path); soft line breaks insert a newline within
 * a paragraph. Bullets are suppressed for paragraphs with no visible text.
 *
 * When a `fieldContext` is supplied, any segment carrying a `fieldType`
 * (slide number, date/time, header/footer, slide title, docproperty) has its
 * run text replaced via {@link substituteFieldText}, matching React's
 * per-run substitution in `text-segment-render`. When omitted, the output is
 * byte-identical to the no-context path (substitution is a strict no-op).
 */
export function buildParagraphs(
	element: PptxElement,
	fieldContext?: FieldSubstitutionContext,
): RenderParagraph[] {
	if (!hasTextProperties(element)) {
		return [];
	}
	const segments = element.textSegments;
	if (!segments || segments.length === 0) {
		return element.text ? [{ runs: [{ text: element.text, style: {} }], bulletStyle: {} }] : [];
	}

	const paragraphIndents = element.paragraphIndents;
	const grouped: Array<{ paraSegments: TextSegment[] }> = [{ paraSegments: [] }];
	for (const seg of segments) {
		if (seg.isParagraphBreak || (seg.text === '\n' && !seg.isLineBreak)) {
			grouped.push({ paraSegments: [] });
			continue;
		}
		grouped[grouped.length - 1].paraSegments.push(seg);
	}

	const result: RenderParagraph[] = grouped.map(({ paraSegments }, paraIndex) => {
		const firstSeg = paraSegments[0];
		const baseFontSize = firstSeg?.style?.fontSize ?? element.textStyle?.fontSize ?? 16;
		const bulletResult = resolveParagraphBullet(firstSeg, baseFontSize);

		// The slide-load path inserts a *dedicated* marker segment whose text is the
		// precomputed glyph/number; we render the marker ourselves, so drop that
		// segment from the runs to avoid a doubled marker. A run that merely carries
		// `bulletInfo` but holds real content text (edit-remap path) is kept.
		const markerSegment =
			bulletResult && firstSeg?.bulletInfo && firstSeg.text.trim() === bulletResult.marker.trim()
				? firstSeg
				: undefined;

		const runs: ParagraphRun[] = [];
		for (const seg of paraSegments) {
			if (seg === markerSegment) {
				continue;
			}
			const rawText = seg.isLineBreak ? '\n' : seg.text;
			const text = seg.fieldType
				? substituteFieldText(rawText, seg.fieldType, fieldContext)
				: rawText;
			if (text) {
				const style = segmentStyleToCss(seg);
				applyUnderlineVariant(style, seg);
				// Per-run text effects (gradient/pattern fill, outer/inner shadow,
				// 3D extrusion text-shadow, blur, HSL, alpha opacity, glow,
				// reflection), mirroring React per-run span style. No-op {} for
				// plain runs, so ordinary text is unchanged.
				if (seg.style) {
					Object.assign(style, buildRunEffectStyle(seg.style));
				}
				runs.push({ text, style });
			}
		}

		// Suppress bullets for paragraphs with no visible text content.
		const hasVisibleTextContent = paraSegments.some(
			(seg) => seg !== markerSegment && Boolean(seg.text) && seg.text.trim().length > 0,
		);
		const bullet = hasVisibleTextContent ? bulletResult : undefined;

		const bulletStyle: RunStyle = {};
		if (bullet) {
			if (bullet.color) {
				bulletStyle.color = bullet.color;
			}
			if (bullet.fontFamily) {
				bulletStyle.fontFamily = bullet.fontFamily;
			}
			const runFontSize = firstSeg?.style?.fontSize;
			if (typeof bullet.sizePts === 'number') {
				bulletStyle.fontSize = `${bullet.sizePts}px`;
			} else if (typeof bullet.sizePercent === 'number' && typeof runFontSize === 'number') {
				bulletStyle.fontSize = `${runFontSize * (bullet.sizePercent / 100)}px`;
			}
		}

		const indent = resolveParagraphIndent(paragraphIndents?.[paraIndex], firstSeg?.paragraphLevel);
		const spacing = resolveParagraphSpacing(firstSeg?.paragraphProperties);
		return {
			runs,
			bulletMarker: bullet?.picture?.src ? undefined : bullet?.marker,
			bulletPicture: bullet?.picture,
			bulletStyle,
			marginLeftPx: indent.marginLeftPx,
			textIndentPx: indent.textIndentPx,
			lineHeight: spacing.lineHeight,
			spaceBeforePx: spacing.spaceBeforePx,
			spaceAfterPx: spacing.spaceAfterPx,
		};
	});

	return result.filter(
		(p) =>
			p.runs.length > 0 ||
			p.bulletMarker !== undefined ||
			p.bulletPicture !== undefined ||
			result.length === 1,
	);
}
