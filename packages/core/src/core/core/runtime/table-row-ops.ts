/**
 * Table row operations: add and remove rows.
 *
 * These pure functions operate on both `PptxTableData` (logical model) and
 * the raw XML object representation, keeping them in sync. Merge span
 * adjustments are handled when rows participate in merged regions.
 *
 * @module runtime/table-row-ops
 */
import type { PptxTableCell, PptxTableData, PptxTableRow, XmlObject } from '../../types';
import {
	DEFAULT_ROW_HEIGHT_PX,
	DEFAULT_ROW_HEIGHT_EMU,
	ensureArray,
	createDefaultCell,
	createDefaultXmlCell,
	getTblFromRawXml,
} from './table-structural-helpers';

// ---------------------------------------------------------------------------
// Add Row
// ---------------------------------------------------------------------------

/**
 * Add a row to a table at the given index.
 *
 * Returns a new `PptxTableData` with the row inserted. If `rawXml` is
 * provided, the corresponding `<a:tr>` element is also inserted into the
 * XML structure (returned as a new deep-cloned object).
 *
 * Merge span handling:
 * - If the insertion index falls inside a vertically merged region, the
 *   `rowSpan` of the anchor cell is incremented and the new row's
 *   corresponding cell is marked `vMerge`.
 *
 * @param tableData - The current logical table model.
 * @param index - The row index at which to insert the new row.
 * @param rawXml - Optional raw XML object to keep in sync.
 * @returns The updated table data and optionally updated raw XML.
 */
export function addTableRow(
	tableData: PptxTableData,
	index: number,
	rawXml?: XmlObject,
): { tableData: PptxTableData; rawXml?: XmlObject } {
	const colCount = tableData.columnWidths.length;
	const clampedIndex = Math.max(0, Math.min(index, tableData.rows.length));

	// Build new cells, accounting for merges that span across the insertion point
	const newCells: PptxTableCell[] = [];
	for (let c = 0; c < colCount; c++) {
		// Check if a vertically merged region from above spans across this insertion point
		let insideMerge = false;
		for (let r = 0; r < clampedIndex; r++) {
			const cell = tableData.rows[r]?.cells[c];
			if (!cell) {
				continue;
			}
			const rs = Math.max(1, cell.rowSpan ?? 1);
			if (rs > 1 && r + rs > clampedIndex && !cell.vMerge && !cell.hMerge) {
				// This anchor cell's merge region spans past the insertion point
				insideMerge = true;
				break;
			}
		}
		if (insideMerge) {
			newCells.push({ text: '', vMerge: true });
		} else {
			newCells.push(createDefaultCell());
		}
	}

	const newRow: PptxTableRow = {
		height: DEFAULT_ROW_HEIGHT_PX,
		cells: newCells,
	};

	// Adjust rowSpan of anchor cells above that span across the insertion point
	const adjustedRows = tableData.rows.map((row, ri) => {
		if (ri >= clampedIndex) {
			return row;
		}
		let needsUpdate = false;
		const updatedCells = row.cells.map((cell) => {
			const rs = Math.max(1, cell.rowSpan ?? 1);
			if (rs > 1 && ri + rs > clampedIndex && !cell.vMerge && !cell.hMerge) {
				needsUpdate = true;
				return { ...cell, rowSpan: rs + 1 };
			}
			return cell;
		});
		return needsUpdate ? { ...row, cells: updatedCells } : row;
	});

	const newRows = [...adjustedRows];
	newRows.splice(clampedIndex, 0, newRow);

	const newTableData: PptxTableData = { ...tableData, rows: newRows };

	// Update rawXml if provided
	let newRawXml: XmlObject | undefined;
	if (rawXml) {
		newRawXml = structuredClone(rawXml) as XmlObject;
		const tbl = getTblFromRawXml(newRawXml);
		if (tbl) {
			const xmlRows = ensureArray(tbl['a:tr'] as XmlObject | XmlObject[]);

			// Build XML cells for the new row
			const xmlNewCells: XmlObject[] = newCells.map((cell) => {
				const xmlCell = createDefaultXmlCell();
				if (cell.vMerge) {
					xmlCell['@_vMerge'] = '1';
				}
				return xmlCell;
			});

			const xmlNewRow: XmlObject = {
				'@_h': String(DEFAULT_ROW_HEIGHT_EMU),
				'a:tc': xmlNewCells.length === 1 ? xmlNewCells[0] : xmlNewCells,
			};

			// Adjust rowSpan in XML rows above
			for (let ri = 0; ri < Math.min(clampedIndex, xmlRows.length); ri++) {
				const xmlCells = ensureArray(xmlRows[ri]['a:tc'] as XmlObject | XmlObject[]);
				for (const xmlCell of xmlCells) {
					const rs = parseInt(String(xmlCell['@_rowSpan'] || '0'), 10);
					if (rs > 1 && ri + rs > clampedIndex) {
						xmlCell['@_rowSpan'] = String(rs + 1);
					}
				}
			}

			xmlRows.splice(clampedIndex, 0, xmlNewRow);
			tbl['a:tr'] = xmlRows.length === 1 ? xmlRows[0] : xmlRows;
		}
	}

	return { tableData: newTableData, rawXml: newRawXml };
}

// ---------------------------------------------------------------------------
// Remove Row
// ---------------------------------------------------------------------------

/**
 * Remove a row from a table at the given index.
 *
 * Returns a new `PptxTableData` with the row removed. If `rawXml` is
 * provided, the corresponding `<a:tr>` element is also removed.
 *
 * Merge span handling:
 * - If the removed row contains anchor cells with `rowSpan > 1`, the
 *   `rowSpan` is decremented and the anchor is moved to the next row.
 * - If the removed row contains `vMerge` continuation cells, the
 *   anchor cell above has its `rowSpan` decremented.
 *
 * @param tableData - The current logical table model.
 * @param index - The row index to remove.
 * @param rawXml - Optional raw XML object to keep in sync.
 * @returns The updated table data and optionally updated raw XML.
 */
