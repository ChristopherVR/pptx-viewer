import React from "react";
import type { TablePptxElement, PptxTableCell } from "pptx-viewer-core";
import { cn } from "../../utils";
import type { TableCellEditorState } from "../types";
import { cellStyleToCss } from "./table-render-helpers";
import { TableCellInput } from "./table-render-cell-input";
import { TableResizeOverlay } from "./table-render-resize";
import {
  computeSelectionRect,
  isCellInRect,
  rectToCells,
  type CellRect,
} from "./table-merge-utils";

/* ------------------------------------------------------------------ */
/*  Rendering from PptxTableData (programmatic tables)                 */
/* ------------------------------------------------------------------ */

export function renderTableFromTableData(
  element: TablePptxElement,
  textStyle: React.CSSProperties,
  options?: {
    editable?: boolean;
    selectedCell?: TableCellEditorState | null;
    onSelectCell?: (cell: TableCellEditorState) => void;
    onCommitCellEdit?: (
      rowIndex: number,
      colIndex: number,
      text: string,
    ) => void;
    onResizeColumns?: (newWidths: number[]) => void;
    onResizeRow?: (rowIndex: number, newHeight: number) => void;
  },
): React.ReactNode {
  const tableData = element.tableData!;
  const selectedCell = options?.selectedCell || null;
  const isEditable = Boolean(options?.editable);
  const hasCellSelectionHandler = typeof options?.onSelectCell === "function";

  // Compute multi-selection highlight rectangle
  const selectionRect: CellRect | undefined = (() => {
    if (!selectedCell?.selectedCells || selectedCell.selectedCells.length < 2)
      return undefined;
    const first = selectedCell.selectedCells[0];
    const last =
      selectedCell.selectedCells[selectedCell.selectedCells.length - 1];
    return computeSelectionRect(
      first.row,
      first.col,
      last.row,
      last.col,
      tableData,
    );
  })();

  return (
    <TableResizeOverlay
      columnWidths={tableData.columnWidths}
      editable={isEditable}
      onResizeColumns={options?.onResizeColumns}
      onResizeRow={options?.onResizeRow}
    >
      <div
        className={cn(
          "w-full h-full overflow-hidden",
          isEditable && hasCellSelectionHandler
            ? "pointer-events-auto"
            : "pointer-events-none",
        )}
      >
        <table className="w-full h-full border-collapse table-fixed">
          {tableData.columnWidths.length > 0 && (
            <colgroup>
              {tableData.columnWidths.map((w, ci) => (
                <col
                  key={`${element.id}-col-${ci}`}
                  style={{ width: `${(w * 100).toFixed(2)}%` }}
                />
              ))}
            </colgroup>
          )}
          <tbody>
            {tableData.rows.map((row, rowIndex) => (
              <tr
                key={`${element.id}-row-${rowIndex}`}
                style={row.height ? { height: row.height } : undefined}
              >
                {row.cells.map((cell: PptxTableCell, cellIndex: number) => {
                  if (cell.hMerge || cell.vMerge) return null;
                  const isCellSelected =
                    selectedCell?.rowIndex === rowIndex &&
                    selectedCell?.columnIndex === cellIndex;
                  const isInMultiSelection = isCellInRect(
                    rowIndex,
                    cellIndex,
                    selectionRect,
                  );
                  const isCellEditing =
                    isCellSelected && selectedCell?.isEditing;
                  return (
                    <td
                      key={`${element.id}-cell-${rowIndex}-${cellIndex}`}
                      className={cn(
                        "border px-1 py-0.5 align-top",
                        isEditable && hasCellSelectionHandler
                          ? "border-blue-200/70 cursor-cell"
                          : "border-gray-400/50",
                        isCellSelected
                          ? "ring-1 ring-inset ring-blue-500"
                          : null,
                        isInMultiSelection && !isCellSelected
                          ? "bg-blue-500/15 ring-1 ring-inset ring-blue-400/50"
                          : null,
                      )}
                      colSpan={
                        cell.gridSpan && cell.gridSpan > 1
                          ? cell.gridSpan
                          : undefined
                      }
                      rowSpan={
                        cell.rowSpan && cell.rowSpan > 1
                          ? cell.rowSpan
                          : undefined
                      }
                      style={{
                        ...textStyle,
                        ...cellStyleToCss(cell.style),
                      }}
                      onClick={(event) => {
                        if (!isEditable || !hasCellSelectionHandler) return;
                        event.stopPropagation();
                        if (event.shiftKey && selectedCell) {
                          const rect = computeSelectionRect(
                            selectedCell.rowIndex,
                            selectedCell.columnIndex,
                            rowIndex,
                            cellIndex,
                            tableData,
                          );
                          options?.onSelectCell?.({
                            rowIndex: selectedCell.rowIndex,
                            columnIndex: selectedCell.columnIndex,
                            selectedCells: rectToCells(rect),
                          });
                        } else {
                          options?.onSelectCell?.({
                            rowIndex,
                            columnIndex: cellIndex,
                          });
                        }
                      }}
                      onDoubleClick={(event) => {
                        if (!isEditable || !hasCellSelectionHandler) return;
                        event.stopPropagation();
                        options?.onSelectCell?.({
                          rowIndex,
                          columnIndex: cellIndex,
                          isEditing: true,
                        });
                      }}
                    >
                      {isCellEditing ? (
                        <TableCellInput
                          initialText={cell.text ?? ""}
                          style={{
                            ...textStyle,
                            ...cellStyleToCss(cell.style),
                          }}
                          onCommit={(text) => {
                            options?.onCommitCellEdit?.(
                              rowIndex,
                              cellIndex,
                              text,
                            );
                          }}
                          onCancel={() => {
                            options?.onSelectCell?.({
                              rowIndex,
                              columnIndex: cellIndex,
                            });
                          }}
                        />
                      ) : (
                        cell.text || "\u00a0"
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TableResizeOverlay>
  );
}
