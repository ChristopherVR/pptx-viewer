/**
 * Split out of `smartart-layout-item-font-tier.ts` (the file-size budget):
 * the pure per-item fit check `resolveTieredItemFontSize`'s binary search
 * calls at every candidate size - whether a folded item's root paragraph
 * plus its descendant paragraph(s) together fit a given available box, per
 * that module's own doc comment (the joint search, per-level `spcAft`, and
 * the `SMARTART_DESCENDANT_FONT_SCALE` derivation all live there).
 *
 * @module smartart-layout-item-font-tier-fit
 */

import type { FontAdvanceTable } from './font-advance-widths.generated';
import type { TieredFontFitItem } from './smartart-layout-item-font-tier';
import { wrappedLineCount } from './smartart-text-wrap-fit';

const ROOT_SPCAFT_FACTOR = 0.35;
const DESCENDANT_SPCAFT_FACTOR = 0.15;

/** One paragraph's own content-height contribution, including its trailing `spcAft` unless it is the box's last paragraph. */
function paragraphBlockPx(
	lines: number,
	sizePx: number,
	ratio: number,
	lineSpacingFactor: number,
	spcAftFactor: number,
	isLastParagraph: boolean,
): number {
	const content = lines * sizePx * ratio * lineSpacingFactor;
	return isLastParagraph ? content : content + spcAftFactor * sizePx * ratio;
}

/** Whether `item`'s root paragraph at `rootPx` plus its descendants at `descendantPx` together fit `availHeightPx`. */
export function itemFits(
	item: TieredFontFitItem,
	availWidthPx: number,
	availHeightPx: number,
	rootPx: number,
	descendantPx: number,
	table: FontAdvanceTable,
	lineSpacingFactor: number,
): boolean {
	const hasDescendants = item.descendantTexts.length > 0;
	const rootLines = wrappedLineCount(item.rootText, availWidthPx, rootPx, table);
	let totalPx = paragraphBlockPx(
		rootLines,
		rootPx,
		table.lineHeightRatio,
		lineSpacingFactor,
		ROOT_SPCAFT_FACTOR,
		!hasDescendants,
	);
	for (let i = 0; i < item.descendantTexts.length; i++) {
		const isLast = i === item.descendantTexts.length - 1;
		const lines = wrappedLineCount(item.descendantTexts[i], availWidthPx, descendantPx, table);
		totalPx += paragraphBlockPx(
			lines,
			descendantPx,
			table.lineHeightRatio,
			lineSpacingFactor,
			DESCENDANT_SPCAFT_FACTOR,
			isLast,
		);
	}
	return totalPx <= availHeightPx;
}
