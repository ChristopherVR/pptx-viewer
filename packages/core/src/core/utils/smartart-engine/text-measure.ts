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
 * - Line pitch: `lnSpc 90%` of the font's own line height, plus a fixed
 *   extra per text block (`smartart-line-pitch.ts` has the COM numbers).
 * - A folded descendant renders at `round(0.78 x size)` in a hanging-indented
 *   column (`descendantIndentPt`); paragraphs are separated by their
 *   `spcAft` (35% after the node's own, 15% after a folded descendant, 20% in
 *   a descendant-only box), never after the last paragraph.
 */

import type { FontAdvanceTable } from '../font-advance-widths.generated';
import { descendantIndentPt } from '../smartart-layout-item-font-tier-fit';
import { SMARTART_TEXT_BLOCK_EXTRA_EM, smartArtLineEm } from '../smartart-line-pitch';
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

/** Metrics for text measured with `table` (see `smartart-line-pitch.ts` for the line height). */
export function textMetricsFor(table: FontAdvanceTable): TextMetrics {
	return { table, lineEm: smartArtLineEm(table) };
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
	height += SMARTART_TEXT_BLOCK_EXTRA_EM * sizePt;
	return height <= availH + 1e-6;
}
