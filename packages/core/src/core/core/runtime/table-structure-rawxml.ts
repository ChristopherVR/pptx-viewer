import { EMU_PER_PX } from '../../constants';
import type { PptxElement, PptxTableData, XmlObject } from '../../types';
import { serializeCellMergeAttributes } from './save-table-merge-helpers';
import { DEFAULT_ROW_HEIGHT_EMU, ensureArray, getTblFromRawXml } from './table-structural-helpers';
import { applyTableStructureEditXml } from './table-structure-edit-xml';
import type { TableStructureEdit } from './table-structure-edit-xml';

export type { TableStructureEdit } from './table-structure-edit-xml';

// ── Structural XML synchronisation ────────────────────────────────────────

/** Create a default XML cell element (<a:tc>) for structural rebuilds. */
function createDefaultRebuildXmlCell(): XmlObject {
	return {
		'a:txBody': {
			'a:bodyPr': {},
			'a:lstStyle': {},
			'a:p': {
				'a:endParaRPr': { '@_lang': 'en-US' },
			},
		},
		'a:tcPr': {},
	};
}

/**
 * Deep-clone an element's rawXml and rebuild the table XML structure to match
 * the given `PptxTableData`. This handles adding/removing rows and columns
 * by rebuilding `<a:tblGrid>` and `<a:tr>` elements.
 *
 * Pass the resolved `edit` position for an insert/delete command so surviving
 * rich cells and opaque row/grid properties move with their logical cells.
 * Without that provenance, retain the legacy destination-index rebuild for
 * arbitrary model replacement; it cannot infer which source cells survived.
 *
 * Returns the new rawXml object, or `undefined` if the element doesn't contain
 * an XML-based table.
 */
export function rebuildTableStructureInRawXml(
	element: PptxElement,
	tableData: PptxTableData,
	edit?: TableStructureEdit,
): XmlObject | undefined {
	if (!element.rawXml) {
		return undefined;
	}

	const newRawXml = structuredClone(element.rawXml) as XmlObject;

	const table = getTblFromRawXml(newRawXml);
	if (!table) {
		return undefined;
	}

	// ── Compute total table width from existing grid ──
	const existingGridCols = ensureArray(
		(table['a:tblGrid'] as XmlObject | undefined)?.['a:gridCol'] as
			| XmlObject
			| XmlObject[]
			| undefined,
	);
	const totalWidthEmu =
		existingGridCols.reduce((sum, col) => {
			return sum + (parseInt(String(col?.['@_w'] || '0'), 10) || 0);
		}, 0) || 9144000; // fallback: ~960px

	const appliedEdit = edit
		? applyTableStructureEditXml(
				table,
				element.type === 'table' ? element.tableData : undefined,
				tableData,
				edit,
			)
		: false;
	const alignedGridCols = ensureArray(
		(table['a:tblGrid'] as XmlObject | undefined)?.['a:gridCol'] as
			| XmlObject
			| XmlObject[]
			| undefined,
	);

	// ── Rebuild a:tblGrid ──
	const newGridCols: XmlObject[] = tableData.columnWidths.map((w, index) => ({
		...(appliedEdit ? alignedGridCols[index] : {}),
		'@_w': String(Math.round(w * totalWidthEmu)),
	}));
	if (!table['a:tblGrid']) {
		table['a:tblGrid'] = {};
	}
	(table['a:tblGrid'] as XmlObject)['a:gridCol'] =
		newGridCols.length === 1 ? newGridCols[0] : newGridCols;

	// ── Rebuild a:tr ──
	const existingXmlRows = ensureArray(table['a:tr'] as XmlObject | XmlObject[] | undefined);

	const newXmlRows: XmlObject[] = tableData.rows.map((dataRow, ri) => {
		const existingRow = ri < existingXmlRows.length ? existingXmlRows[ri] : undefined;
		const existingCells = existingRow
			? ensureArray(existingRow['a:tc'] as XmlObject | XmlObject[] | undefined)
			: [];

		const heightEmu = dataRow.height
			? Math.round(dataRow.height * EMU_PER_PX)
			: existingRow?.['@_h']
				? parseInt(String(existingRow['@_h']), 10)
				: DEFAULT_ROW_HEIGHT_EMU;

		const newXmlCells: XmlObject[] = dataRow.cells.map((cell, ci) => {
			// Try to reuse existing cell XML for preserved cells
			let xmlCell: XmlObject;
			if (ci < existingCells.length) {
				xmlCell = existingCells[ci];
			} else {
				xmlCell = createDefaultRebuildXmlCell();
			}

			serializeCellMergeAttributes(xmlCell, cell);

			return xmlCell;
		});

		return {
			...(appliedEdit ? existingRow : {}),
			'@_h': String(heightEmu),
			'a:tc': newXmlCells.length === 1 ? newXmlCells[0] : newXmlCells,
		} as XmlObject;
	});

	table['a:tr'] = newXmlRows.length === 1 ? newXmlRows[0] : newXmlRows;

	return newRawXml;
}
