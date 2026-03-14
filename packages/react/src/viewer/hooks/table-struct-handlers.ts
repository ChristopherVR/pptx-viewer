/**
 * Table structure handlers — cell editing, column / row resize,
 * insert / delete rows and columns.
 *
 * Structural operations (insert/delete row/column) handle merge span
 * adjustments and synchronise both `tableData` and `rawXml` so that
 * rendering and saving both reflect the changes.
 */
import type { PptxTableCell, PptxTableData, TablePptxElement } from "pptx-viewer-core";
import {
  updateCellTextInRawXml,
  rebuildTableStructureInRawXml,
} from "../utils/table-parse";
import type { TableCellEditorState } from "../types";
import type {
  UseTableOperationsInput,
  TableStructHandlers,
} from "./table-operation-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a default empty cell for insertion. */
function createDefaultCell(): PptxTableCell {
  return { text: "", style: {} };
}

// ---------------------------------------------------------------------------
// Handler factory
// ---------------------------------------------------------------------------

export function createTableStructHandlers(
  input: UseTableOperationsInput,
): TableStructHandlers {
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
    if (!el || el.type !== "table") return;
    if (el.tableData) {
      const newRows = el.tableData.rows.map((row, ri) => {
        if (ri !== rowIndex) return row;
        return {
          ...row,
          cells: row.cells.map((cell, ci) =>
            ci !== colIndex ? cell : { ...cell, text },
          ),
        };
      });
      ops.updateElementById(elementId, {
        tableData: { ...el.tableData, rows: newRows },
      });
    } else {
      const newRawXml = updateCellTextInRawXml(el, rowIndex, colIndex, text);
      if (!newRawXml) return;
      ops.updateElementById(elementId, { rawXml: newRawXml });
    }
    history.markDirty();
    setTableEditorState({
      rowIndex,
      columnIndex: colIndex,
      elementId,
    } as TableCellEditorState);
  };

  // ── Column / row resizing ─────────────────────────────────────────────

  const handleResizeTableColumns = (elementId: string, newWidths: number[]) => {
    const el = elementLookup.get(elementId);
    if (!el || el.type !== "table" || !el.tableData) return;
    ops.updateElementById(elementId, {
      tableData: { ...el.tableData, columnWidths: newWidths },
    });
    history.markDirty();
  };

  const handleResizeTableRow = (
    elementId: string,
    rowIndex: number,
    newHeight: number,
  ) => {
    const el = elementLookup.get(elementId);
    if (!el || el.type !== "table" || !el.tableData) return;
    const newRows = el.tableData.rows.map((row, i) =>
      i === rowIndex ? { ...row, height: newHeight } : row,
    );
    ops.updateElementById(elementId, {
      tableData: { ...el.tableData, rows: newRows },
    });
    history.markDirty();
  };

  // ── Insert row ────────────────────────────────────────────────────────

  const handleInsertTableRow = (position: "above" | "below") => {
    if (
      !selectedElement ||
      selectedElement.type !== "table" ||
      !selectedElement.tableData
    )
      return;
    const rowIdx = ts?.rowIndex ?? 0;
    const insertIdx = position === "above" ? rowIdx : rowIdx + 1;
    const td = selectedElement.tableData;
    const colCount = td.columnWidths.length;

    // Build new cells, handling merges that span across the insertion point
    const newCells: PptxTableCell[] = [];
    for (let c = 0; c < colCount; c++) {
      let insideMerge = false;
      for (let r = 0; r < insertIdx; r++) {
        const cell = td.rows[r]?.cells[c];
        if (!cell) continue;
        const rs = Math.max(1, cell.rowSpan ?? 1);
        if (rs > 1 && r + rs > insertIdx && !cell.vMerge && !cell.hMerge) {
          insideMerge = true;
          break;
        }
      }
      if (insideMerge) {
        newCells.push({ text: "", vMerge: true });
      } else {
        newCells.push(createDefaultCell());
      }
    }

    // Adjust rowSpan of anchor cells above that span across the insertion point
    const adjustedRows = td.rows.map((row, ri) => {
      if (ri >= insertIdx) return row;
      let needsUpdate = false;
      const updatedCells = row.cells.map((cell) => {
        const rs = Math.max(1, cell.rowSpan ?? 1);
        if (rs > 1 && ri + rs > insertIdx && !cell.vMerge && !cell.hMerge) {
          needsUpdate = true;
          return { ...cell, rowSpan: rs + 1 };
        }
        return cell;
      });
      return needsUpdate ? { ...row, cells: updatedCells } : row;
    });

    const newRows = [...adjustedRows];
    newRows.splice(insertIdx, 0, { cells: newCells, height: 40 });

    const newTableData: PptxTableData = { ...td, rows: newRows };

    // Build update object
    const updates: Partial<TablePptxElement> = { tableData: newTableData };
    const newRawXml = rebuildTableStructureInRawXml(
      selectedElement,
      newTableData,
    );
    if (newRawXml) updates.rawXml = newRawXml;

    ops.updateSelectedElement(updates);
    history.markDirty();
  };

  // ── Delete row ────────────────────────────────────────────────────────

  const handleDeleteTableRow = () => {
    if (
      !selectedElement ||
      selectedElement.type !== "table" ||
      !selectedElement.tableData
    )
      return;
    const td = selectedElement.tableData;
    if (td.rows.length <= 1) return;
    const rowIdx = ts?.rowIndex ?? 0;
    if (rowIdx < 0 || rowIdx >= td.rows.length) return;

    const removedRow = td.rows[rowIdx];
    let adjustedRows = [...td.rows];

    // Handle merge spans
    for (let c = 0; c < removedRow.cells.length; c++) {
      const cell = removedRow.cells[c];

      if (cell.vMerge) {
        // Continuation of a vertical merge — decrement anchor's rowSpan
        for (let r = rowIdx - 1; r >= 0; r--) {
          const aboveCell = adjustedRows[r]?.cells[c];
          if (!aboveCell) break;
          if (!aboveCell.vMerge) {
            const rs = Math.max(1, aboveCell.rowSpan ?? 1);
            if (rs > 1) {
              adjustedRows[r] = {
                ...adjustedRows[r],
                cells: adjustedRows[r].cells.map((cc, ci) =>
                  ci === c
                    ? {
                        ...cc,
                        rowSpan: rs - 1 > 1 ? rs - 1 : undefined,
                      }
                    : cc,
                ),
              };
            }
            break;
          }
        }
      } else {
        const rs = Math.max(1, cell.rowSpan ?? 1);
        if (rs > 1) {
          // Anchor of a vertical merge — move anchor to next row
          const nextRowIdx = rowIdx + 1;
          if (nextRowIdx < adjustedRows.length) {
            adjustedRows[nextRowIdx] = {
              ...adjustedRows[nextRowIdx],
              cells: adjustedRows[nextRowIdx].cells.map((cc, ci) => {
                if (ci !== c) return cc;
                const newRs = rs - 1;
                return {
                  ...cc,
                  text: cell.text || cc.text,
                  style: cc.style || cell.style,
                  rowSpan: newRs > 1 ? newRs : undefined,
                  vMerge: undefined,
                  gridSpan: cell.gridSpan,
                };
              }),
            };
          }
        }
      }
    }

    const newRows = adjustedRows.filter((_, i) => i !== rowIdx);
    const newTableData: PptxTableData = { ...td, rows: newRows };

    const updates: Partial<TablePptxElement> = { tableData: newTableData };
    const newRawXml = rebuildTableStructureInRawXml(
      selectedElement,
      newTableData,
    );
    if (newRawXml) updates.rawXml = newRawXml;

    ops.updateSelectedElement(updates);
    history.markDirty();
  };

  // ── Insert column ─────────────────────────────────────────────────────

  const handleInsertTableColumn = (position: "left" | "right") => {
    if (
      !selectedElement ||
      selectedElement.type !== "table" ||
      !selectedElement.tableData
    )
      return;
    const td = selectedElement.tableData;
    const colIdx = ts?.columnIndex ?? 0;
    const insertIdx = position === "left" ? colIdx : colIdx + 1;

    // Determine new column widths — split the source column
    const newWidths = [...td.columnWidths];
    const splitSourceIdx =
      insertIdx < newWidths.length ? insertIdx : newWidths.length - 1;
    const originalWidth = newWidths[splitSourceIdx] ?? 1 / newWidths.length;
    const halfWidth = originalWidth / 2;
    newWidths[splitSourceIdx] = halfWidth;
    newWidths.splice(insertIdx, 0, halfWidth);
    const sum = newWidths.reduce((a, b) => a + b, 0);
    const normalizedWidths = sum > 0 ? newWidths.map((w) => w / sum) : newWidths;

    // Insert cells in each row, handling horizontal merges
    const newRows = td.rows.map((row) => {
      let insideMerge = false;
      for (let c = 0; c < insertIdx && c < row.cells.length; c++) {
        const cell = row.cells[c];
        if (!cell) continue;
        const gs = Math.max(1, cell.gridSpan ?? 1);
        if (gs > 1 && c + gs > insertIdx && !cell.hMerge) {
          insideMerge = true;
          break;
        }
      }

      const newCells = [...row.cells];
      const newCell: PptxTableCell = insideMerge
        ? { text: "", hMerge: true }
        : createDefaultCell();
      newCells.splice(insertIdx, 0, newCell);
      return { ...row, cells: newCells };
    });

    // Adjust gridSpan of anchor cells that span across the insertion point
    const finalRows = newRows.map((row) => {
      let needsUpdate = false;
      const updatedCells = row.cells.map((cell, ci) => {
        if (ci >= insertIdx) return cell;
        const gs = Math.max(1, cell.gridSpan ?? 1);
        if (gs > 1 && ci + gs > insertIdx && !cell.hMerge && !cell.vMerge) {
          needsUpdate = true;
          return { ...cell, gridSpan: gs + 1 };
        }
        return cell;
      });
      return needsUpdate ? { ...row, cells: updatedCells } : row;
    });

    const newTableData: PptxTableData = {
      ...td,
      rows: finalRows,
      columnWidths: normalizedWidths,
    };

    const updates: Partial<TablePptxElement> = { tableData: newTableData };
    const newRawXml = rebuildTableStructureInRawXml(
      selectedElement,
      newTableData,
    );
    if (newRawXml) updates.rawXml = newRawXml;

    ops.updateSelectedElement(updates);
    history.markDirty();
  };

  // ── Delete column ─────────────────────────────────────────────────────

  const handleDeleteTableColumn = () => {
    if (
      !selectedElement ||
      selectedElement.type !== "table" ||
      !selectedElement.tableData
    )
      return;
    const td = selectedElement.tableData;
    if (td.columnWidths.length <= 1) return;
    const colIdx = ts?.columnIndex ?? 0;
    if (colIdx < 0 || colIdx >= td.columnWidths.length) return;

    // Adjust merge spans and remove the column from each row
    const newRows = td.rows.map((row) => {
      const adjustedCells = [...row.cells];
      const cell = adjustedCells[colIdx];

      if (cell) {
        if (cell.hMerge) {
          // Continuation of a horizontal merge — decrement anchor's gridSpan
          for (let c = colIdx - 1; c >= 0; c--) {
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
            // Anchor of a horizontal merge — move anchor to next column
            const nextColIdx = colIdx + 1;
            if (nextColIdx < adjustedCells.length) {
              const nextCell = adjustedCells[nextColIdx];
              adjustedCells[nextColIdx] = {
                ...nextCell,
                text: cell.text || nextCell.text,
                style: nextCell.style || cell.style,
                gridSpan: gs - 1 > 1 ? gs - 1 : undefined,
                hMerge: undefined,
                rowSpan: cell.rowSpan,
              };
            }
          }
        }
      }

      return {
        ...row,
        cells: adjustedCells.filter((_, i) => i !== colIdx),
      };
    });

    // Remove column width and renormalize
    const newWidths = td.columnWidths.filter((_, i) => i !== colIdx);
    const sum = newWidths.reduce((a, b) => a + b, 0);
    const normalizedWidths = sum > 0 ? newWidths.map((w) => w / sum) : newWidths;

    const newTableData: PptxTableData = {
      ...td,
      rows: newRows,
      columnWidths: normalizedWidths,
    };

    const updates: Partial<TablePptxElement> = { tableData: newTableData };
    const newRawXml = rebuildTableStructureInRawXml(
      selectedElement,
      newTableData,
    );
    if (newRawXml) updates.rawXml = newRawXml;

    ops.updateSelectedElement(updates);
    history.markDirty();
  };

  return {
    handleCommitCellEdit,
    handleResizeTableColumns,
    handleResizeTableRow,
    handleInsertTableRow,
    handleDeleteTableRow,
    handleInsertTableColumn,
    handleDeleteTableColumn,
  };
}
