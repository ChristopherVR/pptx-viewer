/**
 * Shared types for useTableOperations and its sub-modules.
 */
import type { Dispatch, SetStateAction } from "react";
import type { PptxElement } from "pptx-viewer-core";
import type { TableCellEditorState } from "../types";
import type { ElementOperations } from "./useElementOperations";
import type { EditorHistoryResult } from "./useEditorHistory";

export interface UseTableOperationsInput {
  selectedElement: PptxElement | null;
  tableEditorState: TableCellEditorState | null;
  elementLookup: Map<string, PptxElement>;
  setTableEditorState: Dispatch<SetStateAction<TableCellEditorState | null>>;
  ops: ElementOperations;
  history: EditorHistoryResult;
}

export interface TableStructHandlers {
  handleCommitCellEdit: (
    elementId: string,
    rowIndex: number,
    colIndex: number,
    text: string,
  ) => void;
  handleResizeTableColumns: (elementId: string, newWidths: number[]) => void;
  handleResizeTableRow: (
    elementId: string,
    rowIndex: number,
    newHeight: number,
  ) => void;
  handleInsertTableRow: (position: "above" | "below") => void;
  handleDeleteTableRow: () => void;
  handleInsertTableColumn: (position: "left" | "right") => void;
  handleDeleteTableColumn: () => void;
}

export interface TableMergeHandlers {
  handleMergeCellRight: () => void;
  handleMergeCellDown: () => void;
  handleMergeSelectedCells: () => void;
  handleSplitCell: () => void;
}

export type TableOperationHandlers = TableStructHandlers & TableMergeHandlers;
