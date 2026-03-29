import type { TablePptxElement } from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';
import { validateSlideIndex } from './helpers.js';

// ── updateTableCells ─────────────────────────────────────────────────────────

export interface UpdateTableCellsParams {
	slideIndex: number;
	elementId: string;
	cells: Array<{ row: number; col: number; text: string }>;
}

export function updateTableCells(
	ctx: ToolContext,
	params: UpdateTableCellsParams,
): ToolResult<{ updatedCount: number }> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	const el = slide.elements.find((e) => e.id === params.elementId);
	if (!el) {
		throw new Error(`Element '${params.elementId}' not found on slide ${params.slideIndex}.`);
	}
	if (el.type !== 'table') {
		throw new Error(`Element '${params.elementId}' is not a table.`);
	}

	const tbl = el as TablePptxElement;
	if (!tbl.tableData) {
		throw new Error(`Table '${params.elementId}' has no tableData.`);
	}

	let count = 0;
	for (const cellUpdate of params.cells) {
		const row = tbl.tableData.rows[cellUpdate.row];
		if (!row) {
			throw new Error(
				`Row ${cellUpdate.row} out of range (table has ${tbl.tableData.rows.length} rows).`,
			);
		}
		const cell = row.cells[cellUpdate.col];
		if (!cell) {
			throw new Error(`Column ${cellUpdate.col} out of range (row has ${row.cells.length} cells).`);
		}
		cell.text = cellUpdate.text;
		count++;
	}

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { updatedCount: count },
	};
}

// ── manageTableStructure ──────────────────────────────────────────────────────

export interface ManageTableStructureParams {
	slideIndex: number;
	elementId: string;
	action: 'insertRow' | 'deleteRow' | 'insertColumn' | 'deleteColumn';
	position?: number;
	referenceIndex?: number;
	cellTexts?: string[];
}

export function manageTableStructure(
	ctx: ToolContext,
	params: ManageTableStructureParams,
): ToolResult<{ rowCount: number; columnCount: number }> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	const el = slide.elements.find((e) => e.id === params.elementId);
	if (!el) {
		throw new Error(`Element '${params.elementId}' not found on slide ${params.slideIndex}.`);
	}
	if (el.type !== 'table') {
		throw new Error(`Element '${params.elementId}' is not a table.`);
	}

	const tbl = el as TablePptxElement;
	if (!tbl.tableData) {
		throw new Error(`Table '${params.elementId}' has no tableData.`);
	}

	const { rows, columnWidths } = tbl.tableData;
	const colCount = columnWidths.length;
	const rowCount = rows.length;

	switch (params.action) {
		case 'insertRow': {
			const pos =
				params.position !== undefined ? Math.min(Math.max(params.position, 0), rowCount) : rowCount;
			const newRow = {
				height: 40,
				cells: Array.from({ length: colCount }, (_, c) => ({
					text: params.cellTexts?.[c] ?? '',
				})),
			};
			rows.splice(pos, 0, newRow);
			break;
		}

		case 'deleteRow': {
			if (rowCount <= 1) {
				throw new Error('Cannot delete the last row of a table.');
			}
			const ref = params.referenceIndex ?? rowCount - 1;
			if (ref < 0 || ref >= rowCount) {
				throw new Error(`Row index ${ref} out of range (0–${rowCount - 1}).`);
			}
			rows.splice(ref, 1);
			break;
		}

		case 'insertColumn': {
			const pos =
				params.position !== undefined ? Math.min(Math.max(params.position, 0), colCount) : colCount;
			// redistribute column widths
			const newWidth = 1 / (colCount + 1);
			const scaleFactor = colCount / (colCount + 1);
			for (let i = 0; i < columnWidths.length; i++) {
				columnWidths[i] *= scaleFactor;
			}
			columnWidths.splice(pos, 0, newWidth);
			// insert cell in each row
			for (let r = 0; r < rows.length; r++) {
				rows[r].cells.splice(pos, 0, {
					text: params.cellTexts?.[r] ?? '',
				});
			}
			break;
		}

		case 'deleteColumn': {
			if (colCount <= 1) {
				throw new Error('Cannot delete the last column of a table.');
			}
			const ref = params.referenceIndex ?? colCount - 1;
			if (ref < 0 || ref >= colCount) {
				throw new Error(`Column index ${ref} out of range (0–${colCount - 1}).`);
			}
			// redistribute widths
			const removedWidth = columnWidths[ref];
			columnWidths.splice(ref, 1);
			const remaining = columnWidths.length;
			if (remaining > 0) {
				const extra = removedWidth / remaining;
				for (let i = 0; i < columnWidths.length; i++) {
					columnWidths[i] += extra;
				}
			}
			// remove cell from each row
			for (const row of rows) {
				row.cells.splice(ref, 1);
			}
			break;
		}

		default: {
			throw new Error(`Unknown action: ${String(params.action)}`);
		}
	}

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: {
			rowCount: tbl.tableData.rows.length,
			columnCount: tbl.tableData.columnWidths.length,
		},
	};
}
