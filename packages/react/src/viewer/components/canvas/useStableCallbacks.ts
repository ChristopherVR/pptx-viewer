import React, { useCallback, useRef } from "react";
import type { TableCellEditorState } from "../../types";

/* ------------------------------------------------------------------ */
/*  Callbacks type (mirrors the shape of SlideCanvasProps callbacks)   */
/* ------------------------------------------------------------------ */

interface ParentCallbacks {
  onClick: (elementId: string, e: React.MouseEvent) => void;
  onDoubleClick: (elementId: string, e: React.MouseEvent) => void;
  onMouseDown: (elementId: string, e: React.MouseEvent) => void;
  onContextMenu: (elementId: string, e: React.MouseEvent) => void;
  onResizePointerDown: (
    elementId: string,
    e: React.MouseEvent,
    handle: string,
  ) => void;
  onAdjustmentPointerDown: (elementId: string, e: React.MouseEvent) => void;
  onInlineEditChange: (text: string) => void;
  onInlineEditCommit: () => void;
  onInlineEditCancel: () => void;
  onTableCellSelect: (
    cell: Omit<TableCellEditorState, "elementId"> | null,
    elementId: string,
  ) => void;
  onCommitCellEdit?: (
    elementId: string,
    rowIndex: number,
    colIndex: number,
    text: string,
  ) => void;
  onResizeTableColumns?: (elementId: string, newWidths: number[]) => void;
  onResizeTableRow?: (
    elementId: string,
    rowIndex: number,
    newHeight: number,
  ) => void;
}

/* ------------------------------------------------------------------ */
/*  Return type                                                        */
/* ------------------------------------------------------------------ */

export interface StableCallbacks {
  cbRef: React.RefObject<ParentCallbacks>;
  stableResizePointerDown: (
    elementId: string,
    e: React.MouseEvent,
    handle: string,
  ) => void;
  stableAdjustmentPointerDown: (elementId: string, e: React.MouseEvent) => void;
  stableInlineEditChange: (text: string) => void;
  stableInlineEditCommit: () => void;
  stableInlineEditCancel: () => void;
  stableTableCellSelect: (
    cell: TableCellEditorState | null,
    elementId: string,
  ) => void;
  stableCommitCellEdit: (
    elementId: string,
    rowIndex: number,
    colIndex: number,
    text: string,
  ) => void;
  stableResizeTableColumns: (elementId: string, newWidths: number[]) => void;
  stableResizeTableRow: (
    elementId: string,
    rowIndex: number,
    newHeight: number,
  ) => void;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useStableCallbacks(
  callbacks: ParentCallbacks,
): StableCallbacks {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const stableResizePointerDown = useCallback(
    (elementId: string, e: React.MouseEvent, handle: string) =>
      cbRef.current.onResizePointerDown(elementId, e, handle),
    [],
  );

  const stableAdjustmentPointerDown = useCallback(
    (elementId: string, e: React.MouseEvent) =>
      cbRef.current.onAdjustmentPointerDown(elementId, e),
    [],
  );

  const stableInlineEditChange = useCallback(
    (text: string) => cbRef.current.onInlineEditChange(text),
    [],
  );

  const stableInlineEditCommit = useCallback(
    () => cbRef.current.onInlineEditCommit(),
    [],
  );

  const stableInlineEditCancel = useCallback(
    () => cbRef.current.onInlineEditCancel(),
    [],
  );

  const stableTableCellSelect = useCallback(
    (cell: TableCellEditorState | null, elementId: string) =>
      cbRef.current.onTableCellSelect(cell, elementId),
    [],
  );

  const stableCommitCellEdit = useCallback(
    (elementId: string, rowIndex: number, colIndex: number, text: string) =>
      cbRef.current.onCommitCellEdit?.(elementId, rowIndex, colIndex, text),
    [],
  );

  const stableResizeTableColumns = useCallback(
    (elementId: string, newWidths: number[]) =>
      cbRef.current.onResizeTableColumns?.(elementId, newWidths),
    [],
  );

  const stableResizeTableRow = useCallback(
    (elementId: string, rowIndex: number, newHeight: number) =>
      cbRef.current.onResizeTableRow?.(elementId, rowIndex, newHeight),
    [],
  );

  return {
    cbRef,
    stableResizePointerDown,
    stableAdjustmentPointerDown,
    stableInlineEditChange,
    stableInlineEditCommit,
    stableInlineEditCancel,
    stableTableCellSelect,
    stableCommitCellEdit,
    stableResizeTableColumns,
    stableResizeTableRow,
  };
}
