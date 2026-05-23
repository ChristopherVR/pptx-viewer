/**
 * Table column operations: add and remove columns.
 *
 * These pure functions operate on both `PptxTableData` (logical model) and
 * the raw XML object representation, keeping them in sync. Merge span
 * adjustments are handled when columns participate in merged regions.
 *
 * @module runtime/table-column-ops
 */
import type { PptxTableCell, PptxTableData, XmlObject } from '../../types';
import {
	ensureArray,
	createDefaultCell,
	createDefaultXmlCell,
	getTblFromRawXml,
} from './table-structural-helpers';

// ---------------------------------------------------------------------------
// Add Column
// ---------------------------------------------------------------------------

/**
 * Add a column to a table at the given index.
 *
 * Returns a new `PptxTableData` with the column inserted and column widths
 * re-normalized. If `rawXml` is provided, a new `<a:gridCol>` is inserted
 * and every `<a:tr>` gains a new `<a:tc>`.
 *
 * Width strategy: split the width of the column at the insertion point.
 * If inserting at the end, split the width of the last column.
 *
 * Merge span handling:
 * - If the insertion index falls inside a horizontally merged region, the
 *   `gridSpan` of the anchor cell is incremented and the new column's
 *   corresponding cell is marked `hMerge`.
 *
 * @param tableData - The current logical table model.
 * @param index - The column index at which to insert the new column.
 * @param rawXml - Optional raw XML object to keep in sync.
 * @returns The updated table data and optionally updated raw XML.
 */
