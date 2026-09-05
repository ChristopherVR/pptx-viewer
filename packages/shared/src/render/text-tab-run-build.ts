/**
 * CSS-ready tab layout for one run's text, built on the pure positioning maths
 * in `text-tab-layout.ts`.
 *
 * `buildRunTabLines` is the "pure decision function" every binding maps
 * mechanically onto its own template: it splits a run's text on `\n`, lays out
 * each line's `\t`-separated pieces against the paragraph's tab stops, and
 * returns, per piece, CSS a binding spreads verbatim onto a nested span (plus
 * a ready-filled leader string for the gap before it). A binding renders
 * nothing but `pieces.map(...)`; the alignment/leader decision itself never
 * has to be reimplemented per framework.
 */

import { splitWordsForUnderline } from './text-decoration';
import { resolveMetricTrackingPx, resolveTrackedTextWidth } from './text-metric-tracking';
import { stripUnderlineDecoration } from './text-run-spacing';
import type { RunStyle } from './text-run-style';
import type { TabRenderContext } from './text-tab-layout';
import { computeTabbedLayout, fillLeaderWithMeasure, measureTextWidth } from './text-tab-layout';

/** One tabbed-line piece, ready to spread onto a binding's own span element. */
export interface TabbedRunPiece {
	text: string;
	/**
	 * CSS for the span that wraps `text`: inline-block layout, this run's own
	 * decoration repeated, and this piece's own PowerPoint advance-width
	 * correction as `letter-spacing` (see `buildTabbedLine`). The piece is
	 * nested inside the run's own span, and neither property inherits the way a
	 * caller would want: `text-decoration-*` does not inherit into a nested
	 * element at all (an ancestor's underline is drawn *through* its
	 * descendants, but each descendant still computes `none` of its own), so a
	 * caller passes the run's decoration subset (`nestedTextDecorationStyle`) to
	 * have it repeated here; `letter-spacing` DOES inherit, which is exactly why
	 * this piece sets it explicitly rather than only when non-zero - the run's
	 * container span carries its own (wrong, whole-text) correction that would
	 * otherwise leak in.
	 */
	style: RunStyle;
	/** CSS for the leader-fill span preceding this piece, or `undefined` when there is no gap to fill. */
	leaderStyle?: RunStyle;
	/** Leader glyphs sized to fill `leaderStyle`'s width. Present only alongside `leaderStyle`. */
	leaderText?: string;
	/**
	 * `a:rPr/@u="words"` per-word/gap sub-pieces of THIS tab piece's own text
	 * (see `splitWordsForUnderline`), present only when the run's underline is
	 * `words`. A tab-separated piece is otherwise rendered as a single span
	 * (`text` + `style`), which underlines it continuously - correct for a
	 * one-word piece, but wrong for a piece like `"Hello World"` between two tab
	 * stops, which needs a gap under the space. A binding renders one SIBLING
	 * span per entry IN PLACE OF the piece's single `text` span: each entry's
	 * `style` is the piece's own `style` (the same inline-block layout and
	 * advance-width correction, so the line measures exactly as before), with
	 * the underline stripped on a gap entry. They must be siblings, not spans
	 * nested inside the piece span: an ancestor's underline is drawn through
	 * every inline descendant, so a nested gap could not lose it. `text`/`style`
	 * stay the continuous-underline fallback for a binding that does not
	 * render this field.
	 */
	words?: Array<{ text: string; style: RunStyle }>;
}

/** One `\n`-split line of a run's tabbed text. */
export interface TabbedLineRun {
	pieces: TabbedRunPiece[];
}

/** The leader-fill span's CSS: an opaque box the glyph string is clipped to. */
function buildLeaderStyle(widthPx: number): RunStyle {
	return {
		display: 'inline-block',
		width: `${widthPx}px`,
		overflow: 'hidden',
		whiteSpace: 'nowrap',
		textAlign: 'right',
		verticalAlign: 'baseline',
	};
}

