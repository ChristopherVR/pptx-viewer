/**
 * Framework-agnostic text CSS-builder helpers shared by every binding's text
 * renderer.
 *
 * These are pure functions extracted from the React `viewer/utils/text-utils`
 * layer. They return neutral CSS primitives (plain strings / numbers / literal
 * unions of CSS keyword values), never a framework's `CSSProperties` type, so
 * each binding can assign or cast the results into its own style object.
 */
import type { TextSegment, TextStyle } from 'pptx-viewer-core';

import { proportionalLineHeight } from './text-line-height';

// Line-height resolution (`resolveLineHeight` / `proportionalLineHeight` /
// `lineHeightToPx` / `DEFAULT_LINE_HEIGHT` / `LineHeightSource`) now lives in
// `text-line-height.ts`; re-exported from the barrel (`render/index.ts`), not
// here, so importers use that module directly.

// ── Vertical text mapping ──────────────────────────────────────────────────

/** CSS `writing-mode` keyword values produced for vertical text directions. */
export type CssWritingMode = 'vertical-rl' | 'vertical-lr';
/** CSS `text-orientation` keyword values produced for vertical text. */
export type CssTextOrientation = 'mixed' | 'upright' | 'sideways';
/** CSS `direction` keyword. */
export type CssDirection = 'rtl' | 'ltr';

/**
 * Map a parsed `textDirection` value to the corresponding CSS `writing-mode`.
 *
 * The block-progression axis (which side a new column is added on) is NOT
 * the same for every vertical mode: `vert`/`eaVert` stack new columns to the
 * LEFT (traditional CJK, `vertical-rl`), but `wordArtVert` (PowerPoint's
 * "Stacked" WordArt vertical text) stacks new columns to the RIGHT, the same
 * as `mongolianVert` and `vert270`. `wordArtVertRtl` is `wordArtVert`'s
 * mirrored sibling and reverses that back to `vertical-rl`: in real
 * PowerPoint (`audit-text/gen.py` slide 3, second paragraph of a `wordArtVert`
 * body renders in a column to the RIGHT of the first, while the same body
 * set to `wordArtVertRtl` renders its second paragraph's column to the LEFT.
 *
 * | textDirection      | CSS writing-mode |
 * |--------------------|------------------|
 * | `"vertical"`       | `vertical-rl`    |
 * | `"eaVert"`         | `vertical-rl`    |
 * | `"wordArtVertRtl"` | `vertical-rl`    |
 * | `"vertical270"`    | `vertical-lr`    |
 * | `"mongolianVert"`  | `vertical-lr`    |
 * | `"wordArtVert"`    | `vertical-lr`    |
 * | `"horizontal"`     | undefined        |
 */
export function toCssWritingMode(
	textDirection: TextStyle['textDirection'] | undefined,
): CssWritingMode | undefined {
	switch (textDirection) {
		case 'vertical':
		case 'eaVert':
		case 'wordArtVertRtl':
			return 'vertical-rl';
		case 'vertical270':
		case 'mongolianVert':
		case 'wordArtVert':
			return 'vertical-lr';
		default:
			return undefined;
	}
}

/**
 * Resolve CSS `text-orientation` for vertical writing modes.
 *
 * - `"vertical"` (`a:bodyPr/@vert="vert"`): PowerPoint rotates EVERY glyph 90deg,
 *   CJK included, so this is CSS `sideways`, not `mixed`: a CJK run under
 *   `vert` renders rotated exactly like an adjacent Latin run, unlike the
 *   same run under `eaVert` (`audit-text/pp/s3.png` columns 1 vs 3).
 * - `"eaVert"`: the traditional East-Asian vertical style: CJK glyphs stay
 *   upright and only non-CJK runs rotate (`mixed`). This is what
 *   distinguishes it from `"vertical"` above.
 * - `"vertical270"`: rotated 270deg, all glyphs rotated the same as `vertical`
 *   (`sideways`), just read bottom-to-top (see `toCssVerticalDirection`).
 * - `"wordArtVert"` / `"wordArtVertRtl"`: PowerPoint's "Stacked" WordArt style
 *   renders every glyph upright, one per line, regardless of script
 *   (`upright`); they differ only in which side a wrapped column grows on
 *   (`toCssWritingMode`), not in glyph rotation.
 * - `"mongolianVert"`: Mongolian's native vertical script stays upright, same
 *   as CJK under `eaVert` (`mixed`).
 * - `"horizontal"` / unset: undefined.
 */
export function toCssTextOrientation(
	textDirection: TextStyle['textDirection'] | undefined,
): CssTextOrientation | undefined {
	switch (textDirection) {
		case 'eaVert':
		case 'mongolianVert':
			return 'mixed';
		case 'vertical':
		case 'vertical270':
			return 'sideways';
		case 'wordArtVert':
		case 'wordArtVertRtl':
			return 'upright';
		default:
			return undefined;
	}
}

