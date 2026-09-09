/**
 * SmartArt DiagramML interpreter - word-wrapped font-size fit, using REAL
 * PowerPoint-measured glyph metrics.
 *
 * A `lin`/`snake` item box is a real multi-line text frame (PowerPoint wraps
 * long labels across several lines rather than shrinking them to fit one
 * line), so sizing it needs an actual word-wrap line count, not a one-line
 * assumption. This greedily word-wraps `text` at a candidate font size using
 * per-glyph advance widths from `font-advance-widths.generated.ts` (measured
 * from real PowerPoint via `scripts/make-font-advance-table.ps1`, not a flat
 * char-width guess), counts the lines it needs, and binary-searches for the
 * largest size (bounded by `[floor, ceiling]`) whose wrapped line count still
 * fits `maxHeight` at that font's own measured line-height ratio.
 */

import { DEFAULT_FONT_ADVANCE_TABLE } from './font-advance-widths.generated';
import type { FontAdvanceTable } from './font-advance-widths.generated';

const BINARY_SEARCH_ITERATIONS = 20;

/**
 * PowerPoint's own baked-in SmartArt paragraph line spacing: every gallery
 * fixture's cached `dsp:txBody` carries `<a:lnSpc><a:spcPct val="90000"/>`
 * (90%) - confirmed universal across a dozen fixtures spanning list/process/
 * pyramid/cycle/hierarchy families (`basic-block-list`, `basic-process`,
 * `vertical-bullet-list`, `text-card-short-line`, `vertical-action-list`,
 * `basic-chevron-process`, `segmented-pyramid`, `pyramid-list`,
 * `basic-timeline`), never anything else. COM-verified directly (a real
 * 3-line "Node Two has a longer label" Aptos 48pt run,
 * `TextRange.ParagraphFormat.SpaceWithin`/`LineRuleWithin`): content height
 * goes from 174.56pt (default 100% spacing) to 157.45pt at `SpaceWithin=0.9`
 * - a ratio of 0.902, i.e. this constant scales the WHOLE multi-line block,
 * not just the gaps between lines. See `smartart-layout-item-font-size.test.ts`/
 * `smartart-text-wrap-fit.test.ts` for the exact fixtures and cached sizes
 * this is pinned against; the numbers drift as the advance tables and other
 * fitting terms are corrected, so are not repeated here.
 *
 * Exported (not just a private default) because a caller solving font-fit
 * against an item's own SELF-SCOPED `h`/`w` aspect as a stand-in "natural"
 * height (`smartart-layout-item-font-size.ts`'s `resolveItemSelfAspect` -
 * that box is not the arranger's real declared height, only an approximation
 * of it) measures BEST at the RAW line-height ratio with no further
 * reduction: `basic-process--flat3.pptx`, whose item declares exactly such a
 * self-scoped aspect, converges to its cached 19pt exactly without this
 * factor, and OVERSHOOTS to 20pt with it (this factor's own relief already
 * approximates room the aspect estimate does not otherwise account for).
 */
export const SMARTART_LINE_SPACING_FACTOR = 0.9;

/**
 * PowerPoint lays text out with GDI-compatible (hinted) metrics: every glyph
 * advance is snapped to a whole device pixel at 576 DPI, i.e. to 1/8 point,
 * i.e. to 1/6 of a CSS px (see `packages/shared/src/render/text-metric-
 * tracking.ts`'s `ADVANCE_STEPS_PER_PX`, proved against real PowerPoint COM
 * `TextRange.BoundWidth` measurements for issue #131/#149: summing
 * `round(advance * 6) / 6` per glyph reproduced every measured line to under
 * 0.001px). `smartart-text-wrap-fit.ts` cannot import that module (`core`
 * does not depend on `shared`), so the same PROVEN constant is duplicated
 * here rather than re-derived.
 *
 * Snapping each glyph's advance BEFORE summing (not the line's total width
 * afterwards) is the general, proven-correct rule; applying it here moves
 * `picture-accent-list--hier5.pptx` (smartart-gallery-ground-truth.test.ts)
 * measurably closer to its cached size (61.3px -> 60.0px against a 37.3px
 * target) with zero regressions across the 134-fixture `lin`/`snake` gallery
 * subset. It is NOT, on its own, what separates
 * `basic-block-list--flat3.pptx`/`--hier8.pptx`'s still-unresolved ~1-4pt
 * residual from `--hier5.pptx`'s exact match - measured: applying this snap
 * changes neither fixture's result at all, so whatever explains that specific
 * residual is a separate, still-open discrepancy (this codebase's greedy
 * word-wrap approximating, rather than reproducing, PowerPoint's real
 * text-shaping engine).
 */