/**
 * Lay out one line (already split on `\n`) into CSS-ready tabbed pieces.
 *
 * `measure` is injectable so callers (and this module's own tests) can supply
 * a deterministic width function instead of a real canvas; production callers
 * of {@link buildRunTabLines} get the real one by default.
 *
 * Each piece's tab-stop position is computed against the width it will
 * actually PAINT at once PowerPoint's advance-width grid correction is applied
 * as `letter-spacing` (`resolveTrackedTextWidth`), not the browser's raw
 * measurement: a tabbed piece is positioned by the leader gap laid out in
 * front of it rather than by absolute CSS, so the layout and the paint have to
 * agree on a width or the next stop drifts. This is what lets a tab-containing
 * run keep the same PowerPoint metric compensation an ordinary run gets
 * (`splitStyledRun` in `text-run-spacing.ts`) without giving up per-stop
 * alignment or leader glyphs.
 */
function buildTabbedLine(
	line: string,
	ctx: TabRenderContext,
	nestedDecoration: RunStyle | undefined,
	measure: (text: string) => number,
	underlineWords: boolean,
): TabbedRunPiece[] {
	const segments = line.split('\t');
	const trackedMeasure = (text: string) =>
		resolveTrackedTextWidth(text, ctx.runFont, measure(text));
	const rawPieces = computeTabbedLayout(segments, ctx.tabStops, trackedMeasure, ctx.defaultTabSize);
	return rawPieces.map((piece): TabbedRunPiece => {
		const tracking = resolveMetricTrackingPx(piece.text, ctx.runFont);
		const style: RunStyle = {
			...nestedDecoration,
			display: 'inline-block',
			whiteSpace: 'pre',
			// Always set explicitly (never merely omitted): the run's own
			// container span already carries a `letter-spacing` computed over its
			// WHOLE (tab-containing) text (`segmentStyleToCss`), which is not this
			// piece's own correction and would otherwise leak in here through CSS
			// inheritance and fight with (or double up on) the value below.
			letterSpacing: tracking === 0 ? 'normal' : `${tracking}px`,
		};
		const out: TabbedRunPiece = { text: piece.text, style };
		if (piece.leaderWidth > 0) {
			out.leaderStyle = buildLeaderStyle(piece.leaderWidth);
			out.leaderText = piece.leaderChar
				? fillLeaderWithMeasure(piece.leaderChar, piece.leaderWidth, measure)
				: '';
		}
		if (underlineWords) {
			const words = splitWordsForUnderline(piece.text);
			if (words.length > 0) {
				out.words = words.map((word) => ({
					text: word.text,
					style: word.underline ? style : stripUnderlineDecoration(style),
				}));
			}
		}
		return out;
	});
}

/**
 * Build the per-line tabbed layout for a whole run's text.
 *
 * A run is laid out on its own (the tab stop's cursor starts at the run's own
 * left edge): this matches PowerPoint for the common case a tab-containing run
 * is authored as one run per line (a TOC "label \t page" row), which is what
 * every reported case of this bug looked like. A run whose line is split
 * across several *sibling* runs (different styles before/after the tab) is a
 * rarer authoring pattern this does not attempt to solve, matching the scope
 * of the React implementation this was extracted from.
 *
 * @param text             The run's rendered text (post field-substitution).
 * @param ctx              Parsed tab stops + the run's measurement font.
 * @param nestedDecoration This run's decoration subset, repeated onto every
 *                         piece span (see {@link TabbedRunPiece.style}).
 * @param measure           Injectable width function; defaults to a real
 *                          canvas measurement in `ctx.font`.
 * @param underlineWords    `a:rPr/@u="words"`: split each piece's text into
 *                          per-word/gap sub-pieces (see
 *                          {@link TabbedRunPiece.words}) instead of leaving it
 *                          continuously underlined.
 */
export function buildRunTabLines(
	text: string,
	ctx: TabRenderContext,
	nestedDecoration?: RunStyle,
	measure: (text: string) => number = (t) => measureTextWidth(t, ctx.font),
	underlineWords = false,
): TabbedLineRun[] {
	return text.split('\n').map((line) => ({
		pieces: buildTabbedLine(line, ctx, nestedDecoration, measure, underlineWords),
	}));
}
