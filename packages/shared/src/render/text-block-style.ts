/**
 * The single text-BODY (block) style builder every binding renders text with.
 *
 * Why this exists: React's `getTextStyleForElement` and the four near-identical
 * `getTextBlockStyle` copies in the Vue / Angular / Svelte / Vanilla bindings
 * had drifted apart, and the drift was invisible to a screenshot-level parity
 * test. The copies never read `a:normAutofit` (a title authored
 * `fontScale="70000"` painted 43% too large in four of five bindings) and never
 * read `a:bodyPr/@wrap="none"` (a no-wrap line wrapped to three lines), plus
 * they omitted the default font declaration, the italic padding nudge and the
 * body margin/indent pair. One builder, five callers, no drift.
 *
 * The result is a neutral CSS record (camelCase keys, plain values), never a
 * framework's `CSSProperties`, so each binding casts or maps it into its own
 * style binding. Lengths are emitted as bare numbers by default (React's
 * convention, and what its unit tests assert); bindings whose style binding
 * does not add units pass `pxLengths: true`.
 */

import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import {
	DEFAULT_BODY_INSET_LR_PX,
	DEFAULT_BODY_INSET_TB_PX,
	DEFAULT_FONT_FAMILY,
	DEFAULT_TEXT_COLOR,
	DEFAULT_TEXT_FONT_SIZE,
	HYPERLINK_COLOR,
} from '../constants';
import { normalizeHexColor } from './fill-style';
import { isLinkedTextBox } from './linked-text-box-overflow';
import { resolveCssTextAlign } from './text-paragraph-style';
import {
	computeAutoFitTextStyle,
	resolveLineHeight,
	toCssTextOrientation,
	toCssVerticalDirection,
	toCssWritingMode,
} from './text-style-helpers';

/** A neutral CSS record: camelCase property names, plain CSS values. */
export type TextBlockStyle = Record<string, string | number>;

/** Knobs the five bindings differ on; everything else is identical for all. */
export interface TextBlockStyleOptions {
	/**
	 * Colour used when the element authors none. React threads its
	 * theme-resolved default here; the other bindings pass their own constant.
	 */
	fallbackColor?: string;
	/**
	 * Emit the flex-column body box (`display` / `flex-direction` / size /
	 * `word-break` / `white-space`) and the `a:bodyPr/@anchor` -> `justify-content`
	 * mapping. React composes those separately (`getTextLayoutStyle`, which also
	 * owns multi-column bodies); the other four fold them into this one style.
	 */
	bodyLayout?: boolean;
	/**
	 * Emit lengths as `"12px"` strings rather than the bare `12` React's JSX
	 * style prop unit-suffixes for us. Vue / Angular / Svelte / Vanilla style
	 * bindings all assign the value verbatim, so a bare number is dropped.
	 */
	pxLengths?: boolean;
}

/** Properties whose numeric value is a px length (everything else is unitless). */
const LENGTH_PROPERTIES = new Set([
	'fontSize',
	'paddingTop',
	'paddingBottom',
	'paddingLeft',
	'paddingRight',
	'textIndent',
]);

/** Suffix every numeric length with `px`, leaving unitless values alone. */
function toPxLengths(style: TextBlockStyle): TextBlockStyle {
	const out: TextBlockStyle = {};
	for (const [key, value] of Object.entries(style)) {
		out[key] = typeof value === 'number' && LENGTH_PROPERTIES.has(key) ? `${value}px` : value;
	}
	return out;
}

/** Does any run in the body render in italics? */
function hasItalicRuns(element: PptxElement & { textSegments?: TextSegment[] }): boolean {
	if (!hasTextProperties(element)) {
		return false;
	}
	return Boolean(
		element.textStyle?.italic ||
		element.textSegments?.some((segment: TextSegment) => segment.style?.italic),
	);
}

/**
 * Build the CSS for one element's text body.
 *
 * Covers colour (including the hyperlink override), alignment and direction,
 * the font declaration, decorations, line height, body insets, the
 * element-level margin/indent fallback, vertical writing modes,
 * `wrap="none"`, and the `a:normAutofit` / `spAutoFit` font scale.
 *
 * Returns just `{ color }` for an element with no text properties, so a caller
 * can spread the result unconditionally.
 */
