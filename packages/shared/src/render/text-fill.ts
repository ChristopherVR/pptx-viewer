/**
 * Gradient / pattern text-fill CSS builder, shared by every binding's text
 * renderer.
 *
 * Pure, framework-agnostic. Returns a neutral CSS record (`Record<string,
 * string | number>`); each binding casts it into its own style type. Uses the
 * `background-clip: text` technique to clip a gradient or repeating-pattern
 * fill to the glyph outlines.
 */
import type { TextStyle } from 'pptx-viewer-core';

import { getPatternSvg, normalizeHexColor } from './fill-style';

/** A neutral CSS style map (keys are CSS properties; binding-agnostic). */
export type TextCssProperties = Record<string, string | number>;

/**
 * Build CSS properties for gradient or pattern text fills.
 *
 * Returns `undefined` when the style carries neither a `textFillGradient` nor a
 * resolvable `textFillPattern`.
 */
export function buildTextFillCss(style: TextStyle): TextCssProperties | undefined {
	// Gradient text fill
	if (style.textFillGradient) {
		return {
			background: style.textFillGradient,
			backgroundClip: 'text',
			WebkitBackgroundClip: 'text',
			WebkitTextFillColor: 'transparent',
		};
	}

	// Pattern text fill
	if (style.textFillPattern) {
		const fg = normalizeHexColor(style.textFillPatternForeground, '#000000');
		const bg = normalizeHexColor(style.textFillPatternBackground, '#ffffff');
		const svgPattern = getPatternSvg(style.textFillPattern, fg, bg);
		if (svgPattern) {
			const encoded = encodeURIComponent(svgPattern);
			return {
				background: `url("data:image/svg+xml,${encoded}")`,
				backgroundClip: 'text',
				WebkitBackgroundClip: 'text',
				WebkitTextFillColor: 'transparent',
			};
		}
	}

	return undefined;
}
