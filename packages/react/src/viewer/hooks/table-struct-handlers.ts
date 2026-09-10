/**
 * Table structure handlers: cell editing, column / row resize,
 * insert / delete rows and columns.
 *
 * Structural operations (insert/delete row/column) handle merge span
 * adjustments and synchronise both `tableData` and `rawXml` so that
 * rendering and saving both reflect the changes.
 */
import {
	insertTableElementRow,
	removeTableElementRow,
	insertTableElementColumn,
	removeTableElementColumn,
	setCellText,
} from 'pptx-viewer-shared';

import type { TableCellEditorState } from '../types';
import { updateCellTextInRawXml, updateCellTextStyleInRawXml } from '../utils/table-parse';
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
		transformCommittedText,
	} = input;

	// ── Cell text editing ─────────────────────────────────────────────────

	const handleCommitCellEdit = (
		elementId: string,
		rowIndex: number,
		colIndex: number,
		rawText: string,
	) => {
		const el = elementLookup.get(elementId);
		if (!el || el.type !== 'table') {
			return;
		}

		const text = transformCommittedText ? transformCommittedText(rawText) : rawText;
		const updates: Record<string, unknown> = {};

		// Always update tableData if it exists. Through shared `setCellText`, not
		// a local `{ ...cell, text }`: the cell also carries `textRuns`, the
		// per-run model the renderer prefers over the flat string, and a
		// hand-rolled spread keeps the runs describing the OLD wording - which is
		// exactly what the canvas then keeps painting.
		if (el.tableData) {
			updates.tableData = setCellText(el, rowIndex, colIndex, text).tableData;
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
		const next = insertTableElementRow(selectedElement, rowIdx, position);
		ops.updateSelectedElement({ tableData: next.tableData, rawXml: next.rawXml });
		history.markDirty();
	};

	// ── Delete row ────────────────────────────────────────────────────────

	const handleDeleteTableRow = () => {
		if (!selectedElement || selectedElement.type !== 'table' || !selectedElement.tableData) {
			return;
		}
		const rowIdx = ts?.rowIndex ?? 0;
		const next = removeTableElementRow(selectedElement, rowIdx);
		if (next === selectedElement) {
			return;
		}
		ops.updateSelectedElement({ tableData: next.tableData, rawXml: next.rawXml });
		history.markDirty();
	};

	// ── Insert column ─────────────────────────────────────────────────────

	const handleInsertTableColumn = (position: 'left' | 'right') => {
		if (!selectedElement || selectedElement.type !== 'table' || !selectedElement.tableData) {
			return;
		}
		const colIdx = ts?.columnIndex ?? 0;
		const next = insertTableElementColumn(selectedElement, colIdx, position);
		ops.updateSelectedElement({ tableData: next.tableData, rawXml: next.rawXml });
		history.markDirty();
	};

	// ── Delete column ─────────────────────────────────────────────────────

	const handleDeleteTableColumn = () => {
		if (!selectedElement || selectedElement.type !== 'table' || !selectedElement.tableData) {
			return;
		}
		const colIdx = ts?.columnIndex ?? 0;
		const next = removeTableElementColumn(selectedElement, colIdx);
		if (next === selectedElement) {
			return;
		}
		ops.updateSelectedElement({ tableData: next.tableData, rawXml: next.rawXml });
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