/**
 * Resolve a CSS `direction` override for vertical text modes that read
 * bottom-to-top instead of PowerPoint's usual top-to-bottom.
 *
 * Only `"vertical270"` (`a:bodyPr/@vert="vert270"`) reads bottom-to-top;
 * every other vertical mode, `wordArtVertRtl` included, still reads
 * top-to-bottom within a column (`wordArtVertRtl`'s "Rtl" is about which side
 * a wrapped column grows on, handled by `toCssWritingMode`, not reading
 * order). In CSS vertical writing modes, `direction: rtl` reverses the
 * INLINE base direction from top-to-bottom to bottom-to-top, which is exactly
 * `vertical270`'s ECMA-376 behaviour (`audit-text/pp/s3.png` column 2).
 */
export function toCssVerticalDirection(
	textDirection: TextStyle['textDirection'] | undefined,
): CssDirection | undefined {
	if (textDirection === 'vertical270') {
		return 'rtl';
	}
	return undefined;
}

/**
 * Count how many paragraphs `segments` group into (paragraph breaks are
 * `isParagraphBreak` segments, post-edit, or a bare `"\n"` text segment on
 * the slide-load path; a soft line break, `isLineBreak`, does not split a
 * paragraph). Mirrors `text-paragraphs.ts`'s own grouping predicate; kept
 * deliberately cheap (no bullet/run resolution) since the only thing callers
 * need is the count.
 */
function countParagraphs(segments: readonly TextSegment[] | undefined): number {
	if (!segments || segments.length === 0) {
		return 1;
	}
	let count = 1;
	for (const seg of segments) {
		if (seg.isParagraphBreak || (seg.text === '\n' && !seg.isLineBreak)) {
			count += 1;
		}
	}
	return count;
}

/**
 * Resolve `a:bodyPr/@anchor` to a CSS `justify-content` value for the flex
 * column {@link buildTextBodyLayoutStyle} lays paragraphs out in (D2-G5:
 * ECMA-376 §20.1.10.2 `ST_TextAnchoringType`).
 *
 * `distributed`/`justified` (`dist`/`just`) stretch paragraph spacing so the
 * text block fills the box's full vertical extent - CSS has no vertical
 * justify-text primitive, so this approximates: `space-between` spreads
 * multiple paragraphs across the box (the closest a flex column gets to
 * "distribute"), and a single paragraph (nothing to distribute) falls back to
 * centering, matching PowerPoint's own behaviour for a one-paragraph
 * distributed body.
 */
export function resolveVerticalAnchorJustifyContent(
	vAlign: TextStyle['vAlign'] | undefined,
	textSegments: readonly TextSegment[] | undefined,
): string {
	if (vAlign === 'distributed' || vAlign === 'justified') {
		return countParagraphs(textSegments) > 1 ? 'space-between' : 'center';
	}
	if (vAlign === 'middle') {
		return 'center';
	}
	if (vAlign === 'bottom') {
		return 'flex-end';
	}
	return 'flex-start';
}

/** Whether a `textDirection` value represents any vertical writing mode. */
export function isVerticalTextDirection(
	textDirection: TextStyle['textDirection'] | undefined,
): boolean {
	return (
		textDirection === 'vertical' ||
		textDirection === 'vertical270' ||
		textDirection === 'eaVert' ||
		textDirection === 'wordArtVert' ||
		textDirection === 'wordArtVertRtl' ||
		textDirection === 'mongolianVert'
	);
}

// ── Auto-fit font scaling ──────────────────────────────────────────────────

/**
 * Inputs to {@link computeAutoFitTextStyle} (geometry + text content).
 *
 * `text`, `width`, `height` and `bodyInsetVertical` are not read by
 * {@link computeAutoFitTextStyle} itself: `spAutoFit` no longer derives a font
 * scale from the measured text (see that function's doc comment), and
 * `normAutofit`'s scale comes from the authored `fontScale`, not a
 * measurement. Kept on the interface for call-site stability (`buildTextBlockStyle`
 * already has this geometry to hand) and because they describe the shape's
 * box, which is what actually changes size under `spAutoFit`.
 */
export interface AutoFitInput {
	/** The element's text style (carries the autoFit* fields). */
	textStyle: TextStyle | undefined;
	/** Plain text content of the block. */
	text: string;
	/** Element box width in px. */
	width: number;
	/** Element box height in px. */
	height: number;
	/** Combined top + bottom body inset in px. */
	bodyInsetVertical: number;
	/** Whether the block has italic runs (loosens the default line height). */
	hasItalicRuns: boolean;
	/** Default font size in px when the style omits one. */
	defaultFontSize: number;
}

/** Resolved auto-fit overrides; either field may be absent when unchanged. */
export interface AutoFitResult {
	fontSize?: number;
	lineHeight?: number;
}