export function buildTextBlockStyle(
	element: PptxElement,
	options: TextBlockStyleOptions = {},
): TextBlockStyle {
	const fallbackColor = options.fallbackColor ?? DEFAULT_TEXT_COLOR;
	if (!hasTextProperties(element)) {
		return { color: fallbackColor };
	}
	const ts = element.textStyle;
	const italic = hasItalicRuns(element);
	const isRtl = ts?.rtl === true;

	const bodyTop = ts?.bodyInsetTop ?? DEFAULT_BODY_INSET_TB_PX;
	const bodyBottom = ts?.bodyInsetBottom ?? DEFAULT_BODY_INSET_TB_PX;
	const bodyLeft = ts?.bodyInsetLeft ?? DEFAULT_BODY_INSET_LR_PX;
	const bodyRight = ts?.bodyInsetRight ?? DEFAULT_BODY_INSET_LR_PX;

	// Element-level indent/margin is a fallback for single-level text only.
	// When core parsed per-paragraph indents, the paragraph renderer applies each
	// paragraph's own `marginLeft`/`textIndent`, and repeating the element-level
	// pair here double-counts it: a body whose first indented paragraph hangs by
	// -18px put `text-indent:-18px` on the body, every paragraph inherited it,
	// and each first line was pulled back out through the shape's `lIns` padding
	// (issue #131, slide 13).
	const hasParagraphIndents = (element.paragraphIndents?.length ?? 0) > 0;
	const bodyIndent = hasParagraphIndents ? 0 : ts?.paragraphIndent || 0;
	const bodyMarginLeft = hasParagraphIndents ? 0 : ts?.paragraphMarginLeft || 0;
	const bodyMarginRight = hasParagraphIndents ? 0 : ts?.paragraphMarginRight || 0;

	const decorations: string[] = [];
	if (ts?.underline || ts?.hyperlink) {
		decorations.push('underline');
	}
	if (ts?.strikethrough) {
		decorations.push('line-through');
	}

	const style: TextBlockStyle = {};

	// Layout first: the typography below must win on any shared property (a
	// `wrap="none"` body's `nowrap` has to beat the default `pre-wrap`).
	if (options.bodyLayout) {
		style.display = 'flex';
		style.flexDirection = 'column';
		style.width = '100%';
		style.height = '100%';
		style.whiteSpace = 'pre-wrap';
		style.wordBreak = 'break-word';
		style.justifyContent =
			ts?.vAlign === 'middle' ? 'center' : ts?.vAlign === 'bottom' ? 'flex-end' : 'flex-start';
	}

	style.color = ts?.hyperlink
		? normalizeHexColor(ts?.color, HYPERLINK_COLOR)
		: normalizeHexColor(ts?.color, fallbackColor);
	// An element-level highlight is only a fallback for segmentless text; with
	// segments each run carries its own `backgroundColor`.
	if ((element.textSegments?.length ?? 0) === 0 && ts?.highlightColor) {
		style.backgroundColor = normalizeHexColor(ts.highlightColor, undefined);
	}
	style.textAlign = resolveCssTextAlign(ts?.align, isRtl) ?? 'left';
	// Vertical RTL modes (`wordArtVertRtl`) outrank paragraph-level RTL.
	style.direction = toCssVerticalDirection(ts?.textDirection) ?? (isRtl ? 'rtl' : 'ltr');
	if (isRtl) {
		style.unicodeBidi = 'plaintext';
	}
	// Always declare a size and a family: see DEFAULT_FONT_FAMILY for why an
	// omitted declaration is a real rendering difference, not a no-op.
	style.fontSize = ts?.fontSize || DEFAULT_TEXT_FONT_SIZE;
	style.fontFamily = ts?.fontFamily || DEFAULT_FONT_FAMILY;
	style.fontWeight = ts?.bold ? 700 : 400;
	style.fontStyle = ts?.italic ? 'italic' : 'normal';
	style.textDecorationLine = decorations.length > 0 ? decorations.join(' ') : 'none';
	if (ts?.strikethrough && ts?.strikeType === 'dblStrike') {
		style.textDecorationStyle = 'double';
	}
	style.lineHeight = resolveLineHeight(ts, italic);
	// Italic glyphs overhang their line box; one extra px of vertical inset stops
	// the top and bottom rows being clipped by the shape edge.
	style.paddingTop = bodyTop + (italic ? 1 : 0);
	style.paddingBottom = bodyBottom + (italic ? 1 : 0);
	style.paddingLeft = bodyLeft + bodyMarginLeft;
	style.paddingRight = bodyRight + bodyMarginRight;
	style.textIndent = bodyIndent;
	style.overflow = 'visible';

	const writingMode = toCssWritingMode(ts?.textDirection);
	if (writingMode) {
		style.writingMode = writingMode;
	}
	const textOrientation = toCssTextOrientation(ts?.textDirection);
	if (textOrientation) {
		style.textOrientation = textOrientation;
	}

	// `a:bodyPr/@wrap="none"`: PowerPoint lets the line run past the shape.
	if (ts?.textWrap === 'none') {
		style.whiteSpace = 'nowrap';
		style.overflow = 'visible';
	}

	// A member of an `a:linkedTxbx` chain must CLIP, not spill: the text this box
	// cannot hold is what the successor box renders, so letting it overflow here
	// paints the same run twice (once escaping this box, once inside the next).
	// Applied after the `wrap="none"` branch above so it wins for a no-wrap
	// linked box, matching React, which appends the same `overflow: hidden` last.
	if (isLinkedTextBox(element)) {
		style.overflow = 'hidden';
	}

	// Auto-fit: the OOXML-provided `fontScale` / `lnSpcReduction` when present,
	// otherwise the shrink-to-fit heuristic. Applied last so it overrides the
	// authored font size and line height.
	const autoFit = computeAutoFitTextStyle({
		textStyle: ts,
		text: element.text ?? '',
		width: element.width,
		height: element.height,
		bodyInsetVertical: bodyTop + bodyBottom,
		hasItalicRuns: italic,
		defaultFontSize: DEFAULT_TEXT_FONT_SIZE,
	});
	if (autoFit.fontSize !== undefined) {
		style.fontSize = autoFit.fontSize;
	}
	if (autoFit.lineHeight !== undefined) {
		style.lineHeight = autoFit.lineHeight;
	}

	return options.pxLengths ? toPxLengths(style) : style;
}
