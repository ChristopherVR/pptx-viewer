/**
 * The decoration extras a run's own CSS does not cover on its own: what a
 * NESTED span inside it must repeat, and the underline-style / double-strike
 * variant CSS layered on top of the boolean `text-decoration`.
 *
 * Split out of `text-run-style` to keep that module focused and small.
 */

import type { TextSegment } from 'pptx-viewer-core';

import { resolveUnderlineDecorationStyle } from './text-decoration';
import type { RunStyle } from './text-run-style';

/**
 * The decoration properties a NESTED span inside a run has to repeat.
 *
 * `text-decoration-line` and its colour / style / thickness companions do not
 * inherit: an ancestor's underline is *drawn through* its inline descendants,
 * but each descendant still computes `none` of its own. Four bindings never
 * notice, because shared's per-word split (`splitStyledRun`) clones the whole
 * run style onto every piece, so the element that directly parents the text
 * carries the underline. React renders one span per run and nests its per-word
 * metric pieces and per-script font spans INSIDE it, so the text's own parent
 * declared no decoration and a hyperlink (underlined by PowerPoint's default,
 * see {@link segmentStyleToCss} in `text-run-style.ts`) reported
 * `text-decoration-line: none` where the other four reported `underline`.
 *
 * @returns The decoration subset to merge onto a nested span, or `undefined`
 *          when the run carries no decoration and the span needs nothing.
 */
export function nestedTextDecorationStyle(style: RunStyle): RunStyle | undefined {
	const nested: RunStyle = {};
	for (const key of [
		'textDecoration',
		'textDecorationLine',
		'textDecorationColor',
		'textDecorationStyle',
		'textDecorationThickness',
	]) {
		const value = style[key];
		if (value !== undefined) {
			nested[key] = value;
		}
	}
	return Object.keys(nested).length > 0 ? nested : undefined;
}

/**
 * Layer the underline-style / double-strike *variant* decoration CSS
 * (`text-decoration-style` / `-thickness` / `text-underline-offset`) onto a run
 * style. Kept separate from `segmentStyleToCss` (in `text-run-style.ts`) so
 * that helper's contract (boolean `textDecoration` only) stays stable for its
 * other consumers; this is applied additively by `buildParagraphs` when
 * building each run, mirroring React's segment renderer
 * (`text-segment-render.tsx`), which applies `resolveUnderlineDecorationStyle`
 * over the boolean underline.
 */
export function applyUnderlineVariant(style: RunStyle, seg: TextSegment): void {
	const s = seg.style;
	if (!s) {
		return;
	}
	const isDoubleStrike = Boolean(s.strikethrough && s.strikeType === 'dblStrike');
	// Only the underline path needs an explicit style token; a plain solid
	// underline (or no underline) leaves the boolean `textDecoration` untouched.
	const deco = resolveUnderlineDecorationStyle(
		isDoubleStrike,
		s.underline ? s.underlineStyle : undefined,
	);
	if (!deco) {
		return;
	}
	if (deco.textDecorationStyle !== undefined) {
		style.textDecorationStyle = deco.textDecorationStyle;
	}
	if (deco.textDecorationThickness !== undefined) {
		style.textDecorationThickness = deco.textDecorationThickness;
	}
	if (deco.textUnderlineOffset !== undefined) {
		style.textUnderlineOffset = deco.textUnderlineOffset;
	}
}
