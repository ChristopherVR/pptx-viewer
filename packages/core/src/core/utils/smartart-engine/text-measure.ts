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

/**
 * The text one rendered node shows, as PowerPoint lays it out. Paragraph
 * levels follow the `tx` algorithm's parameters (ECMA-376 21.4.2.x):
 * `stBulletLvl` is the first (1-based) level drawn as a bullet, default 2,
 * `0` meaning none; an anchored node's own paragraph is level 1 and every
 * folded descendant level 2, a descendant-only box's paragraphs are all
 * level 1. `lnSpAfParP`/`lnSpAfChP` are the percent spacing after a plain
 * and a bullet paragraph (defaults 35 and 15). Cached corpus: "Basic Block
 * List" (defaults: bullets at 0.78x after a 35% gap), "Vertical Bullet
 * List"'s `childText` (`stBulletLvl=1`, `lnSpAfChP=20`: every paragraph a
 * bullet), "Descending Block List"'s `childText` (default: level-1 plain
 * paragraphs, no indent), "Vertical Action List" (`stBulletLvl=0`).
 */
export interface NodeText {
	/** The node's own (level 1) paragraph, when its `presOf` includes the point itself. */
	own?: string;
	descendants: string[];
	/** `tx` `stBulletLvl` (default 2; 0 = no bullets). */
	bulletLevel?: number;
	/** Percent `spcAft` after a plain / a bullet paragraph. */
	spaceAfterParent?: number;
	spaceAfterChild?: number;
	/**
	 * `secFontSz` as a multiple of `primFontSz`: 0.78 by default (cached
	 * corpus, 54 of 56 folded pairs), 1 where the node declares
	 * `primFontSz refType="secFontSz"` and is sized by `secFontSz` itself.
	 */
	secondaryScale?: number;
}

const DEFAULT_BULLET_LEVEL = 2;
const DEFAULT_SPACE_AFTER_PARENT = 35;
const DEFAULT_SPACE_AFTER_CHILD = 15;

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

/**
 * Bullet paragraphs and every folded descendant render at the node's
 * `secFontSz`, plain level-1 paragraphs at its `primFontSz`: "Gear"'s child
 * box (`stBulletLvl=1`, equalised with the gear at 17pt) draws its bullets
 * at 13pt, "Circle Arrow Process"'s bulleted children 18pt under a 23pt cap,
 * while "Descending Block List"'s unbulleted child text stays at 33pt.
 */
export function paragraphSizesPt(
	text: NodeText,
	sizePt: number,
): { first: number; secondary: number } {
	const scale = text.secondaryScale ?? DESCENDANT_FONT_SCALE;
	const secondary = Math.max(1, Math.round(sizePt * scale));
	const bulletLevel = text.bulletLevel ?? DEFAULT_BULLET_LEVEL;
	const firstIsBullet = text.own === undefined && bulletLevel > 0 && bulletLevel <= 1;
	return { first: firstIsBullet ? secondary : sizePt, secondary };
}

function paragraphsAt(text: NodeText, sizePt: number): Paragraph[] {
	const bulletLevel = text.bulletLevel ?? DEFAULT_BULLET_LEVEL;
	const afterParent = (text.spaceAfterParent ?? DEFAULT_SPACE_AFTER_PARENT) / 100;
	const afterChild = (text.spaceAfterChild ?? DEFAULT_SPACE_AFTER_CHILD) / 100;
	const { secondary } = paragraphSizesPt(text, sizePt);
	const paragraph = (value: string, level: number): Paragraph => {
		const bullet = bulletLevel > 0 && level >= bulletLevel;
		const size = bullet || level >= 2 ? secondary : sizePt;
		return {
			text: value,
			size,
			indent: bullet ? descendantIndentPt(size) : 0,
			spcAft: bullet ? afterChild : afterParent,
		};
	};
	if (text.own === undefined) {
		return text.descendants.map((d) => paragraph(d, 1));
	}
	return [paragraph(text.own, 1), ...text.descendants.map((d) => paragraph(d, 2))];
}

/**
 * The height (points) `text` takes at `sizePt` wrapped to `availW` points,
 * or `undefined` when a word is wider than the line (no wrap can fit it).
 */
export function paragraphsHeight(
	text: NodeText,
	sizePt: number,
	availW: number,
	metrics: TextMetrics,
): number | undefined {
	const { table, lineEm } = metrics;
	const paragraphs = paragraphsAt(text, sizePt);
	let height = 0;
	for (const [i, p] of paragraphs.entries()) {
		const widthPx = Math.max(1, availW - p.indent) * PX_PER_PT;
		const sizePx = p.size * PX_PER_PT;
		if (wrappedWidestLineWidth(p.text, widthPx, sizePx, table) > widthPx) {
			return undefined;
		}
		const line = p.size * lineEm;
		height +=
			wrappedLineCount(p.text, widthPx, sizePx, table) * line * SMARTART_LINE_SPACING_FACTOR;
		if (i < paragraphs.length - 1) {
			height += p.spcAft * line;
		}
	}
	return height + SMARTART_TEXT_BLOCK_EXTRA_EM * sizePt;
}

/** Whether `text` at `sizePt` fits `availW` x `availH` points (net of margins). */
export function paragraphsFit(
	text: NodeText,
	sizePt: number,
	availW: number,
	availH: number,
	metrics: TextMetrics,
): boolean {
	const height = paragraphsHeight(text, sizePt, availW, metrics);
	return height !== undefined && height <= availH + 1e-6;
}
