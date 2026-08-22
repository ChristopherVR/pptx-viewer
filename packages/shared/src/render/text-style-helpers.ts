/**
 * Framework-agnostic text CSS-builder helpers shared by every binding's text
 * renderer.
 *
 * These are pure functions extracted from the React `viewer/utils/text-utils`
 * layer. They return neutral CSS primitives (plain strings / numbers / literal
 * unions of CSS keyword values), never a framework's `CSSProperties` type, so
 * each binding can assign or cast the results into its own style object.
 */
import type { TextStyle } from 'pptx-viewer-core';

// ── Line height ───────────────────────────────────────────────────────────

/** Minimal line-spacing fields {@link resolveLineHeight} needs. */
export interface LineHeightSource {
	lineSpacing?: number;
	lineSpacingExactPt?: number;
}

/**
 * PowerPoint's single-spacing line height as a unitless multiplier of the font
 * size. Measured against PowerPoint itself (COM `TextRange2.BoundHeight` on
 * the issue #131 deck): every single-spaced Arial paragraph lays out at
 * exactly 1.2x its point size (10.5pt -> 12.6pt, 10pt -> 12pt, 8pt -> 9.6pt),
 * and the browser default `normal` (~1.25 for Arial) accumulated a visible
 * vertical drift over a full text panel.
 */
export const DEFAULT_LINE_HEIGHT = 1.2;

/**
 * Resolve a CSS `line-height` value from a TextStyle's spacing fields.
 *
 * - If `lineSpacingExactPt` is set (exact point mode from `a:lnSpc > a:spcPts`),
 *   returns a fixed `"<n>pt"` string.
 * - Otherwise the proportional multiplier from `a:spcPct` (`lineSpacing`) is
 *   used, defaulting to PowerPoint's single-spacing {@link DEFAULT_LINE_HEIGHT}.
 *
 * Returning a unitless multiplier (rather than relying on the browser's
 * font-dependent `normal`, which is ~1.2-1.5) lets the value scale with the
 * resolved font size, keeping multi-line text inside its box.
 *
 * @param textStyle     The text style carrying the spacing fields (may be
 *                      `undefined`).
 * @param hasItalicRuns Whether the block contains italic runs. No longer
 *                      changes the default: PowerPoint does not add leading
 *                      for italics, and the old 1.35 bump pushed every italic
 *                      block visibly below its authored position.
 */
export function resolveLineHeight(
	textStyle: LineHeightSource | undefined,
	hasItalicRuns: boolean,
): string | number {
	if (typeof textStyle?.lineSpacingExactPt === 'number' && textStyle.lineSpacingExactPt > 0) {
		return `${textStyle.lineSpacingExactPt}pt`;
	}
	void hasItalicRuns;
	// `a:spcPct` multiplies PowerPoint's single-spacing pitch, it does not
	// replace it: 200% at 20pt lays out at a 48pt pitch (2.4x, measured via COM
	// export on the issue #132 deck), so the multiplier stacks on the 1.2 base.
	return proportionalLineHeight(textStyle?.lineSpacing);
}

/**
 * CSS line-height for a proportional `a:spcPct` multiplier: the multiplier
 * stacked on PowerPoint's {@link DEFAULT_LINE_HEIGHT} single-spacing pitch,
 * or that base itself when no multiplier is set.
 */
export function proportionalLineHeight(lineSpacing: number | undefined): number {
	return typeof lineSpacing === 'number' && lineSpacing > 0
		? lineSpacing * DEFAULT_LINE_HEIGHT
		: DEFAULT_LINE_HEIGHT;
}

// ── Vertical text mapping ──────────────────────────────────────────────────

/** CSS `writing-mode` keyword values produced for vertical text directions. */
export type CssWritingMode = 'vertical-rl' | 'vertical-lr';
/** CSS `text-orientation` keyword values produced for vertical text. */
export type CssTextOrientation = 'mixed' | 'upright';
/** CSS `direction` keyword. */
export type CssDirection = 'rtl' | 'ltr';

/**
 * Map a parsed `textDirection` value to the corresponding CSS `writing-mode`.
 *
 * | textDirection      | CSS writing-mode |
 * |--------------------|------------------|
 * | `"vertical"`       | `vertical-rl`    |
 * | `"eaVert"`         | `vertical-rl`    |
 * | `"wordArtVert"`    | `vertical-rl`    |
 * | `"wordArtVertRtl"` | `vertical-rl`    |
 * | `"vertical270"`    | `vertical-lr`    |
 * | `"mongolianVert"`  | `vertical-lr`    |
 * | `"horizontal"`     | undefined        |
 */
export function toCssWritingMode(
	textDirection: TextStyle['textDirection'] | undefined,
): CssWritingMode | undefined {
	switch (textDirection) {
		case 'vertical':
		case 'eaVert':
		case 'wordArtVert':
		case 'wordArtVertRtl':
			return 'vertical-rl';
		case 'vertical270':
		case 'mongolianVert':
			return 'vertical-lr';
		default:
			return undefined;
	}
}

/**
 * Resolve CSS `text-orientation` for vertical writing modes.
 *
 * - `"vertical"` / `"eaVert"`: CJK glyphs stay upright, Latin rotated (`mixed`).
 * - `"vertical270"`: text rotated 270deg, all glyphs rotated (`mixed`).
 * - `"wordArtVert"`: all glyphs rendered upright, stacked vertically (`upright`).
 * - `"wordArtVertRtl"`: same as vertical-rl with RTL direction (`mixed`).
 * - `"mongolianVert"`: Mongolian vertical, left-to-right columns (`mixed`).
 * - `"horizontal"` / unset: undefined.
 */
export function toCssTextOrientation(
	textDirection: TextStyle['textDirection'] | undefined,
): CssTextOrientation | undefined {
	switch (textDirection) {
		case 'vertical':
		case 'eaVert':
		case 'vertical270':
		case 'wordArtVertRtl':
		case 'mongolianVert':
			return 'mixed';
		case 'wordArtVert':
			return 'upright';
		default:
			return undefined;
	}
}

/**
 * Resolve a CSS `direction` override for vertical text modes that require RTL.
 *
 * Only `"wordArtVertRtl"` requires an explicit `direction: rtl`.
 */
export function toCssVerticalDirection(
	textDirection: TextStyle['textDirection'] | undefined,
): CssDirection | undefined {
	if (textDirection === 'wordArtVertRtl') {
		return 'rtl';
	}
	return undefined;
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
		result.fontSize = Math.max(6, Math.round(baseFontSize * ts.autoFitFontScale));
	}

	// normAutofit with lnSpcReduction: reduce line height. Also `spAutoFit`-safe
	// for the same reason: the attribute only exists under `a:normAutofit`.
	if (
		ts.autoFitMode !== 'shrink' &&
		ts.autoFitLineSpacingReduction !== undefined &&
		ts.autoFitLineSpacingReduction > 0
	) {
		result.lineHeight =
			proportionalLineHeight(ts.lineSpacing) * (1 - ts.autoFitLineSpacingReduction);
	}

	return result;
}
