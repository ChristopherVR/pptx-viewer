/**
 * Per-run letter-spacing helpers: the authored `a:rPr/@spc` character spacing,
 * combining it with a measured metric-tracking correction, and splitting one
 * styled run into the per-word / per-gap pieces a line needs to wrap the way
 * PowerPoint wrapped it.
 *
 * Split out of `text-run-style` to keep that module focused and small.
 */

import type { TextSegment } from 'pptx-viewer-core';

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
 * Split one styled run into the per-word / per-gap runs that make a LINE
 * measure what PowerPoint measured (see `splitRunForMetrics`).
 *
 * Every binding that renders one span per run gets exact wrapping by emitting
 * these instead of the single run, so this is the one place the "which pieces,
 * what spacing" decision lives: shared's `buildParagraphs` covers Vue, Svelte
 * and Vanilla, Angular's own paragraph builder calls it directly, and React
 * splits inside its span.
 *
 * Returns a single entry (the run unchanged) when there is nothing to split,
 * which is the common case for short labels and one-word runs.
 */
export function splitStyledRun(
	text: string,
	style: RunStyle,
	font: RunFontSpec,
	authoredPx: number,
): Array<{ text: string; style: RunStyle }> {
	const pieces = splitRunForMetrics(text, font);
	if (pieces.length <= 1) {
		return [{ text, style }];
	}
	return pieces.map((piece) => {
		const spacing = pieceLetterSpacing(authoredPx, piece.tracking);
		const pieceStyle: RunStyle = { ...style };
		if (spacing === undefined) {
			delete pieceStyle.letterSpacing;
		} else {
			pieceStyle.letterSpacing = spacing;
		}
		return { text: piece.text, style: pieceStyle };
	});
}
