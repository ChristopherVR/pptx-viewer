/**
 * Rebuild table XML from `PptxTableData`.
 *
 * Used by the save pipeline when the number of rows or columns has changed,
 * to ensure the XML structure matches the current logical table model.
 *
 * @module runtime/table-xml-rebuild
 */
import type { PptxTableData, XmlObject } from '../../types';
import { DEFAULT_ROW_HEIGHT_EMU, createDefaultXmlCell } from './table-structural-helpers';

// ---------------------------------------------------------------------------
// Rebuild table XML
// ---------------------------------------------------------------------------

/**
 * Rebuild the `<a:tblGrid>` and `<a:tr>` elements of a table XML object
 * to match the current `PptxTableData`. This is used by the save pipeline
 * when the number of rows or columns has changed.
 *
 * The method preserves `<a:tblPr>` and existing cell XML where possible.
 *
 * @param tbl - The `<a:tbl>` XML object to rebuild.
 * @param tableData - The current logical table model to match.
 * @param emuPerPx - EMU-to-pixel conversion factor.
 * @param ensureArrayFn - A function that normalises a value into an array.
 */
export function rebuildTableXmlFromData(
	tbl: XmlObject,
	tableData: PptxTableData,
	emuPerPx: number,
	ensureArrayFn: (value: unknown) => unknown[],
): void {
	const existingXmlRows = ensureArrayFn(tbl['a:tr']) as XmlObject[];
	const existingGridCols = ensureArrayFn(
		(tbl['a:tblGrid'] as XmlObject | undefined)?.['a:gridCol'],
	) as XmlObject[];

	// Compute total width from existing grid columns (fallback: 9144000 EMU = 960px)
	const totalWidthEmu =
		existingGridCols.reduce((sum, col) => {
			return sum + (parseInt(String(col?.['@_w'] || '0'), 10) || 0);
		}, 0) || 9144000;

	// -- Rebuild a:tblGrid --
	const newGridCols: XmlObject[] = tableData.columnWidths.map((w) => ({
		'@_w': String(Math.round(w * totalWidthEmu)),
	}));
	if (!tbl['a:tblGrid']) {
		tbl['a:tblGrid'] = {};
	}
	(tbl['a:tblGrid'] as XmlObject)['a:gridCol'] =
		newGridCols.length === 1 ? newGridCols[0] : newGridCols;

	// -- Rebuild a:tr --
	const newXmlRows: XmlObject[] = tableData.rows.map((dataRow, ri) => {
		const existingRow = ri < existingXmlRows.length ? existingXmlRows[ri] : undefined;
		const existingCells = existingRow ? (ensureArrayFn(existingRow['a:tc']) as XmlObject[]) : [];

		const heightEmu = dataRow.height
			? Math.round(dataRow.height * emuPerPx)
			: existingRow?.['@_h']
				? parseInt(String(existingRow['@_h']), 10)
				: DEFAULT_ROW_HEIGHT_EMU;

		const newXmlCells: XmlObject[] = dataRow.cells.map((cell, ci) => {
			// Try to reuse existing cell XML
			let xmlCell: XmlObject;
			if (ci < existingCells.length) {
				xmlCell = structuredClone(existingCells[ci]) as XmlObject;
			} else {
				xmlCell = createDefaultXmlCell();
			}

			// Update merge attributes
			if (cell.gridSpan !== undefined && cell.gridSpan > 1) {
				xmlCell['@_gridSpan'] = String(cell.gridSpan);
			} else {
				delete xmlCell['@_gridSpan'];
			}
			if (cell.rowSpan !== undefined && cell.rowSpan > 1) {
				xmlCell['@_rowSpan'] = String(cell.rowSpan);
			} else {
				delete xmlCell['@_rowSpan'];
			}
			if (cell.hMerge) {
				xmlCell['@_hMerge'] = '1';
			} else {
				delete xmlCell['@_hMerge'];
			}
			if (cell.vMerge) {
				xmlCell['@_vMerge'] = '1';
			} else {
				delete xmlCell['@_vMerge'];
			}

			return xmlCell;
		});

		const xmlRow: XmlObject = {
			'@_h': String(heightEmu),
			'a:tc': newXmlCells.length === 1 ? newXmlCells[0] : newXmlCells,
		};

		return xmlRow;
	});

	tbl['a:tr'] = newXmlRows.length === 1 ? newXmlRows[0] : newXmlRows;
}
