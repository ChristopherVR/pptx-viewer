/**
 * table-style-cell3d.ts - resolve the `a:tcStyle/a:cell3D` bevel a cell
 * inherits from its table style (CT_TableStyleCellStyle, ECMA-376
 * §21.1.3.14), distinct from the already-supported per-cell
 * `a:tcPr/a:cell3D` on {@link PptxTableCellStyle}.
 *
 * Kept in its own module rather than folded into `table-style.ts` (already
 * well over this repo's 300-line file budget) so this addition doesn't grow
 * that file further (issue G5). Mirrors the exact section precedence
 * `getTableCellBandStyle` in `table-style.ts` applies to fills: wholeTbl <
 * band1H < band2H < band1V < band2V < lastCol < firstCol < lastRow < seCell
 * < swCell < firstRow < neCell < nwCell (last-wins).
 *
 * None of PowerPoint's 74 built-in gallery styles use a style-level bevel (0
 * hits in the built-in catalogue), so this only matters for a hand-authored
 * or third-party table style; it degrades gracefully to "no bevel" otherwise.
 */
import type { ParsedTableStyleEntry, PptxTableCell3D, PptxTableData } from 'pptx-viewer-core';

import type { CellBorderPosition } from './table-style-borders';

/**
 * Resolve the highest-precedence `a:tcStyle/a:cell3D` that applies to a cell
 * at `pos`, or `undefined` when no applicable section defines one.
 */
export function resolveTableStyleCell3D(
	entry: ParsedTableStyleEntry | undefined,
	tableData: PptxTableData,
	pos: CellBorderPosition,
): PptxTableCell3D | undefined {
	if (!entry) {
		return undefined;
	}
	const { rowIndex, cellIndex, rowCount, columnCount } = pos;

	let current: PptxTableCell3D | undefined = entry.wholeTblCell3D;

	// Banded rows (skip the header row when present), same window as the fill
	// cascade in getTableCellBandStyle.
	const bandStartRow = tableData.firstRowHeader ? 1 : 0;
	const bandEndRow = tableData.lastRow ? rowCount - 1 : rowCount;
	if (tableData.bandedRows && rowIndex >= bandStartRow && rowIndex < bandEndRow) {
		const bandIndex = rowIndex - bandStartRow;
		const rowCycle = Math.max(tableData.bandRowCycle ?? 1, 1);
		const bandGroup = Math.floor(bandIndex / rowCycle) % 2;
		current = (bandGroup === 0 ? entry.band1HCell3D : entry.band2HCell3D) ?? current;
	}

	// Banded columns.
	if (tableData.bandedColumns) {
		const isFirstCol = tableData.firstCol;
		const isLastCol = tableData.lastCol;
		const colBandIndex = isFirstCol && cellIndex > 0 ? cellIndex - 1 : cellIndex;
		const skipCol = (isFirstCol && cellIndex === 0) || (isLastCol && cellIndex === columnCount - 1);
		if (!skipCol) {
			const colCycle = Math.max(tableData.bandColCycle ?? 1, 1);
			const colBandGroup = Math.floor(colBandIndex / colCycle) % 2;
			current = (colBandGroup === 0 ? entry.band1VCell3D : entry.band2VCell3D) ?? current;
		}
	}

	const atTop = Boolean(tableData.firstRowHeader) && rowIndex === 0;
	const atBottom = Boolean(tableData.lastRow) && rowIndex === rowCount - 1;
	const atLeft = Boolean(tableData.firstCol) && cellIndex === 0;
	const atRight = Boolean(tableData.lastCol) && cellIndex === columnCount - 1;

	if (atRight) {
		current = entry.lastColCell3D ?? current;
	}
	if (atLeft) {
		current = entry.firstColCell3D ?? current;
	}
	if (atBottom) {
		current = entry.lastRowCell3D ?? current;
	}
	if (atBottom && atRight) {
		current = entry.seCellCell3D ?? current;
	}
	if (atBottom && atLeft) {
		current = entry.swCellCell3D ?? current;
	}
	if (atTop) {
		current = entry.firstRowCell3D ?? current;
	}
	if (atTop && atRight) {
		current = entry.neCellCell3D ?? current;
	}
	if (atTop && atLeft) {
		current = entry.nwCellCell3D ?? current;
	}

	return current;
}
