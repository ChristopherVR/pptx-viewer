/**
 * Table structural operations: add/remove rows and columns.
 *
 * These pure functions operate on both `PptxTableData` (logical model) and
 * the raw XML object representation, keeping them in sync.
 *
 * Merge span adjustments are handled when removing rows/columns that
 * participate in merged regions.
 */
import type { PptxTableCell, PptxTableData, PptxTableRow, XmlObject } from '../../types';
import { EMU_PER_PX } from '../../constants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default row height in pixels when none is specified. */
const DEFAULT_ROW_HEIGHT_PX = 40;

/** Default row height in EMU for XML. */
const DEFAULT_ROW_HEIGHT_EMU = DEFAULT_ROW_HEIGHT_PX * EMU_PER_PX;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureArray<T>(value: T | T[] | undefined | null): T[] {
	if (!value) return [];
	return Array.isArray(value) ? value : [value];
}

/** Create a default empty cell for insertion. */
function createDefaultCell(): PptxTableCell {
	return { text: '', style: {} };
}

/** Create a default XML cell element (<a:tc>). */
function createDefaultXmlCell(): XmlObject {
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
 * Create a default XML row element (<a:tr>) with the given number of cells.
 */
function createDefaultXmlRow(colCount: number, heightEmu?: number): XmlObject {
	const cells: XmlObject[] = Array.from({ length: colCount }, () =>
		createDefaultXmlCell(),
	);
	return {
		'@_h': String(heightEmu ?? DEFAULT_ROW_HEIGHT_EMU),
		'a:tc': cells.length === 1 ? cells[0] : cells,
	};
}

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
			if (!cell) continue;
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
		if (ri >= clampedIndex) return row;
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
				const xmlCells = ensureArray(
					xmlRows[ri]['a:tc'] as XmlObject | XmlObject[],
				);
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
	let adjustedRows = [...tableData.rows];

	// Handle merge spans
	for (let c = 0; c < removedRow.cells.length; c++) {
		const cell = removedRow.cells[c];

		if (cell.vMerge) {
			// This cell is a continuation of a vertical merge from above.
			// Find the anchor and decrement its rowSpan.
			for (let r = index - 1; r >= 0; r--) {
				const aboveCell = adjustedRows[r]?.cells[c];
				if (!aboveCell) break;
				if (!aboveCell.vMerge) {
					const rs = Math.max(1, aboveCell.rowSpan ?? 1);
					if (rs > 1) {
						adjustedRows[r] = {
							...adjustedRows[r],
							cells: adjustedRows[r].cells.map((cc, ci) =>
								ci === c ? { ...cc, rowSpan: rs - 1 } : cc,
							),
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
							if (ci !== c) return cc;
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
				const xmlRemovedCells = ensureArray(
					xmlRemovedRow['a:tc'] as XmlObject | XmlObject[],
				);

				// Handle merge spans in XML
				for (let c = 0; c < xmlRemovedCells.length; c++) {
					const xmlCell = xmlRemovedCells[c];

					if (
						xmlCell['@_vMerge'] === '1' ||
						xmlCell['@_vMerge'] === true
					) {
						// Find anchor above and decrement rowSpan
						for (let r = index - 1; r >= 0; r--) {
							const aboveCells = ensureArray(
								xmlRows[r]['a:tc'] as XmlObject | XmlObject[],
							);
							if (c < aboveCells.length) {
								const aboveXmlCell = aboveCells[c];
								if (
									aboveXmlCell['@_vMerge'] !== '1' &&
									aboveXmlCell['@_vMerge'] !== true
								) {
									const rs = parseInt(
										String(aboveXmlCell['@_rowSpan'] || '0'),
										10,
									);
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
						const rs = parseInt(
							String(xmlCell['@_rowSpan'] || '0'),
							10,
						);
						if (rs > 1) {
							// Move anchor to next row
							const nextRowIdx = index + 1;
							if (nextRowIdx < xmlRows.length) {
								const nextCells = ensureArray(
									xmlRows[nextRowIdx]['a:tc'] as
										| XmlObject
										| XmlObject[],
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
										nextXmlCell['@_gridSpan'] =
											xmlCell['@_gridSpan'];
									}
									// Copy text body from anchor to new anchor
									if (xmlCell['a:txBody']) {
										nextXmlCell['a:txBody'] =
											xmlCell['a:txBody'];
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
	const splitSourceIdx =
		clampedIndex < colCount ? clampedIndex : colCount - 1;
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
			if (!cell) continue;
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
			if (!aboveCell) continue;
			const rs = Math.max(1, aboveCell.rowSpan ?? 1);
			if (
				rs > 1 &&
				r + rs > ri &&
				!aboveCell.vMerge &&
				!aboveCell.hMerge
			) {
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
			if (ci >= clampedIndex) return cell; // Skip cells at/after insertion
			const gs = Math.max(1, cell.gridSpan ?? 1);
			// Account for the fact that we already inserted a cell, so the original
			// span needs to be checked against the original index
			if (
				gs > 1 &&
				ci + gs > clampedIndex &&
				!cell.hMerge &&
				!cell.vMerge
			) {
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
				const gridCols = ensureArray(
					tblGrid['a:gridCol'] as XmlObject | XmlObject[],
				);
				const sourceIdx =
					clampedIndex < gridCols.length
						? clampedIndex
						: gridCols.length - 1;
				const sourceWidth = parseInt(
					String(gridCols[sourceIdx]?.['@_w'] || '0'),
					10,
				);
				const halfWidthEmu = Math.round(sourceWidth / 2);
				gridCols[sourceIdx] = {
					'@_w': String(sourceWidth - halfWidthEmu),
				};
				gridCols.splice(clampedIndex, 0, {
					'@_w': String(halfWidthEmu),
				});
				tblGrid['a:gridCol'] =
					gridCols.length === 1 ? gridCols[0] : gridCols;
			}

			// Update each a:tr
			const xmlRows = ensureArray(
				tbl['a:tr'] as XmlObject | XmlObject[],
			);
			for (let ri = 0; ri < xmlRows.length; ri++) {
				const xmlRow = xmlRows[ri];
				const xmlCells = ensureArray(
					xmlRow['a:tc'] as XmlObject | XmlObject[],
				);

				const newXmlCell = createDefaultXmlCell();

				// Check if inside a horizontal merge
				let insideMerge = false;
				for (
					let c = 0;
					c < clampedIndex && c < xmlCells.length;
					c++
				) {
					const xmlCell = xmlCells[c];
					const gs = parseInt(
						String(xmlCell['@_gridSpan'] || '0'),
						10,
					);
					if (
						gs > 1 &&
						c + gs > clampedIndex &&
						xmlCell['@_hMerge'] !== '1' &&
						xmlCell['@_hMerge'] !== true
					) {
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
					const aboveCells = ensureArray(
						xmlRows[r]['a:tc'] as XmlObject | XmlObject[],
					);
					// After the splice the col at clampedIndex is the new one,
					// so we check the cell that used to be at clampedIndex (now at clampedIndex in the already-processed row).
					if (clampedIndex < aboveCells.length) {
						const aboveXmlCell = aboveCells[clampedIndex];
						const rs = parseInt(
							String(aboveXmlCell['@_rowSpan'] || '0'),
							10,
						);
						if (
							rs > 1 &&
							r + rs > ri &&
							aboveXmlCell['@_vMerge'] !== '1' &&
							aboveXmlCell['@_vMerge'] !== true
						) {
							newXmlCell['@_vMerge'] = '1';
							break;
						}
						if (
							aboveXmlCell['@_vMerge'] === '1' ||
							aboveXmlCell['@_vMerge'] === true
						) {
							// Continue walking up
							continue;
						}
					}
				}

				xmlCells.splice(clampedIndex, 0, newXmlCell);
				xmlRow['a:tc'] =
					xmlCells.length === 1 ? xmlCells[0] : xmlCells;
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
					if (!leftCell) break;
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
				const gridCols = ensureArray(
					tblGrid['a:gridCol'] as XmlObject | XmlObject[],
				);
				if (index < gridCols.length) {
					gridCols.splice(index, 1);
					tblGrid['a:gridCol'] =
						gridCols.length === 1 ? gridCols[0] : gridCols;
				}
			}

			// Remove from each a:tr
			const xmlRows = ensureArray(
				tbl['a:tr'] as XmlObject | XmlObject[],
			);
			for (const xmlRow of xmlRows) {
				const xmlCells = ensureArray(
					xmlRow['a:tc'] as XmlObject | XmlObject[],
				);
				if (index < xmlCells.length) {
					const xmlCell = xmlCells[index];

					if (
						xmlCell['@_hMerge'] === '1' ||
						xmlCell['@_hMerge'] === true
					) {
						// Find anchor and decrement gridSpan
						for (let c = index - 1; c >= 0; c--) {
							const leftXmlCell = xmlCells[c];
							if (
								leftXmlCell['@_hMerge'] !== '1' &&
								leftXmlCell['@_hMerge'] !== true
							) {
								const gs = parseInt(
									String(leftXmlCell['@_gridSpan'] || '0'),
									10,
								);
								if (gs > 2) {
									leftXmlCell['@_gridSpan'] = String(gs - 1);
								} else {
									delete leftXmlCell['@_gridSpan'];
								}
								break;
							}
						}
					} else {
						const gs = parseInt(
							String(xmlCell['@_gridSpan'] || '0'),
							10,
						);
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
									nextXmlCell['@_rowSpan'] =
										xmlCell['@_rowSpan'];
								}
								// Copy text body from anchor to new anchor
								if (xmlCell['a:txBody']) {
									nextXmlCell['a:txBody'] =
										xmlCell['a:txBody'];
								}
							}
						}
					}

					xmlCells.splice(index, 1);
					xmlRow['a:tc'] =
						xmlCells.length === 1 ? xmlCells[0] : xmlCells;
				}
			}
		}
	}

	return { tableData: newTableData, rawXml: newRawXml };
}

// ---------------------------------------------------------------------------
// Rebuild table XML from PptxTableData
// ---------------------------------------------------------------------------

/**
 * Rebuild the `<a:tblGrid>` and `<a:tr>` elements of a table XML object
 * to match the current `PptxTableData`. This is used by the save pipeline
 * when the number of rows or columns has changed.
 *
 * The method preserves `<a:tblPr>` and existing cell XML where possible.
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
	const totalWidthEmu = existingGridCols.reduce((sum, col) => {
		return sum + (parseInt(String(col?.['@_w'] || '0'), 10) || 0);
	}, 0) || 9144000;

	// ── Rebuild a:tblGrid ──
	const newGridCols: XmlObject[] = tableData.columnWidths.map((w) => ({
		'@_w': String(Math.round(w * totalWidthEmu)),
	}));
	if (!tbl['a:tblGrid']) tbl['a:tblGrid'] = {};
	(tbl['a:tblGrid'] as XmlObject)['a:gridCol'] =
		newGridCols.length === 1 ? newGridCols[0] : newGridCols;

	// ── Rebuild a:tr ──
	const newXmlRows: XmlObject[] = tableData.rows.map((dataRow, ri) => {
		const existingRow =
			ri < existingXmlRows.length ? existingXmlRows[ri] : undefined;
		const existingCells = existingRow
			? (ensureArrayFn(existingRow['a:tc']) as XmlObject[])
			: [];

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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Navigate from a graphic frame rawXml to the `<a:tbl>` node.
 */
function getTblFromRawXml(rawXml: XmlObject): XmlObject | undefined {
	const graphicData = (rawXml['a:graphic'] as XmlObject | undefined)?.[
		'a:graphicData'
	] as XmlObject | undefined;
	return graphicData?.['a:tbl'] as XmlObject | undefined;
}

// Re-export for use by React side
export { getTblFromRawXml };
