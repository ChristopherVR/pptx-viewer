/**
 * Table selection helpers for cell coordinate operations.
 */
import type { PptxTableData } from "pptx-viewer-core";
import type { CellCoord, CellRect } from "./table-merge-core";
import { expandRectForExistingMerges } from "./table-merge-core";

// ---------------------------------------------------------------------------
// Selection helpers
// ---------------------------------------------------------------------------

/**
 * Compute the bounding rectangle between two cells (e.g. anchor and Shift+Click target).
 * Expands for existing merges so the visual selection is always rectangular.
 */
export function computeSelectionRect(
  anchorRow: number,
  anchorCol: number,
  targetRow: number,
  targetCol: number,
  tableData: PptxTableData,
): CellRect {
  const rawRect: CellRect = {
    startRow: Math.min(anchorRow, targetRow),
    startCol: Math.min(anchorCol, targetCol),
    endRow: Math.max(anchorRow, targetRow),
    endCol: Math.max(anchorCol, targetCol),
  };
  return expandRectForExistingMerges(rawRect, tableData);
}

/**
 * Enumerate all cell coordinates within a rect.
 */
export function rectToCells(rect: CellRect): CellCoord[] {
  const result: CellCoord[] = [];
  for (let r = rect.startRow; r <= rect.endRow; r++) {
    for (let c = rect.startCol; c <= rect.endCol; c++) {
      result.push({ row: r, col: c });
    }
  }
  return result;
}

/**
 * Check whether a given cell coordinate is inside a rect.
 */
export function isCellInRect(
  row: number,
  col: number,
  rect: CellRect | undefined,
): boolean {
  if (!rect) return false;
  return (
    row >= rect.startRow &&
    row <= rect.endRow &&
    col >= rect.startCol &&
    col <= rect.endCol
  );
}
