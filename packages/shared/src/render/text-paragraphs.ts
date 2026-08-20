/**
 * Build a slide element's rich text into rendered paragraphs of styled runs,
 * enriched with bullet markers + hanging-indent layout (framework-agnostic).
 *
 * THE paragraph builder: all five bindings call this and render the descriptor
 * it returns. It groups `textSegments` into paragraphs, resolves each
 * paragraph's bullet glyph / auto-number / font / colour, its marginLeft and
 * text-indent, its spacing, alignment and line-break rules, and drops the
 * core-inserted bullet-marker segment from the runs (the marker is rendered
 * separately so it can pick up bullet font/size/colour). Each binding maps the
 * returned plain-object styles onto its own style binding.
 *
 * It used to be described here as "mirrors React's `renderTextSegments`", which
 * was the problem rather than the design: React kept a private copy that had
 * drifted (it split paragraphs on a soft `a:br`, and never indented an
 * outline-level paragraph that authored no explicit `marL`). That copy is gone;
 * React's `text-paragraph-render` is now a view layer over this descriptor.
 */

import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { getSubstituteFontFamily, hasTextProperties } from 'pptx-viewer-core';

import { DEFAULT_FONT_FAMILY, DEFAULT_TEXT_FONT_SIZE } from '../constants';
import type { PictureBulletMarker } from './bullet-list';
import { resolveParagraphBullet, resolveParagraphIndent } from './bullet-list';
import { getKinsokuLineBreakStyles } from './kinsoku-styles';
import { buildBulletMarkerStyle, buildParagraphRuns } from './paragraph-run-build';
import { resolveParagraphSpacing } from './paragraph-spacing';
import type { ParagraphSpacing, ParagraphSpacingInput } from './paragraph-spacing';
import { resolveParagraphStrutFontSize } from './paragraph-strut';
import type { FieldSubstitutionContext } from './text-field-substitution';
import {
	resolveCssTextAlign,
	resolveParagraphAlign,
	resolveParagraphRtl,
} from './text-paragraph-style';
import type { RunEquation, RunHyperlink } from './text-run-meta';
import type { RunRuby } from './text-run-ruby';
import type { RunStyle } from './text-run-style';
import { segmentStyleToCss } from './text-run-style';
import { resolveAutoFitFontScale } from './text-style-helpers';

// Re-exported so existing `pptx-viewer-shared` / `./text-paragraphs` import
// paths for the run-style types + builder keep working after the split.
export type { RunStyle };
export { segmentStyleToCss };
export type { RunEquation, RunHyperlink };
export type { RunRuby };
// Re-exported so the existing `./text-paragraphs` import path for the
// paragraph-spacing resolver keeps working after the split.
export { resolveParagraphSpacing };
export type { ParagraphSpacing, ParagraphSpacingInput };

/** A single rendered run within a paragraph. */
export interface ParagraphRun {
	text: string;
	style: RunStyle;
	/**
	 * The run's hyperlink (`a:hlinkClick` / `a:hlinkMouseOver`), when it has one.
	 * A binding renders the run inside an `<a href>` when {@link RunHyperlink.href}
	 * is set, and routes {@link RunHyperlink.url} to its click handler otherwise
	 * (internal `ppaction://` slide jumps).
	 */
	hyperlink?: RunHyperlink;
	/**
	 * An inline equation (`m:oMath`) this run renders INSTEAD of `text`, which is
	 * empty for it. Emitted in the run sequence so the maths lands at its
	 * authored position between the runs around it.
	 */
	equation?: RunEquation;
	/**
	 * The run's phonetic guide (`a:ruby`: furigana, pinyin, bopomofo), when it
	 * has one. A binding renders `<ruby>{text}<rt style>{ruby.text}</rt></ruby>`;
	 * a run carrying one is never split per word, so the annotation appears once
	 * over the whole base run.
	 *
	 * Core parsed and saved ruby from the start, but `buildParagraphs` never read
	 * it, so the annotation rendered in React alone.
	 */
	ruby?: RunRuby;
	/**
	 * Index of the `textSegments` entry (of the override list when one was
	 * supplied) this run was built from.
	 *
	 * Shared splits one authored run into several per-word runs for PowerPoint's
	 * metric tracking, so this is many-to-one. It is the seam a binding uses to
	 * reach the facts the neutral model does not carry - React's find-match
	 * highlights, per-script font spans, tab stops and ruby all key off the
	 * originating segment - without regrouping the segments itself and drifting
	 * from the grouping here.
	 */
	segmentIndex?: number;
	/**
	 * Offset of this run's `text` within its segment's RENDERED text (after field
	 * substitution), so a caller holding per-segment character offsets can map
	 * them onto the split runs.
	 */
	charStart?: number;
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
	/**
	 * Indices of this paragraph's segments in the rendered segment list (the
	 * override list when one was supplied), in authored order and INCLUDING the
	 * bullet-marker segment the runs drop.
	 *
	 * The seam a binding uses to reach paragraph facts the neutral model does not
	 * carry, without regrouping the segments itself and drifting from the
	 * grouping here - which is exactly how React ended up splitting on every
	 * `"\n"` and treating a soft `a:br` as a paragraph break.
	 */
	segmentIndices: number[];
	/**
	 * True when this paragraph resolves right-to-left (`a:pPr/@rtl`, or the text
	 * body's default). A binding that mirrors its hanging indent for RTL reads
	 * this; the direction itself is already in {@link paragraphStyle}.
	 */
	rtl?: boolean;
	/**
	 * Extra CSS for the paragraph box, beyond the margin / indent / spacing
	 * fields above: this paragraph's own `text-align` (`a:pPr/@algn`), its BiDi
	 * `direction`, and the kinsoku line-breaking rules (`@eaLnBrk`,
	 * `@latinLnBrk`, `@hangingPunct`). Absent when the paragraph overrides none
	 * of them, which is the common case.
	 *
	 * All three used to be resolved in React's private paragraph renderer only,
	 * so a deck that centred one paragraph of a left-aligned body, or set CJK
	 * break rules, rendered differently in the other four bindings.
	 */
	paragraphStyle?: RunStyle;
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
		return element.text
			? [{ runs: [{ text: element.text, style: {} }], bulletStyle: {}, segmentIndices: [] }]
			: [];
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
	const grouped: Array<{
		paraSegments: TextSegment[];
		/** Index of each entry of `paraSegments` in the source segment list. */
		paraIndices: number[];
		terminator?: TextSegment;
	}> = [{ paraSegments: [], paraIndices: [] }];
	for (const [segIndex, seg] of segments.entries()) {
		if (seg.isParagraphBreak || (seg.text === '\n' && !seg.isLineBreak)) {
			// Keep the separator: for an EMPTY paragraph it is the only carrier
			// of the authored `a:endParaRPr` style (core stamps its font size on
			// it), which sizes the blank line's box below.
			grouped[grouped.length - 1].terminator = seg;
			grouped.push({ paraSegments: [], paraIndices: [] });
			continue;
		}
		grouped[grouped.length - 1].paraSegments.push(seg);
		grouped[grouped.length - 1].paraIndices.push(segIndex);
	}

