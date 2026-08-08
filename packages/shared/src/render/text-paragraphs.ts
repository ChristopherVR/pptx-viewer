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
import { getSubstituteFontFamily, hasTextProperties } from 'pptx-viewer-core';

import { DEFAULT_FONT_FAMILY, DEFAULT_TEXT_FONT_SIZE } from '../constants';
import type { PictureBulletMarker } from './bullet-list';
import { resolveParagraphBullet, resolveParagraphIndent } from './bullet-list';
import { resolveParagraphStrutFontSize } from './paragraph-strut';
import type { FieldSubstitutionContext } from './text-field-substitution';
import { substituteFieldText } from './text-field-substitution';
import { buildRunEffectStyle } from './text-run-effects';
import type { RunStyle } from './text-run-style';
import {
	applyUnderlineVariant,
	authoredLetterSpacingPx,
	resolveRunFont,
	segmentStyleToCss,
	splitStyledRun,
} from './text-run-style';
import { proportionalLineHeight, resolveAutoFitFontScale } from './text-style-helpers';

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
	/**
	 * `font-size` in px to set on the paragraph element so its CSS line boxes
	 * are built from its OWN runs rather than the text body's default size.
	 * Undefined when the paragraph already matches the body default.
	 *
	 * See `resolveParagraphStrutFontSize` for why this is needed: without it a
	 * paragraph of small runs inside a larger-defaulting body is laid out on
	 * too-tall lines and overflows its shape.
	 */
	strutFontSizePx?: number;
	/**
	 * True when the paragraph has no runs and no bullet: an authored blank line
	 * (`<a:p><a:endParaRPr/></a:p>`).
	 *
	 * PowerPoint gives such a paragraph a full line box, which is how decks
	 * space a heading away from the bullet list under it. A binding must render
	 * something with height for it (a `<br>`), or the gap disappears and the
	 * block reads as one dense run of text (issue #131, slides 13-14).
	 */
	isEmpty?: boolean;
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
		// `a:spcPct` stacks on the 1.2 single-spacing base (see
		// `proportionalLineHeight` in text-style-helpers).
		out.lineHeight = proportionalLineHeight(pPr.lineSpacing);
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
 *
 * `segmentOverrides` replaces the element's own `textSegments` for this render
 * only. It exists for `a:linkedTxbx` chains, where the segments a box paints are
 * not its authored segments but the slice the chain's overflow distribution gave
 * it (see `getOverflowSegments`). It mirrors React's `renderTextSegments`
 * `segmentOverrides` argument, so all five bindings resolve a chain identically.
 * Everything downstream (autofit scale, paragraph indents, bullets) still comes
 * from the element, exactly as React does.
 */
