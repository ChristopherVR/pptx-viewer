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
 * Resolve a CSS `line-height` value from a TextStyle's spacing fields.
 *
 * - If `lineSpacingExactPt` is set (exact point mode from `a:lnSpc > a:spcPts`),
 *   returns a fixed `"<n>pt"` string.
 * - Otherwise the proportional multiplier from `a:spcPct` (`lineSpacing`) is
 *   used, defaulting to `1.25` (or `1.35` when the block carries italics, which
 *   sit slightly taller).
 *
 * Returning a unitless multiplier (rather than relying on the browser's
 * font-dependent `normal`, which is ~1.2-1.5) lets the value scale with the
 * resolved font size, keeping multi-line text inside its box.
 *
 * @param textStyle     The text style carrying the spacing fields (may be
 *                      `undefined`).
 * @param hasItalicRuns Whether the block contains italic runs (loosens the
 *                      default multiplier).
 */
export function resolveLineHeight(
	textStyle: LineHeightSource | undefined,
	hasItalicRuns: boolean,
): string | number {
	if (typeof textStyle?.lineSpacingExactPt === 'number' && textStyle.lineSpacingExactPt > 0) {
		return `${textStyle.lineSpacingExactPt}pt`;
	}
	return textStyle?.lineSpacing || (hasItalicRuns ? 1.35 : 1.25);
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

/** Inputs to {@link computeAutoFitTextStyle} (geometry + text content). */
export interface AutoFitInput {
	/** The element's text style (carries the autoFit* fields). */
	textStyle: TextStyle | undefined;
	/** Plain text content used to estimate the line count (spAutoFit path). */
	text: string;
	/** Element box width in px. */
	width: number;
	/** Element box height in px. */
	height: number;
	/** Combined top + bottom body inset in px (subtracted from height). */
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
 * Compute the auto-fit font-size / line-height overrides for a text block.
 *
 * Mirrors the React `getTextStyleForElement` auto-fit branch:
 *  - `normAutofit` with an explicit `fontScale` (0 < scale < 1) applies that
 *    exact percentage to the base font size (floored at 6px).
 *  - otherwise `spAutoFit` (shrink-to-fit) heuristically estimates how many
 *    lines the text needs and shrinks the font when the estimate overflows the
 *    available height (scale floored at 0.5, font floored at 6px).
 *  - `lnSpcReduction` from `normAutofit` reduces the line-height multiplier.
 *
 * Returns an empty object when auto-fit is off or no override is needed; the
 * caller spreads the result over its own CSS object.
 */
export function computeAutoFitTextStyle(input: AutoFitInput): AutoFitResult {
	const { textStyle: ts, text, width, height, bodyInsetVertical, hasItalicRuns } = input;
	if (!ts?.autoFit) {
		return {};
	}

	const baseFontSize = ts.fontSize || input.defaultFontSize;
	const result: AutoFitResult = {};

	// normAutofit with explicit fontScale: use the exact percentage.
	if (ts.autoFitFontScale !== undefined && ts.autoFitFontScale > 0 && ts.autoFitFontScale < 1) {
		result.fontSize = Math.max(6, Math.round(baseFontSize * ts.autoFitFontScale));
	} else if (ts.autoFitMode !== 'normal') {
		// spAutoFit (shrink): heuristic estimation.
		const textLength = text.length;
		const lineHeight = ts.lineSpacingExactPt
			? ts.lineSpacingExactPt / baseFontSize
			: ts.lineSpacing || (hasItalicRuns ? 1.35 : 1.25);
		const approxCharsPerLine = Math.max(1, Math.floor(width / (baseFontSize * 0.6)));
		const estimatedLines = Math.max(1, Math.ceil(textLength / approxCharsPerLine));
		const requiredHeight = estimatedLines * baseFontSize * lineHeight;
		const availableHeight = height - bodyInsetVertical;
		if (requiredHeight > availableHeight && availableHeight > 0) {
			const scale = Math.max(0.5, availableHeight / requiredHeight);
			result.fontSize = Math.max(6, Math.round(baseFontSize * scale));
		}
	}

	// normAutofit with lnSpcReduction: reduce line height.
	if (ts.autoFitLineSpacingReduction !== undefined && ts.autoFitLineSpacingReduction > 0) {
		const baseLineHeight =
			typeof ts.lineSpacing === 'number' ? ts.lineSpacing : hasItalicRuns ? 1.35 : 1.25;
		result.lineHeight = baseLineHeight * (1 - ts.autoFitLineSpacingReduction);
	}

	return result;
}
