/**
 * Per-run letter-spacing helpers: the authored `a:rPr/@spc` character spacing,
 * combining it with a measured metric-tracking correction, and splitting one
 * styled run into the per-word / per-gap pieces a line needs to wrap the way
 * PowerPoint wrapped it (and, separately, the way `a:rPr/@u="words"` needs it
 * underlined).
 *
 * Split out of `text-run-style` to keep that module focused and small.
 */

import type { TextSegment } from 'pptx-viewer-core';

import { splitWordsForUnderline } from './text-decoration';
import type { RunFontSpec } from './text-metric-tracking';
import { splitRunForMetrics } from './text-metric-tracking';
import type { RunStyle } from './text-run-style';

/** Points-per-inch / CSS-px-per-inch ratio for hundredths-of-a-point → px. */
const PX_PER_POINT = 96 / 72;

/**
 * The authored `a:rPr/@spc` character spacing in CSS px (hundredths of a point).
 * The measured PowerPoint metric compensation layers on top of this, so callers
 * that re-derive a per-piece `letter-spacing` need the authored part on its own.
 */
export function authoredLetterSpacingPx(style: TextSegment['style']): number {
	const spc = style?.characterSpacing;
	return typeof spc === 'number' && spc !== 0 ? (spc / 100) * PX_PER_POINT : 0;
}

/** `letter-spacing` for a run piece: authored spacing plus its own tracking. */
export function pieceLetterSpacing(authoredPx: number, tracking: number): string | undefined {
	const spacing = authoredPx + tracking;
	return spacing === 0 ? undefined : `${spacing}px`;
}

/**
 * Remove the underline decoration (and the style/thickness/offset/colour CSS
 * that only describes an underline's own appearance) from a piece's style,
 * while preserving any OTHER decoration line it carries (`line-through`).
 *
 * D2-G3: `a:rPr/@u="words"` underlines only the non-whitespace characters of
 * a run, leaving inter-word spaces unmarked - distinct from `sng`'s continuous
 * line. Used on the whitespace pieces {@link splitStyledRun} produces for such
 * a run; a word piece keeps its style untouched.
 */
export function stripUnderlineDecoration(style: RunStyle): RunStyle {
	const next: RunStyle = { ...style };
	if (typeof next.textDecoration === 'string') {
		const remaining = next.textDecoration
			.split(' ')
			.filter((token) => token !== 'underline')
			.join(' ');
		if (remaining) {
			next.textDecoration = remaining;
		} else {
			delete next.textDecoration;
		}
	}
	delete next.textDecorationStyle;
	delete next.textDecorationThickness;
	delete next.textUnderlineOffset;
	delete next.textDecorationColor;
	return next;
}

/**
 * Split one styled run into the per-word / per-gap runs that make a LINE
 * measure what PowerPoint measured (see `splitRunForMetrics`), further split
 * at word/whitespace boundaries when the run is `a:rPr/@u="words"` so the
 * whitespace pieces render undecorated (D2-G3).
 *
 * Every binding that renders one span per run gets exact wrapping by emitting
 * these instead of the single run, so this is the one place the "which pieces,
 * what spacing" decision lives: shared's `buildParagraphs` covers Vue, Svelte
 * and Vanilla, Angular's own paragraph builder calls it directly, and React
 * splits inside its span.
 *
 * Returns a single entry (the run unchanged) when there is nothing to split,
 * which is the common case for short labels and one-word runs.
 *
 * @param underlineWords Whether the run's underline is `a:rPr/@u="words"`
 *   (checked by the caller against the segment's `underline`/`underlineStyle`).
 *   The metric-tracking boundary (whitespace vs. non-whitespace) already
 *   coincides with the underline-word boundary whenever a real measurer is
 *   available, but a piece can still straddle both when it is not (no
 *   `document`/canvas, e.g. a non-browser render), so this re-splits each
 *   metric piece with the independent, measurement-free
 *   {@link splitWordsForUnderline} rather than assuming the metric split
 *   already gives word/gap granularity.
 */
export function splitStyledRun(
	text: string,
	style: RunStyle,
	font: RunFontSpec,
	authoredPx: number,
	underlineWords = false,
): Array<{ text: string; style: RunStyle }> {
	// A gradient/pattern text fill (`background-clip: text`, see `text-fill.ts`)
	// paints across THIS element's own box, 0% at its left edge to 100% at its
	// right. Splitting the run into per-word/gap metric pieces below turns each
	// piece into its own sibling inline box, and the identical `background`
	// value then restarts from 0% inside EVERY one of them instead of spanning
	// the run once - a gradient run visibly repainted per word. Keeping the run
	// as a single piece fixes that, and also means a run that WRAPS onto
	// several lines still paints one continuous fill across them (a single
	// inline box's background is not re-clipped per wrapped line fragment by
	// default: `box-decoration-break: slice`). This trades away the per-word
	// PowerPoint advance-width correction (#149) for a run that also has a
	// gradient/pattern fill; the two have never been observed together on a
	// real deck. Cross-RUN continuity (adjacent runs sharing the identical
	// gradient) is handled separately, by `stitchContinuousGradientFill`.
	if (typeof style.background === 'string' && style.background.length > 0) {
		return [{ text, style }];
	}
	const pieces = splitRunForMetrics(text, font);
	if (pieces.length <= 1 && !underlineWords) {
		return [{ text, style }];
	}
	const out: Array<{ text: string; style: RunStyle }> = [];
	for (const piece of pieces) {
		const spacing = pieceLetterSpacing(authoredPx, piece.tracking);
		const pieceStyle: RunStyle = { ...style };
		if (spacing === undefined) {
			delete pieceStyle.letterSpacing;
		} else {
			pieceStyle.letterSpacing = spacing;
		}
		if (!underlineWords) {
			out.push({ text: piece.text, style: pieceStyle });
			continue;
		}
		const words = splitWordsForUnderline(piece.text);
		if (words.length === 0) {
			out.push({ text: piece.text, style: pieceStyle });
			continue;
		}
		for (const word of words) {
			out.push({
				text: word.text,
				style: word.underline ? pieceStyle : stripUnderlineDecoration(pieceStyle),
			});
		}
	}
	return out.length > 0 ? out : [{ text, style }];
}
