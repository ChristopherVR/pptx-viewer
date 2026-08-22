/**
 * Per-paragraph overrides of the kinsoku / font-alignment / tab-default
 * geometry that `resolveShapeParagraphStyle` (core) otherwise collapses to
 * whichever paragraph authors it FIRST in the shape.
 *
 * Core keeps a single shape-scope `TextStyle` object it mutates across every
 * paragraph, first-wins (`if (textStyle.eaLineBreak === undefined) {...}`):
 * paragraph 1's own `a:pPr/@eaLnBrk`/`@latinLnBrk`/`@fontAlgn`/
 * `@hangingPunct`/`@defTabSz` becomes every OTHER paragraph's resolved value
 * too, because they all read the SAME mutated object. Each paragraph's own
 * authored value is still captured separately, strictly, on
 * `TextSegment.paragraphProperties` (`extractParagraphOwnProperties`) for
 * round-trip - just never consulted at render. This module is the render-side
 * fix: it resolves this paragraph's OWN value first, falling back to the
 * text body's resolved (first-paragraph-collapsed) value exactly like
 * `resolveParagraphSpacing` already does for spacing.
 *
 * @module render/paragraph-geometry-overrides
 */

import type { TextStyle } from 'pptx-viewer-core';

/** The geometry keys a paragraph may override independently of the body. */
export type ParagraphGeometryOverrides = Pick<
	TextStyle,
	'eaLineBreak' | 'latinLineBreak' | 'hangingPunctuation' | 'fontAlignment' | 'defaultTabSize'
>;

/**
 * Resolve this paragraph's own kinsoku / font-alignment / tab-default
 * geometry, falling back to the text body's resolved value for any field the
 * paragraph does not author itself.
 *
 * @param paraProps This paragraph's own `a:pPr` geometry snapshot
 *                  (`TextSegment.paragraphProperties`, from its first
 *                  segment), or `undefined` for a paragraph that authors none.
 * @param bodyStyle The element's resolved text style, used as the fallback.
 */
export function resolveParagraphGeometryOverrides(
	paraProps: TextStyle | undefined,
	bodyStyle: TextStyle | undefined,
): ParagraphGeometryOverrides {
	return {
		eaLineBreak: paraProps?.eaLineBreak ?? bodyStyle?.eaLineBreak,
		latinLineBreak: paraProps?.latinLineBreak ?? bodyStyle?.latinLineBreak,
		hangingPunctuation: paraProps?.hangingPunctuation ?? bodyStyle?.hangingPunctuation,
		fontAlignment: paraProps?.fontAlignment ?? bodyStyle?.fontAlignment,
		defaultTabSize: paraProps?.defaultTabSize ?? bodyStyle?.defaultTabSize,
	};
}