export function buildParagraphs(
	element: PptxElement,
	fieldContext?: FieldSubstitutionContext,
	segmentOverrides?: readonly TextSegment[],
): RenderParagraph[] {
	if (!hasTextProperties(element)) {
		return [];
	}
	const segments = segmentOverrides ?? element.textSegments;
	if (!segments || segments.length === 0) {
		return element.text ? [{ runs: [{ text: element.text, style: {} }], bulletStyle: {} }] : [];
	}

	// `a:normAutofit/@fontScale`: applied to every authored run size below, since
	// a run's own `sz` overrides the (already scaled) body font-size.
	const fontScale = resolveAutoFitFontScale(element.textStyle);
	// What a run that declares no font of its own inherits from the text body.
	// Only used to measure the run for its PowerPoint metric compensation, so it
	// mirrors what `buildTextBlockStyle` declares on the block itself.
	const blockFont = {
		fontFamily: element.textStyle?.fontFamily
			? getSubstituteFontFamily(element.textStyle.fontFamily)
			: DEFAULT_FONT_FAMILY,
		fontSizePx: (element.textStyle?.fontSize || DEFAULT_TEXT_FONT_SIZE) * fontScale,
	};
	const paragraphIndents = element.paragraphIndents;
	const grouped: Array<{ paraSegments: TextSegment[]; terminator?: TextSegment }> = [
		{ paraSegments: [] },
	];
	for (const seg of segments) {
		if (seg.isParagraphBreak || (seg.text === '\n' && !seg.isLineBreak)) {
			// Keep the separator: for an EMPTY paragraph it is the only carrier
			// of the authored `a:endParaRPr` style (core stamps its font size on
			// it), which sizes the blank line's box below.
			grouped[grouped.length - 1].terminator = seg;
			grouped.push({ paraSegments: [] });
			continue;
		}
		grouped[grouped.length - 1].paraSegments.push(seg);
	}

	const result: RenderParagraph[] = grouped.map(({ paraSegments, terminator }, paraIndex) => {
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
				const style = segmentStyleToCss(seg, fontScale, { text, blockFont });
				applyUnderlineVariant(style, seg);
				// Per-run text effects (gradient/pattern fill, outer/inner shadow,
				// 3D extrusion text-shadow, blur, HSL, alpha opacity, glow,
				// reflection), mirroring React per-run span style. No-op {} for
				// plain runs, so ordinary text is unchanged.
				if (seg.style) {
					Object.assign(style, buildRunEffectStyle(seg.style));
				}
				// Each word and each gap carries its own PowerPoint metric tracking,
				// so a line the browser assembles out of them measures exactly what
				// PowerPoint measured and breaks where PowerPoint breaks (#149).
				// Emitting them as sibling RUNS rather than nested spans is what
				// gets this to Vue/Svelte/Vanilla with no binding change: they
				// already render one span per run.
				runs.push(
					...splitStyledRun(
						text,
						style,
						resolveRunFont(style, seg.style ?? {}, blockFont),
						authoredLetterSpacingPx(seg.style),
					),
				);
			}
		}

		// Suppress bullets for paragraphs with no visible text content.
		const hasVisibleTextContent = paraSegments.some(
			(seg) => seg !== markerSegment && Boolean(seg.text) && seg.text.trim().length > 0,
		);
		const bullet = hasVisibleTextContent ? bulletResult : undefined;

		const indent = resolveParagraphIndent(paragraphIndents?.[paraIndex], firstSeg?.paragraphLevel);

		const bulletStyle: RunStyle = {};
		if (bullet) {
			if (bullet.color) {
				bulletStyle.color = bullet.color;
			}
			if (bullet.fontFamily) {
				bulletStyle.fontFamily = bullet.fontFamily;
			} else if (firstSeg?.style?.fontFamily) {
				// A bullet that declares no `a:buFont` is painted in the paragraph's
				// own typeface, which is what React does (the marker rides the first
				// segment's span). Leaving it to inherit the text BODY's declaration
				// picked a different family whenever the first run overrode it, and a
				// marker glyph's advance is what positions the whole first line.
				bulletStyle.fontFamily = getSubstituteFontFamily(firstSeg.style.fontFamily);
			}
			// Weight / slant come from the marker's OWN segment, never from the text
			// body: a bold heading whose marker segment core parsed as regular
			// painted a bold glyph here and a regular one in React, and a heavier
			// marker is also a wider one, so the first line started further in.
			bulletStyle.fontWeight = firstSeg?.style?.bold ? 700 : 400;
			bulletStyle.fontStyle = firstSeg?.style?.italic ? 'italic' : 'normal';
			// The marker shrinks with the body's autofit scale exactly as its runs do
			// (an explicit `a:buSzPts` is an absolute size and stays put, matching
			// React's `renderSingleSegment`).
			const runFontSize = firstSeg?.style?.fontSize;
			if (typeof bullet.sizePts === 'number') {
				bulletStyle.fontSize = `${bullet.sizePts}px`;
			} else if (typeof bullet.sizePercent === 'number' && typeof runFontSize === 'number') {
				bulletStyle.fontSize = `${runFontSize * fontScale * (bullet.sizePercent / 100)}px`;
			} else if (fontScale !== 1 && typeof runFontSize === 'number') {
				bulletStyle.fontSize = `${runFontSize * fontScale}px`;
			}
			// PowerPoint draws the marker at `marL + indent` and starts the text
			// at `marL`, so the marker's box is exactly the hanging distance
			// wide. Reserving it here is what makes the runs line up on the
			// indent stop instead of butting straight against the glyph, and it
			// removes the need for a spacer character after the marker: a
			// non-breaking space inherits the marker's font, and Wingdings maps
			// U+00A0 to a visible dot, which painted a second bullet
			// (issue #131, slides 13-14).
			const hangPx =
				typeof indent.textIndentPx === 'number' && indent.textIndentPx < 0
					? -indent.textIndentPx
					: undefined;
			bulletStyle.display = 'inline-block';
			// `text-indent` inherits, and an inline-block is a block container:
			// without this reset the marker box applies the paragraph's negative
			// first-line indent AGAIN internally and paints the glyph a full
			// hang-width left of its own box (outside the text inset).
			bulletStyle.textIndent = '0px';
			if (hangPx !== undefined) {
				bulletStyle.minWidth = `${hangPx}px`;
			} else {
				bulletStyle.marginInlineEnd = '0.35em';
			}
		}
		// An empty paragraph's own `a:pPr` / `a:endParaRPr` ride its terminator
		// segment (there is no run to carry them), so read them from there.
		const propsCarrier = firstSeg ?? (paraSegments.length === 0 ? terminator : undefined);
		const spacing = resolveParagraphSpacing(propsCarrier?.paragraphProperties);
		const strutFontSizePx = resolveParagraphStrutFontSize(
			paraSegments.length > 0 ? paraSegments : terminator ? [terminator] : [],
			hasTextProperties(element) ? element.textStyle?.fontSize : undefined,
		);
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
			strutFontSizePx,
		};
	});

	const hasContent = (p: RenderParagraph): boolean =>
		p.runs.length > 0 || p.bulletMarker !== undefined || p.bulletPicture !== undefined;

	// An authored blank line between two paragraphs is real vertical spacing in
	// PowerPoint and has to survive to the renderer. Blank paragraphs AFTER the
	// last content are dropped: the load and edit-remap paths both leave a
	// trailing separator behind, and honouring those would grow every text body
	// (and shift anything vertically centred) for markup the deck never drew.
	let lastContent = -1;
	for (let i = 0; i < result.length; i++) {
		if (hasContent(result[i])) {
			lastContent = i;
		}
	}
	if (lastContent < 0) {
		return result.length === 1 ? result : [];
	}
	return result.slice(0, lastContent + 1).map((p) => (hasContent(p) ? p : { ...p, isEmpty: true }));
}
