/**
 * The line height SmartArt text is laid out with, per font.
 *
 * Every cached SmartArt paragraph carries `a:lnSpc 90%`, and PowerPoint
 * applies that 90% to the font's own line height (ascent + descent), not to
 * the 1.2em a plain text box's single spacing uses: COM
 * `TextRange.BoundHeight` on the gallery fixtures' SmartArt shapes reads
 * 1.099-1.100 x size per line at 19, 20, 26, 36 and 43pt ("Basic Process",
 * "Basic Chevron Process", "Tab List", "Basic Block List", "Lined List"),
 * i.e. `0.9 x 1.2207em` for Aptos, where a text box with the same 90%
 * spacing reads `0.9 x 1.2 = 1.08` (the advance table's `lineHeightRatio`).
 *
 * Only fonts measured this way are listed; any other font keeps its table's
 * own `lineHeightRatio`.
 */

import { FONT_ADVANCE_TABLES } from './font-advance-widths.generated';
import type { FontAdvanceTable } from './font-advance-widths.generated';

const SMARTART_LINE_EM_BY_FONT: Readonly<Record<string, number>> = {
	Aptos: 1.2207,
};

const byTable = new Map<FontAdvanceTable, number>();
for (const [font, em] of Object.entries(SMARTART_LINE_EM_BY_FONT)) {
	const table = FONT_ADVANCE_TABLES[font];
	if (table) {
		byTable.set(table, em);
	}
}

/**
 * A laid-out text block is taller than its lines by a fixed 0.00695em of the
 * first line's size: COM `TextRange.BoundHeight` of Aptos at 10, 20, 37 and
 * 100pt reads `lines x pitch + 0.00695 x size` for one, two and four lines
 * alike (100pt: 108.695, 216.695, 432.695). Across the gallery corpus it is
 * what separates PowerPoint's chosen size from the next point up in 11 more
 * `equ` groups whose one-point-larger fit would otherwise clear by under
 * 0.3pt, with no cached size failing to fit because of it.
 */
export const SMARTART_TEXT_BLOCK_EXTRA_EM = 0.00695;

/** SmartArt line height (em, before the 90% line spacing) for text measured with `table`. */
export function smartArtLineEm(table: FontAdvanceTable): number {
	return byTable.get(table) ?? table.lineHeightRatio;
}
