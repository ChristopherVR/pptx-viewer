/**
 * Table structure handlers: cell editing, column / row resize,
 * insert / delete rows and columns.
 *
 * Structural operations (insert/delete row/column) handle merge span
 * adjustments and synchronise both `tableData` and `rawXml` so that
 * rendering and saving both reflect the changes.
 */
import type { TablePptxElement } from 'pptx-viewer-core';
import {
	insertTableRow,
	deleteTableRow,
	insertTableColumn,
	deleteTableColumn,
} from 'pptx-viewer-shared';

import type { TableCellEditorState } from '../types';
import {
	updateCellTextInRawXml,
	updateCellTextStyleInRawXml,
	rebuildTableStructureInRawXml,
} from '../utils/table-parse';
import type { UseTableOperationsInput, TableStructHandlers } from './table-operation-types';

// ---------------------------------------------------------------------------
// Handler factory
//
// The pure structural math (merge-aware row/column insert/delete over
// `PptxTableData`) now lives in `pptx-viewer-shared` (`render/table-layout.ts`).
// These handlers wrap those pure transforms with the editor's stateful concerns
// (rawXml synchronisation, history dirty-marking, element updates).
// ---------------------------------------------------------------------------

export function createTableStructHandlers(input: UseTableOperationsInput): TableStructHandlers {
	const {
		selectedElement,
		tableEditorState: ts,
		elementLookup,
		setTableEditorState,
		ops,
		history,
	} = input;

	// ── Cell text editing ─────────────────────────────────────────────────

	const handleCommitCellEdit = (
		elementId: string,
		rowIndex: number,
		colIndex: number,
		text: string,
	) => {
		const el = elementLookup.get(elementId);
		if (!el || el.type !== 'table') {
			return;
		}

		const updates: Record<string, unknown> = {};

		// Always update tableData if it exists
		if (el.tableData) {
			const newRows = el.tableData.rows.map((row, ri) => {
				if (ri !== rowIndex) {
					return row;
				}
				return {
					...row,
					cells: row.cells.map((cell, ci) => (ci !== colIndex ? cell : { ...cell, text })),
				};
			});
			updates.tableData = { ...el.tableData, rows: newRows };
		}

		// Always update rawXml if it exists (rendering reads from rawXml
		// via parseTableElementData, so it must stay in sync)
		if (el.rawXml) {
			const newRawXml = updateCellTextInRawXml(el, rowIndex, colIndex, text);
			if (newRawXml) {
				updates.rawXml = newRawXml;
			}
		}

		if (Object.keys(updates).length === 0) {
			return;
		}
		ops.updateElementById(elementId, updates);
		history.markDirty();
		setTableEditorState({
			rowIndex,
			columnIndex: colIndex,
			elementId,
		} as TableCellEditorState);
	};

	// ── Cell text style update ───────────────────────────────────────────

	const handleUpdateCellTextStyle = (styleUpdates: Record<string, unknown>) => {
		if (!selectedElement || selectedElement.type !== 'table' || !ts) {
			return;
		}

		const elementId = selectedElement.id;
		const { rowIndex, columnIndex: colIndex } = ts;
		const updates: Record<string, unknown> = {};

		// Update rawXml (which the rendering reads from)
		if (selectedElement.rawXml) {
			const newRawXml = updateCellTextStyleInRawXml(
				selectedElement,
				rowIndex,
				colIndex,
				styleUpdates,
			);
			if (newRawXml) {
				updates.rawXml = newRawXml;
			}
		}

		// Also update tableData cell style if tableData exists
		if (selectedElement.tableData) {
			const newRows = selectedElement.tableData.rows.map((row, ri) => {
				if (ri !== rowIndex) {
					return row;
				}
				return {
					...row,
					cells: row.cells.map((cell, ci) => {
						if (ci !== colIndex) {
							return cell;
						}
						return {
							...cell,
							style: { ...cell.style, ...styleUpdates },
						};
					}),
				};
			});
			updates.tableData = { ...selectedElement.tableData, rows: newRows };
		}

		if (Object.keys(updates).length === 0) {
			return;
		}
		ops.updateElementById(elementId, updates);
		history.markDirty();
	};

	// ── Column / row resizing ─────────────────────────────────────────────

	const handleResizeTableColumns = (elementId: string, newWidths: number[]) => {
		const el = elementLookup.get(elementId);
		if (!el || el.type !== 'table' || !el.tableData) {
			return;
		}
		ops.updateElementById(elementId, {
			tableData: { ...el.tableData, columnWidths: newWidths },
		});
		history.markDirty();
	};

	const handleResizeTableRow = (elementId: string, rowIndex: number, newHeight: number) => {
		const el = elementLookup.get(elementId);
		if (!el || el.type !== 'table' || !el.tableData) {
			return;
		}
		const newRows = el.tableData.rows.map((row, i) =>
			i === rowIndex ? { ...row, height: newHeight } : row,
		);
		ops.updateElementById(elementId, {
			tableData: { ...el.tableData, rows: newRows },
		});
		history.markDirty();
	};

	// ── Insert row ────────────────────────────────────────────────────────

	const handleInsertTableRow = (position: 'above' | 'below') => {
		if (!selectedElement || selectedElement.type !== 'table' || !selectedElement.tableData) {
			return;
		}
		const rowIdx = ts?.rowIndex ?? 0;
		const newTableData = insertTableRow(selectedElement.tableData, rowIdx, position);

		// Build update object
		const updates: Partial<TablePptxElement> = { tableData: newTableData };
		const newRawXml = rebuildTableStructureInRawXml(selectedElement, newTableData);
		if (newRawXml) {
			updates.rawXml = newRawXml;
		}

		ops.updateSelectedElement(updates);
		history.markDirty();
	};

	// ── Delete row ────────────────────────────────────────────────────────

	const handleDeleteTableRow = () => {
		if (!selectedElement || selectedElement.type !== 'table' || !selectedElement.tableData) {
			return;
		}
		const td = selectedElement.tableData;
		const rowIdx = ts?.rowIndex ?? 0;
		const newTableData = deleteTableRow(td, rowIdx);
		// `deleteTableRow` returns the same reference when the delete is a no-op
		// (single row or out-of-range index).
		if (newTableData === td) {
			return;
		}

		const updates: Partial<TablePptxElement> = { tableData: newTableData };
		const newRawXml = rebuildTableStructureInRawXml(selectedElement, newTableData);
		if (newRawXml) {
			updates.rawXml = newRawXml;
		}

		ops.updateSelectedElement(updates);
		history.markDirty();
	};

	// ── Insert column ─────────────────────────────────────────────────────

	const handleInsertTableColumn = (position: 'left' | 'right') => {
		if (!selectedElement || selectedElement.type !== 'table' || !selectedElement.tableData) {
			return;
		}
		const colIdx = ts?.columnIndex ?? 0;
		const newTableData = insertTableColumn(selectedElement.tableData, colIdx, position);

		const updates: Partial<TablePptxElement> = { tableData: newTableData };
		const newRawXml = rebuildTableStructureInRawXml(selectedElement, newTableData);
		if (newRawXml) {
			updates.rawXml = newRawXml;
		}

		ops.updateSelectedElement(updates);
		history.markDirty();
	};

	// ── Delete column ─────────────────────────────────────────────────────

	const handleDeleteTableColumn = () => {
		if (!selectedElement || selectedElement.type !== 'table' || !selectedElement.tableData) {
			return;
		}
		const td = selectedElement.tableData;
		const colIdx = ts?.columnIndex ?? 0;
		const newTableData = deleteTableColumn(td, colIdx);
		// `deleteTableColumn` returns the same reference for no-op deletes
		// (single column or out-of-range index).
		if (newTableData === td) {
			return;
		}

		const updates: Partial<TablePptxElement> = { tableData: newTableData };
		const newRawXml = rebuildTableStructureInRawXml(selectedElement, newTableData);
		if (newRawXml) {
			updates.rawXml = newRawXml;
		}

		ops.updateSelectedElement(updates);
		history.markDirty();
	};

	return {
		handleCommitCellEdit,
		handleUpdateCellTextStyle,
		handleResizeTableColumns,
		handleResizeTableRow,
		handleInsertTableRow,
		handleDeleteTableRow,
		handleInsertTableColumn,
		handleDeleteTableColumn,
	};
}
