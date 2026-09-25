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
 * Build CSS properties for gradient, pattern, or picture text fills.
 *
 * Returns `undefined` when the style carries none of `textFillGradient`, a
 * resolvable `textFillPattern`, or a resolved `textFillBlipUrl`.
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

	// Picture (`a:blipFill`) text fill. `textFillBlipUrl` is populated by a
	// later async pass over the parsed slide (core has no zip/relationship
	// access at the point a run's own fill is parsed); `a:blipFill` on a run
	// was documented as handled but never actually implemented, so this used
	// to fall through to the run's plain `color` and paint solid black
	// (COM-verified: `audit-text` slide 13's "PICTURE FILL" run shows the
	// image through the glyphs in PowerPoint). `'stretch'` (no `a:tile`, the
	// common case, matching `<a:stretch><a:fillRect/></a:stretch>`) fills the
	// run's own box exactly, same as a shape's non-tiled image fill; `'tile'`
	// repeats the image at its natural size.
	if (style.textFillBlipUrl) {
		const tile = style.textFillBlipMode === 'tile';
		return {
			background: `url("${style.textFillBlipUrl}")`,
			backgroundSize: tile ? 'auto' : '100% 100%',
			backgroundRepeat: tile ? 'repeat' : 'no-repeat',
			backgroundClip: 'text',
			WebkitBackgroundClip: 'text',
			WebkitTextFillColor: 'transparent',
		};
	}

	return undefined;
}
