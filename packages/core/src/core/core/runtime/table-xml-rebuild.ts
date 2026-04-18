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

/**
 * Office 2014+ extension URI used to attach a stable per-column identifier
 * (`a16:colId`) to each `<a:gridCol>`. PowerPoint's "Insert > Table" UI
 * always emits this so later edits (column reordering, track-changes)
 * can identify columns across save cycles. Dropping it doesn't affect
 * rendering but leaves the table visibly different from Office output.
 */
const GRID_COL_ID_EXT_URI = '{9D8B030D-6E8A-4147-A177-3AD203B41FA5}';
const A16_NAMESPACE = 'http://schemas.microsoft.com/office/drawing/2014/main';

function randomColumnId(): string {
	// PowerPoint emits unsigned-32-bit integers. Values only need to be
	// unique within a single <a:tblGrid>; uniqueness across tables / files
	// isn't required.
	return String(Math.floor(Math.random() * 0xffffffff));
}

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
	// Preserve any existing <a:extLst>/<a16:colId> entries from the prior
	// XML so round-tripped tables keep their stable column identities; mint
	// a fresh random id for newly added columns, matching what PowerPoint's
	// "Insert > Table" UI emits.
	const existingColIds: string[] = existingGridCols.map((col) => {
		const extList = col?.['a:extLst'] as XmlObject | undefined;
		const exts = Array.isArray(extList?.['a:ext'])
			? (extList['a:ext'] as XmlObject[])
			: extList?.['a:ext']
				? [extList['a:ext'] as XmlObject]
				: [];
		for (const ext of exts) {
			if (ext?.['@_uri'] === GRID_COL_ID_EXT_URI) {
				const colId = ext['a16:colId'] as XmlObject | undefined;
				const val = colId?.['@_val'];
				if (typeof val === 'string' && val.length > 0) {
					return val;
				}
			}
		}
		return '';
	});
	const newGridCols: XmlObject[] = tableData.columnWidths.map((w, i) => ({
		'@_w': String(Math.round(w * totalWidthEmu)),
		'a:extLst': {
			'a:ext': {
				'@_uri': GRID_COL_ID_EXT_URI,
				'a16:colId': {
					'@_xmlns:a16': A16_NAMESPACE,
					'@_val': existingColIds[i] || randomColumnId(),
				},
			},
		},
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