export function removeTableRow(
	tableData: PptxTableData,
	index: number,
	rawXml?: XmlObject,
): { tableData: PptxTableData; rawXml?: XmlObject } {
	if (tableData.rows.length <= 1) {
		return { tableData, rawXml };
	}
	if (index < 0 || index >= tableData.rows.length) {
		return { tableData, rawXml };
	}

	const removedRow = tableData.rows[index];
	const adjustedRows = [...tableData.rows];

	// Helper to update a single cell's rowSpan in a row's cells array.
	const updateCellRowSpan = (
		cells: (typeof adjustedRows)[number]['cells'],
		colIdx: number,
		newRowSpan: number,
	) => cells.map((cc, ci) => (ci === colIdx ? { ...cc, rowSpan: newRowSpan } : cc));

	// Handle merge spans
	for (let c = 0; c < removedRow.cells.length; c++) {
		const cell = removedRow.cells[c];

		if (cell.vMerge) {
			// This cell is a continuation of a vertical merge from above.
			// Find the anchor and decrement its rowSpan.
			for (let r = index - 1; r >= 0; r--) {
				const aboveCell = adjustedRows[r]?.cells[c];
				if (!aboveCell) {
					break;
				}
				if (!aboveCell.vMerge) {
					const rs = Math.max(1, aboveCell.rowSpan ?? 1);
					if (rs > 1) {
						adjustedRows[r] = {
							...adjustedRows[r],
							cells: updateCellRowSpan(adjustedRows[r].cells, c, rs - 1),
						};
					}
					break;
				}
			}
		} else {
			const rs = Math.max(1, cell.rowSpan ?? 1);
			if (rs > 1) {
				// This cell is the anchor of a vertical merge.
				// Move the anchor to the next row and decrement rowSpan.
				const nextRowIdx = index + 1;
				if (nextRowIdx < adjustedRows.length) {
					adjustedRows[nextRowIdx] = {
						...adjustedRows[nextRowIdx],
						cells: adjustedRows[nextRowIdx].cells.map((cc, ci) => {
							if (ci !== c) {
								return cc;
							}
							const newRs = rs - 1;
							return {
								...cc,
								text: cell.text, // Move text from anchor to new anchor
								style: cc.style || cell.style,
								rowSpan: newRs > 1 ? newRs : undefined,
								vMerge: undefined, // No longer a continuation
								gridSpan: cell.gridSpan, // Preserve gridSpan
							};
						}),
					};
				}
			}
		}
	}

	// Remove the row
	const newRows = adjustedRows.filter((_, i) => i !== index);

	const newTableData: PptxTableData = { ...tableData, rows: newRows };

	// Update rawXml if provided
	let newRawXml: XmlObject | undefined;
	if (rawXml) {
		newRawXml = structuredClone(rawXml) as XmlObject;
		const tbl = getTblFromRawXml(newRawXml);
		if (tbl) {
			const xmlRows = ensureArray(tbl['a:tr'] as XmlObject | XmlObject[]);

			if (index >= 0 && index < xmlRows.length) {
				const xmlRemovedRow = xmlRows[index];
				const xmlRemovedCells = ensureArray(xmlRemovedRow['a:tc'] as XmlObject | XmlObject[]);

				// Handle merge spans in XML
				for (let c = 0; c < xmlRemovedCells.length; c++) {
					const xmlCell = xmlRemovedCells[c];

					if (xmlCell['@_vMerge'] === '1') {
						// Find anchor above and decrement rowSpan
						for (let r = index - 1; r >= 0; r--) {
							const aboveCells = ensureArray(xmlRows[r]['a:tc'] as XmlObject | XmlObject[]);
							if (c < aboveCells.length) {
								const aboveXmlCell = aboveCells[c];
								if (aboveXmlCell['@_vMerge'] !== '1') {
									const rs = parseInt(String(aboveXmlCell['@_rowSpan'] || '0'), 10);
									if (rs > 2) {
										aboveXmlCell['@_rowSpan'] = String(rs - 1);
									} else {
										delete aboveXmlCell['@_rowSpan'];
									}
									break;
								}
							}
						}
					} else {
						const rs = parseInt(String(xmlCell['@_rowSpan'] || '0'), 10);
						if (rs > 1) {
							// Move anchor to next row
							const nextRowIdx = index + 1;
							if (nextRowIdx < xmlRows.length) {
								const nextCells = ensureArray(
									xmlRows[nextRowIdx]['a:tc'] as XmlObject | XmlObject[],
								);
								if (c < nextCells.length) {
									const nextXmlCell = nextCells[c];
									delete nextXmlCell['@_vMerge'];
									if (rs - 1 > 1) {
										nextXmlCell['@_rowSpan'] = String(rs - 1);
									} else {
										delete nextXmlCell['@_rowSpan'];
									}
									// Preserve gridSpan from original anchor
									if (xmlCell['@_gridSpan']) {
										nextXmlCell['@_gridSpan'] = xmlCell['@_gridSpan'];
									}
									// Copy text body from anchor to new anchor
									if (xmlCell['a:txBody']) {
										nextXmlCell['a:txBody'] = xmlCell['a:txBody'];
									}
								}
							}
						}
					}
				}

				xmlRows.splice(index, 1);
				tbl['a:tr'] = xmlRows.length === 1 ? xmlRows[0] : xmlRows;
			}
		}
	}

	return { tableData: newTableData, rawXml: newRawXml };
}