export function addTableColumn(
	tableData: PptxTableData,
	index: number,
	rawXml?: XmlObject,
): { tableData: PptxTableData; rawXml?: XmlObject } {
	const colCount = tableData.columnWidths.length;
	const clampedIndex = Math.max(0, Math.min(index, colCount));

	// Determine new column widths
	const newWidths = [...tableData.columnWidths];
	const splitSourceIdx = clampedIndex < colCount ? clampedIndex : colCount - 1;
	const originalWidth = newWidths[splitSourceIdx] ?? 1 / colCount;
	const halfWidth = originalWidth / 2;
	newWidths[splitSourceIdx] = halfWidth;
	newWidths.splice(clampedIndex, 0, halfWidth);

	// Normalize widths to sum to 1
	const sum = newWidths.reduce((a, b) => a + b, 0);
	const normalizedWidths = sum > 0 ? newWidths.map((w) => w / sum) : newWidths;

	// Insert cells in each row
	const newRows = tableData.rows.map((row, ri) => {
		// Check if this column insertion falls inside a horizontal merge
		let insideMerge = false;
		let insideVerticalMerge = false;
		for (let c = 0; c < clampedIndex && c < row.cells.length; c++) {
			const cell = row.cells[c];
			if (!cell) {
				continue;
			}
			const gs = Math.max(1, cell.gridSpan ?? 1);
			if (gs > 1 && c + gs > clampedIndex && !cell.hMerge) {
				insideMerge = true;
				break;
			}
		}
		// Also check if this row position has a vMerge for the new column position
		// (if the cell at the same column in a row above has rowSpan extending here)
		for (let r = 0; r < ri; r++) {
			const aboveCell = tableData.rows[r]?.cells[clampedIndex];
			if (!aboveCell) {
				continue;
			}
			const rs = Math.max(1, aboveCell.rowSpan ?? 1);
			if (rs > 1 && r + rs > ri && !aboveCell.vMerge && !aboveCell.hMerge) {
				insideVerticalMerge = true;
				break;
			}
		}

		const newCells = [...row.cells];
		let newCell: PptxTableCell;
		if (insideMerge) {
			newCell = { text: '', hMerge: true };
			if (insideVerticalMerge) {
				newCell.vMerge = true;
			}
		} else if (insideVerticalMerge) {
			newCell = { text: '', vMerge: true };
		} else {
			newCell = createDefaultCell();
		}
		newCells.splice(clampedIndex, 0, newCell);
		return { ...row, cells: newCells };
	});

	// Adjust gridSpan of anchor cells that span across the insertion point
	const finalRows = newRows.map((row) => {
		let needsUpdate = false;
		const updatedCells = row.cells.map((cell, ci) => {
			if (ci >= clampedIndex) {
				return cell;
			} // Skip cells at/after insertion
			const gs = Math.max(1, cell.gridSpan ?? 1);
			// Account for the fact that we already inserted a cell, so the original
			// span needs to be checked against the original index
			if (gs > 1 && ci + gs > clampedIndex && !cell.hMerge && !cell.vMerge) {
				needsUpdate = true;
				return { ...cell, gridSpan: gs + 1 };
			}
			return cell;
		});
		return needsUpdate ? { ...row, cells: updatedCells } : row;
	});

	const newTableData: PptxTableData = {
		...tableData,
		rows: finalRows,
		columnWidths: normalizedWidths,
	};

	// Update rawXml if provided
	let newRawXml: XmlObject | undefined;
	if (rawXml) {
		newRawXml = structuredClone(rawXml) as XmlObject;
		const tbl = getTblFromRawXml(newRawXml);
		if (tbl) {
			// Update a:tblGrid
			const tblGrid = tbl['a:tblGrid'] as XmlObject | undefined;
			if (tblGrid) {
				const gridCols = ensureArray(tblGrid['a:gridCol'] as XmlObject | XmlObject[]);
				const sourceIdx = clampedIndex < gridCols.length ? clampedIndex : gridCols.length - 1;
				const sourceWidth = parseInt(String(gridCols[sourceIdx]?.['@_w'] || '0'), 10);
				const halfWidthEmu = Math.round(sourceWidth / 2);
				gridCols[sourceIdx] = {
					'@_w': String(sourceWidth - halfWidthEmu),
				};
				gridCols.splice(clampedIndex, 0, {
					'@_w': String(halfWidthEmu),
				});
				tblGrid['a:gridCol'] = gridCols.length === 1 ? gridCols[0] : gridCols;
			}

			// Update each a:tr
			const xmlRows = ensureArray(tbl['a:tr'] as XmlObject | XmlObject[]);
			for (let ri = 0; ri < xmlRows.length; ri++) {
				const xmlRow = xmlRows[ri];
				const xmlCells = ensureArray(xmlRow['a:tc'] as XmlObject | XmlObject[]);

				const newXmlCell = createDefaultXmlCell();

				// Check if inside a horizontal merge
				let insideMerge = false;
				for (let c = 0; c < clampedIndex && c < xmlCells.length; c++) {
					const xmlCell = xmlCells[c];
					const gs = parseInt(String(xmlCell['@_gridSpan'] || '0'), 10);
					if (gs > 1 && c + gs > clampedIndex && xmlCell['@_hMerge'] !== '1') {
						insideMerge = true;
						// Increment gridSpan
						xmlCell['@_gridSpan'] = String(gs + 1);
						break;
					}
				}

				if (insideMerge) {
					newXmlCell['@_hMerge'] = '1';
				}

				// Check if inside a vertical merge
				for (let r = 0; r < ri; r++) {
					const aboveCells = ensureArray(xmlRows[r]['a:tc'] as XmlObject | XmlObject[]);
					// After the splice the col at clampedIndex is the new one,
					// so we check the cell that used to be at clampedIndex (now at clampedIndex in the already-processed row).
					if (clampedIndex < aboveCells.length) {
						const aboveXmlCell = aboveCells[clampedIndex];
						const rs = parseInt(String(aboveXmlCell['@_rowSpan'] || '0'), 10);
						if (rs > 1 && r + rs > ri && aboveXmlCell['@_vMerge'] !== '1') {
							newXmlCell['@_vMerge'] = '1';
							break;
						}
						if (aboveXmlCell['@_vMerge'] === '1') {
							// Continue walking up
							continue;
						}
					}
				}

				xmlCells.splice(clampedIndex, 0, newXmlCell);
				xmlRow['a:tc'] = xmlCells.length === 1 ? xmlCells[0] : xmlCells;
			}
		}
	}

	return { tableData: newTableData, rawXml: newRawXml };
}

// ---------------------------------------------------------------------------
// Remove Column
// ---------------------------------------------------------------------------

/**
 * Remove a column from a table at the given index.
 *
 * Returns a new `PptxTableData` with the column removed and column widths
 * re-normalized. If `rawXml` is provided, the corresponding `<a:gridCol>`
 * and `<a:tc>` elements are also removed.
 *
 * Merge span handling:
 * - If the removed column is part of a `gridSpan` region, the span is
 *   decremented. If the anchor column is removed, the anchor moves right.
 * - `hMerge` continuation cells for the removed column are cleared.
 *
 * @param tableData - The current logical table model.
 * @param index - The column index to remove.
 * @param rawXml - Optional raw XML object to keep in sync.
 * @returns The updated table data and optionally updated raw XML.
 */
