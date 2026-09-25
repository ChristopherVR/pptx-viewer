/**
 * Paragraph measurement for the per-point engine's text fit: does a node's
 * text, at a candidate whole-point size, fit a given width and height?
 *
 * The model, each part measured against the gallery corpus's cached
 * drawings or PowerPoint itself (COM):
 *
 * - Glyph advances come from the COM-measured tables
 *   (`font-advance-widths.generated.ts`), greedy word-wrapped per paragraph
 *   (`smartart-text-wrap-fit.ts`), in CSS pixels so each advance snaps to
 *   PowerPoint's 1/6-px hinting grid.
 * - Line pitch: every cached SmartArt paragraph carries `lnSpc 90%`, applied
 *   to the font's own line height. For Aptos that is 1.2207em (ascent +
 *   descent), so a line advances `0.9 x 1.2207 = 1.0986` x the size: COM
 *   `TextRange.BoundHeight` on the gallery fixtures' SmartArt shapes reads
 *   0.0986-1.100 x size per line at 19, 20, 26, 36 and 43pt ("Basic Chevron
 *   Process", "Basic Process", "Tab List", "Basic Block List", "Lined
 *   List"), not the 1.08 a plain text box's 1.2 ratio would give.
 * - A folded descendant renders at `round(0.78 x size)` in a hanging-indented
 *   column (`descendantIndentPt`); paragraphs are separated by their
 *   `spcAft` (35% after the node's own, 15% after a folded descendant, 20% in
 *   a descendant-only box), never after the last paragraph.
 */

import type { FontAdvanceTable } from '../font-advance-widths.generated';
import { descendantIndentPt } from '../smartart-layout-item-font-tier-fit';
import {
	SMARTART_LINE_SPACING_FACTOR,
	wrappedLineCount,
	wrappedWidestLineWidth,
} from '../smartart-text-wrap-fit';

const PX_PER_PT = 96 / 72;

/** A folded descendant paragraph's size relative to the node's own text (cached corpus: 54/56 pairs). */
export const DESCENDANT_FONT_SCALE = 0.78;

/** `spcAft` (fraction of one line) after the node's own paragraph, a folded descendant, and a descendant-only box's paragraph. */
const OWN_SPC_AFT = 0.35;
const FOLDED_SPC_AFT = 0.15;
const DESCENDANT_ONLY_SPC_AFT = 0.2;

/** Font line heights (em) SmartArt's 90% line spacing applies to, where measured (see module doc). */
const SMARTART_LINE_EM: Readonly<Record<string, number>> = {
	Aptos: 1.2207,
};

/** The text one rendered node shows: its own paragraph (if it presents itself) and any folded descendants. */
export interface NodeText {
	own?: string;
	descendants: string[];
}

/** Font metrics a fit runs against. */
export interface TextMetrics {
	table: FontAdvanceTable;
	/** Line height in em before the 90% SmartArt line spacing. */
	lineEm: number;
}

/** Metrics for `fontName` (the theme minor font), falling back to the advance table's own line ratio. */
export function textMetricsFor(fontName: string | undefined, table: FontAdvanceTable): TextMetrics {
	return { table, lineEm: SMARTART_LINE_EM[fontName ?? ''] ?? table.lineHeightRatio };
}

interface Paragraph {
	text: string;
	size: number;
	indent: number;
	spcAft: number;
}

function paragraphsAt(text: NodeText, sizePt: number): Paragraph[] {
	const out: Paragraph[] = [];
	if (text.own !== undefined) {
		out.push({ text: text.own, size: sizePt, indent: 0, spcAft: OWN_SPC_AFT });
		const secondary = Math.max(1, Math.round(sizePt * DESCENDANT_FONT_SCALE));
		for (const d of text.descendants) {
			out.push({
				text: d,
				size: secondary,
				indent: descendantIndentPt(secondary),
				spcAft: FOLDED_SPC_AFT,
			});
		}
		return out;
	}
	for (const d of text.descendants) {
		out.push({
			text: d,
			size: sizePt,
			indent: descendantIndentPt(sizePt),
			spcAft: DESCENDANT_ONLY_SPC_AFT,
		});
	}
	return out;
}

/** Whether `text` at `sizePt` fits `availW` x `availH` points (net of margins). */
export function paragraphsFit(
	text: NodeText,
	sizePt: number,
	availW: number,
	availH: number,
	metrics: TextMetrics,
): boolean {
	const { table, lineEm } = metrics;
	const paragraphs = paragraphsAt(text, sizePt);
	let height = 0;
	for (const [i, p] of paragraphs.entries()) {
		const widthPx = Math.max(1, availW - p.indent) * PX_PER_PT;
		const sizePx = p.size * PX_PER_PT;
		if (wrappedWidestLineWidth(p.text, widthPx, sizePx, table) > widthPx) {
			return false;
		}
		const line = p.size * lineEm;
		height +=
			wrappedLineCount(p.text, widthPx, sizePx, table) * line * SMARTART_LINE_SPACING_FACTOR;
		if (i < paragraphs.length - 1) {
			height += p.spcAft * line;
		}
	}
	return height <= availH + 1e-6;
}
