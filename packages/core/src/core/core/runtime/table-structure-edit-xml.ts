import type { PptxTableCell, PptxTableData, XmlObject } from '../../types';
import { createDefaultXmlCell, createDefaultXmlRow, ensureArray } from './table-structural-helpers';

/** Absolute source-grid position of a single structural edit. */
export interface TableStructureEdit {
	axis: 'row' | 'column';
	action: 'insert' | 'delete';
	index: number;
}

function cells(row: XmlObject): XmlObject[] {
	return ensureArray(row['a:tc'] as XmlObject | XmlObject[] | undefined);
}

/** Follow the logical operation's anchor promotion, not a guess from cell text. */
function promoteTextBody(
	source: PptxTableCell | undefined,
	next: PptxTableCell | undefined,
	removed: XmlObject | undefined,
	survivor: XmlObject | undefined,
	axis: TableStructureEdit['axis'],
): void {
	const span = axis === 'row' ? 'rowSpan' : 'gridSpan';
	const continuation = axis === 'row' ? 'vMerge' : 'hMerge';
	if (
		!source?.text ||
		!next ||
		!removed ||
		!survivor ||
		source[continuation] ||
		(source[span] ?? 1) <= 1 ||
		next[continuation] ||
		(next[span] ?? 1) !== (source[span] ?? 1) - 1
	) {
		return;
	}
	if (removed['a:txBody'] !== undefined) {
		survivor['a:txBody'] = removed['a:txBody'];
	}
}

/**
 * Splice a caller-owned XML clone before its dimensions/merge flags are synced.
 * The operation supplies provenance: destination indices alone cannot identify
 * surviving cells, especially when multiple cells have identical visible text.
 * Returns false without mutation for a descriptor that does not match the grid.
 */
export function applyTableStructureEditXml(
	table: XmlObject,
	source: PptxTableData | undefined,
	next: PptxTableData,
	edit: TableStructureEdit,
): boolean {
	const rows = ensureArray(table['a:tr'] as XmlObject | XmlObject[] | undefined);
	const grid = table['a:tblGrid'] as XmlObject | undefined;
	const columns = ensureArray(grid?.['a:gridCol'] as XmlObject | XmlObject[] | undefined);
	const { axis, action, index } = edit;
	if ((axis !== 'row' && axis !== 'column') || (action !== 'insert' && action !== 'delete')) {
		return false;
	}
	const count = axis === 'row' ? rows.length : columns.length;
	const delta = action === 'insert' ? 1 : -1;
	if (
		!grid ||
		!Number.isInteger(index) ||
		index < 0 ||
		index > count - (action === 'delete' ? 1 : 0) ||
		(action === 'delete' && count <= 1) ||
		next.rows.length !== rows.length + (axis === 'row' ? delta : 0) ||
		next.columnWidths.length !== columns.length + (axis === 'column' ? delta : 0)
	) {
		return false;
	}

	if (axis === 'row') {
		if (action === 'insert') {
			rows.splice(index, 0, createDefaultXmlRow(columns.length));
		} else {
			const removedCells = cells(rows[index]);
			const nextCells = rows[index + 1] ? cells(rows[index + 1]) : [];
			removedCells.forEach((removed, column) =>
				promoteTextBody(
					source?.rows[index]?.cells[column],
					next.rows[index]?.cells[column],
					removed,
					nextCells[column],
					axis,
				),
			);
			rows.splice(index, 1);
		}
		table['a:tr'] = rows.length === 1 ? rows[0] : rows;
	} else {
		if (action === 'insert') {
			columns.splice(index, 0, { '@_w': '0' });
		} else {
			columns.splice(index, 1);
		}
		grid['a:gridCol'] = columns.length === 1 ? columns[0] : columns;
		rows.forEach((row, rowIndex) => {
			const rowCells = cells(row);
			if (action === 'insert') {
				rowCells.splice(index, 0, createDefaultXmlCell());
			} else {
				promoteTextBody(
					source?.rows[rowIndex]?.cells[index],
					next.rows[rowIndex]?.cells[index],
					rowCells[index],
					rowCells[index + 1],
					axis,
				);
				rowCells.splice(index, 1);
			}
			row['a:tc'] = rowCells.length === 1 ? rowCells[0] : rowCells;
		});
	}
	return true;
}
