/**
 * Table merge / split handlers — merge right, merge down,
 * merge selected cells, split cell.
 */
import type { TablePptxElement } from "../../core";
import { updateMergeAttrsInRawXml } from "../utils/table-parse";
import {
  mergeCells as mergeTableCells,
  splitCell as splitTableCell,
} from "../utils/table-merge-utils";
import type { TableCellEditorState } from "../types";
import type {
  UseTableOperationsInput,
  TableMergeHandlers,
} from "./table-operation-types";

export function createTableMergeHandlers(
  input: UseTableOperationsInput,
): TableMergeHandlers {
  const {
    selectedElement,
    tableEditorState: ts,
    setTableEditorState,
    ops,
    history,
  } = input;

  const handleMergeCellRight = () => {
    if (
      !selectedElement ||
      selectedElement.type !== "table" ||
      !selectedElement.tableData ||
      !ts
    )
      return;
    const { rowIndex, columnIndex } = ts;
    const td = selectedElement.tableData;
    const cellAtCursor = td.rows[rowIndex]?.cells[columnIndex];
    if (!cellAtCursor) return;
    const currentSpan = Math.max(1, cellAtCursor.gridSpan ?? 1);
    const nextColIdx = columnIndex + currentSpan;
    const nextCell = td.rows[rowIndex]?.cells[nextColIdx];
    if (!nextCell || nextCell.hMerge || nextCell.vMerge) return;
    const newTableData = mergeTableCells(
      [
        { row: rowIndex, col: columnIndex },
        { row: rowIndex, col: nextColIdx },
      ],
      td,
    );
    const updates: Partial<TablePptxElement> = { tableData: newTableData };
    const newRawXml = updateMergeAttrsInRawXml(selectedElement, newTableData);
    if (newRawXml) updates.rawXml = newRawXml;
    ops.updateSelectedElement(updates);
    history.markDirty();
  };

  const handleMergeCellDown = () => {
    if (
      !selectedElement ||
      selectedElement.type !== "table" ||
      !selectedElement.tableData ||
      !ts
    )
      return;
    const { rowIndex, columnIndex } = ts;
    const td = selectedElement.tableData;
    const cellAtCursor = td.rows[rowIndex]?.cells[columnIndex];
    if (!cellAtCursor) return;
    const currentRowSpan = Math.max(1, cellAtCursor.rowSpan ?? 1);
    const targetNextRowIdx = rowIndex + currentRowSpan;
    if (targetNextRowIdx >= td.rows.length) return;
    const targetNextCell = td.rows[targetNextRowIdx]?.cells[columnIndex];
    if (!targetNextCell || targetNextCell.hMerge || targetNextCell.vMerge)
      return;
    const newTableData = mergeTableCells(
      [
        { row: rowIndex, col: columnIndex },
        { row: targetNextRowIdx, col: columnIndex },
      ],
      td,
    );
    const updates: Partial<TablePptxElement> = { tableData: newTableData };
    const newRawXml = updateMergeAttrsInRawXml(selectedElement, newTableData);
    if (newRawXml) updates.rawXml = newRawXml;
    ops.updateSelectedElement(updates);
    history.markDirty();
  };

  const handleMergeSelectedCells = () => {
    if (
      !selectedElement ||
      selectedElement.type !== "table" ||
      !selectedElement.tableData
    )
      return;
    if (!ts || !ts.selectedCells || ts.selectedCells.length < 2) return;
    const td = selectedElement.tableData;
    const newTableData = mergeTableCells(ts.selectedCells, td);
    const updates: Partial<TablePptxElement> = { tableData: newTableData };
    const newRawXml = updateMergeAttrsInRawXml(selectedElement, newTableData);
    if (newRawXml) updates.rawXml = newRawXml;
    ops.updateSelectedElement(updates);
    setTableEditorState({
      rowIndex: ts.rowIndex,
      columnIndex: ts.columnIndex,
    } as TableCellEditorState);
    history.markDirty();
  };

  const handleSplitCell = () => {
    if (
      !selectedElement ||
      selectedElement.type !== "table" ||
      !selectedElement.tableData ||
      !ts
    )
      return;
    const { rowIndex, columnIndex } = ts;
    const td = selectedElement.tableData;
    const newTableData = splitTableCell(rowIndex, columnIndex, td);
    const updates: Partial<TablePptxElement> = { tableData: newTableData };
    const newRawXml = updateMergeAttrsInRawXml(selectedElement, newTableData);
    if (newRawXml) updates.rawXml = newRawXml;
    ops.updateSelectedElement(updates);
    history.markDirty();
  };

  return {
    handleMergeCellRight,
    handleMergeCellDown,
    handleMergeSelectedCells,
    handleSplitCell,
  };
}
