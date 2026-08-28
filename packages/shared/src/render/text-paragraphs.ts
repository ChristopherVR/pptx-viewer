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
import { resolveParagraphBullet, resolveParagraphIndent } from './bullet-list';
import { getKinsokuLineBreakStyles } from './kinsoku-styles';
import { resolveParagraphGeometryOverrides } from './paragraph-geometry-overrides';
import { buildBulletMarkerStyle, buildParagraphRuns } from './paragraph-run-build';
import { resolveParagraphSpacing } from './paragraph-spacing';
import { resolveParagraphStrutFontSize } from './paragraph-strut';
import type { ParagraphRun, RenderParagraph } from './paragraph-types';
import type { FieldSubstitutionContext } from './text-field-substitution';
import {
	resolveCssTextAlign,
	resolveParagraphAlign,
	resolveParagraphRtl,
} from './text-paragraph-style';
import type { RunStyle } from './text-run-style';
import { resolveAutoFitFontScale } from './text-style-helpers';

// `ParagraphRun` / `RenderParagraph` live in `paragraph-types.ts` (imported
// above for this module's own use) and are exported to the barrel from there
// directly (`render/index.ts`), not re-exported here: every binding already
// imports them from the package root, never a deep `./text-paragraphs` path,
// so moving the definitions needs no importer to change.

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
	// The body's own `a:ea`/`a:cs`/`a:sym` faces and `a:tabLst`, for a run that
	// declares none of its own (see `paragraph-run-enrich`).
	const blockScriptStyle = element.textStyle;
	const tabStops = element.textStyle?.tabStops;
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

			// An empty paragraph's own `a:pPr` / `a:endParaRPr` ride its terminator
			// segment (there is no run to carry them), so read them from there. Also
			// this paragraph's own kinsoku / font-alignment / tab-default override,
			// resolved BEFORE the runs so a per-paragraph `@defTabSz` reaches
			// `buildParagraphRuns` instead of always the body's.
			const propsCarrier = firstSeg ?? (paraSegments.length === 0 ? terminator : undefined);
			const geometryOverrides = resolveParagraphGeometryOverrides(
				propsCarrier?.paragraphProperties,
				bodyStyle,
			);

			const runs: ParagraphRun[] = buildParagraphRuns({
				paraSegments,
				paraIndices,
				markerSegment,
				fontScale,
				blockFont,
				blockScriptStyle,
				tabStops,
				defaultTabSize: geometryOverrides.defaultTabSize,
				fontAlignment: geometryOverrides.fontAlignment,
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
			// A bare negative indent without marL or a bullet is not a hanging
			// indent. Applying it directly sends ordinary text outside its box.
			const textIndentPx =
				indent.textIndentPx !== undefined &&
				(indent.textIndentPx >= 0 || indent.marginLeftPx !== undefined || bullet !== undefined)
					? indent.textIndentPx
					: undefined;
			const bulletStyle = buildBulletMarkerStyle(bullet, firstSeg, fontScale, textIndentPx);
			const spacing = resolveParagraphSpacing({
				paraProps: propsCarrier?.paragraphProperties,
				bodyStyle,
				isFirst: paraIndex === 0,
				isLast: paraIndex === grouped.length - 1,
				// Omitted `a:bodyPr/@spcFirstLastPara` suppresses first/last spacing:
				// ECMA-376's default is `false`, confirmed by COM measurement (see
				// `resolveParagraphSpacing`'s `spaceFirstLast` doc comment) - only an
				// explicit `true` opts back in.
				spaceFirstLast: bodyStyle?.spaceFirstLastParagraph === true,
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
			// This paragraph's OWN kinsoku rules (`eaLnBrk`/`latinLnBrk`/
			// `hangingPunct`), not the shape-scope `firstSeg.style`, which core
			// collapses to whichever paragraph in the shape authors them first (see
			// `resolveParagraphGeometryOverrides`'s doc comment).
			const paragraphStyle: RunStyle = getKinsokuLineBreakStyles(geometryOverrides);
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
				textIndentPx,
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