/**
 * The `a:normAutofit/@fontScale` multiplier every RUN of a body must be painted
 * at, or `1` when the body does not shrink its text.
 *
 * The body-level {@link computeAutoFitTextStyle} only scales the block's own
 * `font-size`, which a run carrying its own `sz` (nearly every authored run)
 * overrides, so a shrink-to-fit title painted 43% too large. Every binding's run
 * builder multiplies by this, exactly as React's `renderSingleSegment` does.
 *
 * Out-of-range scales are ignored: `>= 1` is not a shrink, `<= 0` is not a size.
 */
export function resolveAutoFitFontScale(textStyle: TextStyle | undefined): number {
	const scale = textStyle?.autoFitFontScale;
	return typeof scale === 'number' && scale > 0 && scale < 1 ? scale : 1;
}

/**
 * Apply a `normAutofit` `fontScale` to an authored font size, rounded the way
 * PowerPoint itself rounds: to the nearest WHOLE POINT, not a fractional one.
 *
 * COM-measured ground truth (`audit-text` corpus): a 28pt run under
 * `fontScale="62500"` (62.5%) renders at 18pt in PowerPoint, not 17.5pt; under
 * `fontScale="40000"` (40%) it renders at 11pt, not 11.2pt. PowerPoint never
 * displays a fractional point size, so it rounds the scaled result before
 * painting, and every caller that multiplies a run's own size by this scale
 * has to round the same way or drift from the reference by up to half a
 * point on every shrunk run. `Math.round` matches both examples
 * (28 * 0.625 = 17.5 -> 18, half rounds up; 28 * 0.4 = 11.2 -> 11).
 *
 * A `fontScale` of `1` (autofit off, or out of range per
 * {@link resolveAutoFitFontScale}) is a no-op and returns `fontSize`
 * unrounded, so a body that never shrinks keeps sub-point authored sizes
 * (e.g. a theme default of 10.5pt) exactly as authored.
 */
export function scaleFontSizeForAutoFit(fontSize: number, fontScale: number): number {
	return fontScale === 1 ? fontSize : Math.round(fontSize * fontScale);
}

/**
 * Compute the auto-fit font-size / line-height overrides for a text block.
 *
 * ECMA-376 (§21.1.2.1.1 / §21.1.2.1.2) gives the two autofit modes opposite
 * jobs, and this function only ever implements the first one:
 *  - `a:normAutofit` (`autoFitMode: 'normal'`) scales the TEXT down to fit the
 *    shape. PowerPoint computes and stores the exact percentage as
 *    `fontScale` (and, separately, `lnSpcReduction` for line spacing); we
 *    apply that authored percentage verbatim rather than re-deriving one.
 *  - `a:spAutoFit` (`autoFitMode: 'shrink'`, the default for a new PowerPoint
 *    text box) resizes the SHAPE to fit the text, never the font. A shape
 *    authored or last edited in PowerPoint already has its `a:ext` on disk set
 *    to the box PowerPoint grew or shrank to fit the text at its authored
 *    size, so the font must render unshrunk. This function therefore applies
 *    no override at all for `spAutoFit`: shrinking the font on top of a box
 *    already sized to fit was rendering every default (spAutoFit) PowerPoint
 *    text box and title smaller than PowerPoint itself renders it.
 *
 * Returns an empty object when auto-fit is off or no override is needed; the
 * caller spreads the result over its own CSS object.
 */
export function computeAutoFitTextStyle(input: AutoFitInput): AutoFitResult {
	const { textStyle: ts } = input;
	if (!ts?.autoFit) {
		return {};
	}

	const baseFontSize = ts.fontSize || input.defaultFontSize;
	const result: AutoFitResult = {};

	// normAutofit with explicit fontScale: use the exact percentage PowerPoint
	// computed. `fontScale` is a `normAutofit`-only attribute (spAutoFit never
	// carries one), so this branch never fires for `spAutoFit` in practice; the
	// `autoFitMode` check below is belt-and-braces against a source that sets
	// both a stale `fontScale` and `autoFitMode: 'shrink'`.
	if (
		ts.autoFitMode !== 'shrink' &&
		ts.autoFitFontScale !== undefined &&
		ts.autoFitFontScale > 0 &&
		ts.autoFitFontScale < 1
	) {
		result.fontSize = Math.max(6, scaleFontSizeForAutoFit(baseFontSize, ts.autoFitFontScale));
	}

	// normAutofit with lnSpcReduction: reduce line height. Also `spAutoFit`-safe
	// for the same reason: the attribute only exists under `a:normAutofit`.
	if (
		ts.autoFitMode !== 'shrink' &&
		ts.autoFitLineSpacingReduction !== undefined &&
		ts.autoFitLineSpacingReduction > 0
	) {
		result.lineHeight =
			proportionalLineHeight(ts.lineSpacing, ts.compatibleLineSpacing) *
			(1 - ts.autoFitLineSpacingReduction);
	}

	return result;
}
