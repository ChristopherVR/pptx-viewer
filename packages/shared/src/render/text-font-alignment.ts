/**
 * `a:pPr/@fontAlgn` (font alignment within a line) -> CSS `vertical-align`,
 * shared by every binding's run renderer.
 *
 * `fontAlgn` decides where a run's glyphs sit relative to the LINE box when a
 * paragraph mixes run sizes (a large heading initial next to smaller body
 * text, or a footnote marker beside its reference): `t` pins glyphs to the
 * top of the line, `b` to the bottom, `ctr` centres them, and `auto`/`base`
 * (the default) uses the normal Roman-baseline alignment browsers already do.
 * It was parsed into `TextStyle.fontAlignment` and preserved for round-trip,
 * but no renderer ever mapped it onto anything - every binding rendered every
 * mixed-size line at baseline regardless of the authored value.
 *
 * @module render/text-font-alignment
 */

import type { RunStyle } from './text-run-style';

/** CSS `vertical-align` keyword values {@link fontAlignmentVerticalAlign} produces. */
export type FontAlignmentVerticalAlign = 'top' | 'middle' | 'bottom';

/**
 * Map an `a:pPr/@fontAlgn` token to the CSS `vertical-align` keyword that
 * reproduces it on an inline run span.
 *
 * @param fontAlgn The paragraph's resolved `fontAlignment` (`'auto'` | `'t'` |
 *                 `'ctr'` | `'base'` | `'b'`, or `undefined`).
 * @returns The `vertical-align` keyword, or `undefined` for `'auto'` /
 *          `'base'` / an absent value, which is the browser's own baseline
 *          default and needs no declaration.
 */
export function fontAlignmentVerticalAlign(
	fontAlgn: string | undefined,
): FontAlignmentVerticalAlign | undefined {
	switch (fontAlgn) {
		case 't':
			return 'top';
		case 'ctr':
			return 'middle';
		case 'b':
			return 'bottom';
		default:
			return undefined;
	}
}

/**
 * Apply the `@fontAlgn` `vertical-align` fallback to a run's style, unless the
 * run already declares its own (a super/subscript baseline shift is a more
 * specific, run-authored placement and always wins).
 */
export function applyFontAlignmentFallback(style: RunStyle, fontAlgn: string | undefined): void {
	if (style.verticalAlign !== undefined) {
		return;
	}
	const verticalAlign = fontAlignmentVerticalAlign(fontAlgn);
	if (verticalAlign !== undefined) {
		style.verticalAlign = verticalAlign;
	}
}