export function removeTableColumn(
	tableData: PptxTableData,
	index: number,
	rawXml?: XmlObject,
): { tableData: PptxTableData; rawXml?: XmlObject } {
	const colCount = tableData.columnWidths.length;
	if (colCount <= 1) {
		return { tableData, rawXml };
	}
	if (index < 0 || index >= colCount) {
		return { tableData, rawXml };
	}

	// Adjust merge spans and remove the column from each row
	const newRows = tableData.rows.map((row) => {
		const adjustedCells = [...row.cells];

		const cell = adjustedCells[index];
		if (cell) {
			if (cell.hMerge) {
				// This cell is a continuation of a horizontal merge.
				// Find the anchor and decrement its gridSpan.
				for (let c = index - 1; c >= 0; c--) {
					const leftCell = adjustedCells[c];
					if (!leftCell) {
						break;
					}
					if (!leftCell.hMerge) {
						const gs = Math.max(1, leftCell.gridSpan ?? 1);
						if (gs > 1) {
							adjustedCells[c] = {
								...leftCell,
								gridSpan: gs - 1 > 1 ? gs - 1 : undefined,
							};
						}
						break;
					}
				}
			} else {
				const gs = Math.max(1, cell.gridSpan ?? 1);
				if (gs > 1) {
					// This is the anchor of a horizontal merge.
					// Move anchor to the next column and decrement gridSpan.
					const nextColIdx = index + 1;
					if (nextColIdx < adjustedCells.length) {
						const nextCell = adjustedCells[nextColIdx];
						adjustedCells[nextColIdx] = {
							...nextCell,
							text: cell.text || nextCell.text,
							style: nextCell.style || cell.style,
							gridSpan: gs - 1 > 1 ? gs - 1 : undefined,
							hMerge: undefined, // No longer a continuation
							rowSpan: cell.rowSpan, // Preserve rowSpan
						};
					}
				}
			}
		}

		return {
			...row,
			cells: adjustedCells.filter((_, i) => i !== index),
		};
	});

	// Remove column width and renormalize
	const newWidths = tableData.columnWidths.filter((_, i) => i !== index);
	const sum = newWidths.reduce((a, b) => a + b, 0);
	const normalizedWidths = sum > 0 ? newWidths.map((w) => w / sum) : newWidths;

	const newTableData: PptxTableData = {
		...tableData,
		rows: newRows,
		columnWidths: normalizedWidths,
	};

	// Update rawXml if provided
	let newRawXml: XmlObject | undefined;
	if (rawXml) {
		newRawXml = structuredClone(rawXml) as XmlObject;
		const tbl = getTblFromRawXml(newRawXml);
		if (tbl) {
			// Remove from a:tblGrid
			const tblGrid = tbl['a:tblGrid'] as XmlObject | undefined;
			if (tblGrid) {
				const gridCols = ensureArray(tblGrid['a:gridCol'] as XmlObject | XmlObject[]);
				if (index < gridCols.length) {
					gridCols.splice(index, 1);
					tblGrid['a:gridCol'] = gridCols.length === 1 ? gridCols[0] : gridCols;
				}
			}

			// Remove from each a:tr
			const xmlRows = ensureArray(tbl['a:tr'] as XmlObject | XmlObject[]);
			for (const xmlRow of xmlRows) {
				const xmlCells = ensureArray(xmlRow['a:tc'] as XmlObject | XmlObject[]);
				if (index < xmlCells.length) {
					const xmlCell = xmlCells[index];

					if (xmlCell['@_hMerge'] === '1') {
						// Find anchor and decrement gridSpan
						for (let c = index - 1; c >= 0; c--) {
							const leftXmlCell = xmlCells[c];
							if (leftXmlCell['@_hMerge'] !== '1') {
								const gs = parseInt(String(leftXmlCell['@_gridSpan'] || '0'), 10);
								if (gs > 2) {
									leftXmlCell['@_gridSpan'] = String(gs - 1);
								} else {
									delete leftXmlCell['@_gridSpan'];
								}
								break;
							}
						}
					} else {
						const gs = parseInt(String(xmlCell['@_gridSpan'] || '0'), 10);
						if (gs > 1) {
							// Move anchor to next column
							const nextColIdx = index + 1;
							if (nextColIdx < xmlCells.length) {
								const nextXmlCell = xmlCells[nextColIdx];
								delete nextXmlCell['@_hMerge'];
								if (gs - 1 > 1) {
									nextXmlCell['@_gridSpan'] = String(gs - 1);
								} else {
									delete nextXmlCell['@_gridSpan'];
								}
								// Preserve rowSpan from original anchor
								if (xmlCell['@_rowSpan']) {
									nextXmlCell['@_rowSpan'] = xmlCell['@_rowSpan'];
								}
								// Copy text body from anchor to new anchor
								if (xmlCell['a:txBody']) {
									nextXmlCell['a:txBody'] = xmlCell['a:txBody'];
								}
							}
						}
					}

					xmlCells.splice(index, 1);
					xmlRow['a:tc'] = xmlCells.length === 1 ? xmlCells[0] : xmlCells;
				}
			}
		}
	}

	return { tableData: newTableData, rawXml: newRawXml };
}