	const bodyStyle = hasTextProperties(element) ? element.textStyle : undefined;
	const result: RenderParagraph[] = grouped.map(
		({ paraSegments, paraIndices, terminator }, paraIndex) => {
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

			const runs: ParagraphRun[] = buildParagraphRuns({
				paraSegments,
				paraIndices,
				markerSegment,
				fontScale,
				blockFont,
				fieldContext,
			});

			// Suppress bullets for paragraphs with no visible text content.
			const hasVisibleTextContent = paraSegments.some(
				(seg) => seg !== markerSegment && Boolean(seg.text) && seg.text.trim().length > 0,
			);
			const bullet = hasVisibleTextContent ? bulletResult : undefined;

			const indent = resolveParagraphIndent(
				paragraphIndents?.[paraIndex],
				firstSeg?.paragraphLevel,
			);
			const bulletStyle = buildBulletMarkerStyle(bullet, firstSeg, fontScale, indent.textIndentPx);
			// An empty paragraph's own `a:pPr` / `a:endParaRPr` ride its terminator
			// segment (there is no run to carry them), so read them from there.
			const propsCarrier = firstSeg ?? (paraSegments.length === 0 ? terminator : undefined);
			const spacing = resolveParagraphSpacing({
				paraProps: propsCarrier?.paragraphProperties,
				bodyStyle,
				isFirst: paraIndex === 0,
				isLast: paraIndex === grouped.length - 1,
				spaceFirstLast: bodyStyle?.spaceFirstLastParagraph !== false,
				lineSpacingReduction: element.textStyle?.autoFitLineSpacingReduction,
			});
			const strutFontSizePx = resolveParagraphStrutFontSize(
				paraSegments.length > 0 ? paraSegments : terminator ? [terminator] : [],
				hasTextProperties(element) ? element.textStyle?.fontSize : undefined,
				fontScale,
			);
			const rtl = resolveParagraphRtl(
				paraSegments.map((seg) => ({ segment: seg })),
				bodyStyle?.rtl,
			);
			const align = resolveParagraphAlign(
				paraSegments.map((seg) => ({ segment: seg })),
				bodyStyle?.align,
			);
			const paragraphStyle: RunStyle = getKinsokuLineBreakStyles(firstSeg?.style);
			const cssAlign = resolveCssTextAlign(align, rtl === true);
			if (cssAlign !== undefined) {
				paragraphStyle.textAlign = cssAlign;
			}
			if (rtl !== undefined) {
				paragraphStyle.direction = rtl ? 'rtl' : 'ltr';
				// `embed` rather than `plaintext`: the paragraph establishes its own
				// BiDi embedding level, so digits inside RTL text still run LTR per the
				// Unicode algorithm. `plaintext` is the body-level fallback.
				paragraphStyle.unicodeBidi = 'embed';
			}

			const para: RenderParagraph = {
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
				segmentIndices: paraIndices,
			};
			if (rtl !== undefined) {
				para.rtl = rtl;
			}
			if (Object.keys(paragraphStyle).length > 0) {
				para.paragraphStyle = paragraphStyle;
			}
			return para;
		},
	);

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
