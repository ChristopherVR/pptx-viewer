/**
 * Table structure handlers — cell editing, column / row resize,
 * insert / delete rows and columns.
 */
import { updateCellTextInRawXml } from "../utils/table-parse";
import type { TableCellEditorState } from "../types";
import type {
  UseTableOperationsInput,
  TableStructHandlers,
} from "./table-operation-types";

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

  const handleInsertTableRow = (position: "above" | "below") => {
    if (
      !selectedElement ||
      selectedElement.type !== "table" ||
      !selectedElement.tableData
    )
      return;
    const rowIdx = ts?.rowIndex ?? 0;
    const insertIdx = position === "above" ? rowIdx : rowIdx + 1;
    const colCount = selectedElement.tableData.columnWidths.length;
    const newRow = {
      cells: Array.from({ length: colCount }, () => ({ text: "", style: {} })),
    };
    const newRows = [...selectedElement.tableData.rows];
    newRows.splice(insertIdx, 0, newRow);
    ops.updateSelectedElement({
      tableData: { ...selectedElement.tableData, rows: newRows },
    });
    history.markDirty();
  };

  const handleDeleteTableRow = () => {
    if (
      !selectedElement ||
      selectedElement.type !== "table" ||
      !selectedElement.tableData
    )
      return;
    if (selectedElement.tableData.rows.length <= 1) return;
    const rowIdx = ts?.rowIndex ?? 0;
    const newRows = selectedElement.tableData.rows.filter(
      (_, i) => i !== rowIdx,
    );
    ops.updateSelectedElement({
      tableData: { ...selectedElement.tableData, rows: newRows },
    });
    history.markDirty();
  };

  const handleInsertTableColumn = (position: "left" | "right") => {
    if (
      !selectedElement ||
      selectedElement.type !== "table" ||
      !selectedElement.tableData
    )
      return;
    const colIdx = ts?.columnIndex ?? 0;
    const insertIdx = position === "left" ? colIdx : colIdx + 1;
    const newRows = selectedElement.tableData.rows.map((row) => {
      const cells = [...row.cells];
      cells.splice(insertIdx, 0, { text: "", style: {} });
      return { ...row, cells };
    });
    const colWidths = [...selectedElement.tableData.columnWidths];
    const newWidth = 1 / (colWidths.length + 1);
    colWidths.splice(insertIdx, 0, newWidth);
    const sum = colWidths.reduce((a, b) => a + b, 0);
    const normalizedWidths = colWidths.map((w) => w / sum);
    ops.updateSelectedElement({
      tableData: {
        ...selectedElement.tableData,
        rows: newRows,
        columnWidths: normalizedWidths,
      },
    });
    history.markDirty();
  };

  const handleDeleteTableColumn = () => {
    if (
      !selectedElement ||
      selectedElement.type !== "table" ||
      !selectedElement.tableData
    )
      return;
    if (selectedElement.tableData.columnWidths.length <= 1) return;
    const colIdx = ts?.columnIndex ?? 0;
    const newRows = selectedElement.tableData.rows.map((row) => ({
      ...row,
      cells: row.cells.filter((_, i) => i !== colIdx),
    }));
    const colWidths = selectedElement.tableData.columnWidths.filter(
      (_, i) => i !== colIdx,
    );
    const sum = colWidths.reduce((a, b) => a + b, 0);
    const normalizedWidths = colWidths.map((w) => w / sum);
    ops.updateSelectedElement({
      tableData: {
        ...selectedElement.tableData,
        rows: newRows,
        columnWidths: normalizedWidths,
      },
    });
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