const ADVANCE_STEPS_PER_PX = 6;

/** `text`'s rendered width at `fontSize` (same unit as `table`'s advances were measured in per-em), with each glyph's advance snapped to PowerPoint's own 1/6-CSS-px hinting grid. */
export function measureTextWidth(text: string, fontSize: number, table: FontAdvanceTable): number {
	let widthPx = 0;
	for (const ch of text) {
		const code = ch.codePointAt(0) ?? 0;
		const unitsPerEm = table.advances[code] ?? table.averageAdvance;
		const rawPx = (unitsPerEm / 1000) * fontSize;
		widthPx += Math.round(rawPx * ADVANCE_STEPS_PER_PX) / ADVANCE_STEPS_PER_PX;
	}
	return widthPx;
}

/**
 * Greedy word-wrap line count for `text` at `fontSize`/`maxWidth`, honouring
 * explicit `\n` breaks. Exported (beyond the module's own `fitWrappedFontSize`
 * use) so a diagnostic script can query the SAME production wrap logic the
 * fitter itself uses, rather than a hand-rolled reimplementation that could
 * silently diverge from it.
 */
export function wrappedLineCount(
	text: string,
	maxWidth: number,
	fontSize: number,
	table: FontAdvanceTable,
): number {
	if (maxWidth <= 0) {
		return Number.POSITIVE_INFINITY;
	}
	const spaceWidth = measureTextWidth(' ', fontSize, table);
	let lines = 0;
	for (const paragraph of text.split('\n')) {
		const words = paragraph.split(/\s+/u).filter((word) => word.length > 0);
		if (words.length === 0) {
			lines += 1;
			continue;
		}
		let lineWidth = 0;
		let paragraphLines = 1;
		for (const word of words) {
			const wordWidth = measureTextWidth(word, fontSize, table);
			const extended = lineWidth === 0 ? wordWidth : lineWidth + spaceWidth + wordWidth;
			if (extended > maxWidth && lineWidth > 0) {
				paragraphLines += 1;
				lineWidth = wordWidth;
			} else {
				lineWidth = extended;
			}
		}
		lines += paragraphLines;
	}
	return Math.max(1, lines);
}

/** Whether wrapped `text` fits `maxHeight` at font `size` within `maxWidth`. */
function fitsAt(
	text: string,
	maxWidth: number,
	maxHeight: number,
	size: number,
	table: FontAdvanceTable,
	lineSpacingFactor: number,
): boolean {
	return (
		wrappedLineCount(text, maxWidth, size, table) *
			size *
			table.lineHeightRatio *
			lineSpacingFactor <=
		maxHeight
	);
}

/**
 * Largest font size in `[floor, ceiling]` whose greedy word-wrap of `text`,
 * using `table`'s REAL per-glyph advances and line-height ratio, fits within
 * `[maxWidth, maxHeight]`. Returns `floor` when even the floor size
 * overflows (the best available compromise), and `ceiling` when the ceiling
 * size already fits without any shrinking. `maxWidth`/`maxHeight`/`ceiling`/
 * `floor` must all share the SAME unit as `table` was measured in (this
 * interpreter uses pixels throughout; see `smartart-layout-item-font-size.ts`
 * for the points-to-pixels conversion at the call site).
 *
 * @param lineSpacingFactor - PowerPoint's own baked-in SmartArt line spacing
 *   (see `SMARTART_LINE_SPACING_FACTOR`'s doc comment for why a caller using
 *   a self-scoped-aspect "natural height" estimate should pass `1` instead).
 */
export function fitWrappedFontSize(
	text: string,
	maxWidth: number,
	maxHeight: number,
	ceiling: number,
	floor: number,
	table: FontAdvanceTable = DEFAULT_FONT_ADVANCE_TABLE,
	lineSpacingFactor: number = SMARTART_LINE_SPACING_FACTOR,
): number {
	if (text.trim().length === 0 || maxWidth <= 0 || maxHeight <= 0) {
		return ceiling;
	}
	if (fitsAt(text, maxWidth, maxHeight, ceiling, table, lineSpacingFactor)) {
		return ceiling;
	}
	if (!fitsAt(text, maxWidth, maxHeight, floor, table, lineSpacingFactor)) {
		return floor;
	}
	let lo = floor;
	let hi = ceiling;
	for (let i = 0; i < BINARY_SEARCH_ITERATIONS; i++) {
		const mid = (lo + hi) / 2;
		if (fitsAt(text, maxWidth, maxHeight, mid, table, lineSpacingFactor)) {
			lo = mid;
		} else {
			hi = mid;
		}
	}
	return lo;
}
