/**
 * table-cell-css.ts — the ONE place a table `<td>`'s CSS is decided.
 *
 * Every binding used to compose this itself, and the composition is three
 * layers deep, so the copies drifted in two directions at once:
 *
 *  - **React never applied the band layer to programmatic tables.** Its
 *    `table-render-data.tsx` imported `TableStyleContext` as a TYPE only and
 *    called {@link getTableCellBandStyle} nowhere, so a table inserted from the
 *    ribbon or built by the AI panel rendered with no header fill and no row
 *    banding while the other four bindings banded it.
 *  - **Angular never applied the text-colour floor.** Vue, Svelte and Vanilla
 *    each carried their own `if (style.color === undefined)` line; Angular had
 *    none, so an unstyled cell inherited the viewer CHROME's `foreground`
 *    (`#f0efec` from the dark theme preset) and painted near-white text on a
 *    light cell. That colour is the host UI's, not the deck's: PowerPoint
 *    resolves a cell with no explicit run colour through the table style's
 *    `a:tcTxStyle` and ultimately `tx1`, i.e. dark.
 *
 * Both are the same failure: a three-layer cascade written out five times. It
 * is written once here, as a pure decision function returning a neutral
 * {@link TableCellCss}, and each binding only maps that onto its own style
 * binding.
 *
 * Layer order, lowest priority first:
 *   1. `base` — the binding's own inherited text style, when it has one.
 *   2. the table style's band / header / emphasis fill ({@link getTableCellBandStyle}).
 *   3. the cell's own explicit style ({@link cellStyleToCss}).
 *   4. a text-colour floor, applied only when no layer above set one.
 *
 * @module render/table-cell-css
 */
import type { PptxTableCell, PptxTableData } from 'pptx-viewer-core';

import { DEFAULT_TEXT_COLOR } from '../constants';
import type { TableCellCss, TableStyleContext } from './table-style';
import { cellStyleToCss, getTableCellBandStyle } from './table-style';

/** Where a cell sits in its table, which is what the band cascade keys on. */
export interface TableCellPosition {
	rowIndex: number;
	cellIndex: number;
	/** Total rows, needed for the last-row emphasis. */
	rowCount: number;
	/** Total columns, needed for the last-column emphasis. */
	columnCount: number;
}

/**
 * Resolve the full CSS for one table cell.
 *
 * @param tableData - The table's parsed data (banding flags + style id).
 * @param cell - The cell being painted; `undefined` yields the band layer only.
 * @param position - The cell's coordinates and the table's dimensions.
 * @param context - Parsed table styles + the deck's colour / font schemes.
 * @param base - Optional lowest layer, e.g. the binding's inherited text style.
 *   When it already carries a `color`, the text-colour floor is a no-op, so a
 *   binding that resolves its own element text colour keeps it.
 * @returns A framework-neutral camelCased CSS object.
 */
export function tableCellCss(
	tableData: PptxTableData | undefined,
	cell: PptxTableCell | undefined,
	position: TableCellPosition,
	context?: TableStyleContext,
	base?: TableCellCss,
): TableCellCss {
	const band = getTableCellBandStyle(
		tableData,
		position.rowIndex,
		position.cellIndex,
		position.rowCount,
		position.columnCount,
		context,
	);
	const css: TableCellCss = { ...base, ...band, ...cellStyleToCss(cell?.style) };
	// The floor: without it an unstyled cell inherits whatever `color` the host
	// page cascades onto the viewer, which on the dark chrome is near-white and
	// invisible on a light table. Per-run colours still win, because a run is a
	// `<span>` inside this `<td>`.
	if (css.color === undefined) {
		css.color = DEFAULT_TEXT_COLOR;
	}
	return css;
}
