/**
 * table-render.tsx — Barrel + renderTableElement
 *
 * Implementation split into:
 *   - table-render-helpers.ts     — ooxmlDashToCssBorderStyle, cellStyleToCss
 *   - table-render-cell-input.tsx — TableCellInput inline editor
 *   - table-render-resize.tsx     — TableResizeOverlay drag overlay
 *   - table-render-data.tsx       — renderTableFromTableData (programmatic tables)
 *   - table-render.tsx            — renderTableElement (XML-based tables)
 */
import React from "react";

import type {
  PptxElement,
  XmlObject,
  TablePptxElement,
} from "pptx-viewer-core";
import { cn } from "../../utils";
import { EMU_PER_PX } from "../constants";
import type { TableCellEditorState } from "../types";
import { ensureArrayValue } from "./geometry";
import { TableCellInput } from "./table-render-cell-input";
import { TableResizeOverlay } from "./table-render-resize";
import { renderTableFromTableData } from "./table-render-data";
import {
  computeSelectionRect,
  isCellInRect,
  rectToCells,
  type CellRect,
} from "./table-merge-utils";
import {
  extractCellText,
  extractTableCellStyle,
  getTableCellBandStyle,
  parseTableElementData,
  type TableStyleContext,
} from "./table-parse";

export function renderTableElement(
  element: PptxElement,
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
    styleCtx?: TableStyleContext;
  },
): React.ReactNode {
  const parsedTable = parseTableElementData(element, textStyle);
  if (!parsedTable) {
    // Fall back to rendering from the simplified PptxTableData structure
    // (used for programmatically created tables via Insert → Table).
    const tableEl = element as TablePptxElement;
    if (tableEl.tableData && tableEl.tableData.rows.length > 0) {
      return renderTableFromTableData(tableEl, textStyle, options);
    }
    return (
      <div className="w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none">
        Table
      </div>
    );
  }

  const selectedCell = options?.selectedCell || null;
  const isEditable = Boolean(options?.editable);
  const hasCellSelectionHandler = typeof options?.onSelectCell === "function";

  // Compute multi-selection highlight rectangle for XML-based tables
  const tableEl = element as TablePptxElement;
  const xmlSelectionRect: CellRect | undefined = (() => {
    if (!selectedCell?.selectedCells || selectedCell.selectedCells.length < 2)
      return undefined;
    if (!tableEl.tableData) return undefined;
    const first = selectedCell.selectedCells[0];
    const last =
      selectedCell.selectedCells[selectedCell.selectedCells.length - 1];
    return computeSelectionRect(
      first.row,
      first.col,
      last.row,
      last.col,
      tableEl.tableData,
    );
  })();

  return (
    <TableResizeOverlay
      columnWidths={parsedTable.columnPercentages.map((p) => p / 100)}
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
          {parsedTable.columnPercentages.length > 0 ? (
            <colgroup>
              {parsedTable.columnPercentages.map((percentage, columnIndex) => (
                <col
                  key={`${element.id}-col-${columnIndex}`}
                  style={{ width: `${percentage.toFixed(2)}%` }}
                />
              ))}
            </colgroup>
          ) : null}
          <tbody>
            {parsedTable.rows.map((row, rowIndex) => {
              const cells = ensureArrayValue(
                row["a:tc"] as XmlObject | XmlObject[] | undefined,
              );
              const rowHeightRaw = Number.parseInt(
                String(row["@_h"] || ""),
                10,
              );
              const rowHeight =
                Number.isFinite(rowHeightRaw) && rowHeightRaw > 0
                  ? Math.max(16, rowHeightRaw / EMU_PER_PX)
                  : undefined;
              return (
                <tr
                  key={`${element.id}-row-${rowIndex}`}
                  style={rowHeight ? { height: rowHeight } : undefined}
                >
                  {cells.map((cell, cellIndex) => {
                    const isHMerged =
                      cell["@_hMerge"] === "1" || cell["@_hMerge"] === true;
                    const isVMerged =
                      cell["@_vMerge"] === "1" || cell["@_vMerge"] === true;
                    if (isHMerged || isVMerged) return null;

                    const gridSpanRaw = Number.parseInt(
                      String(cell["@_gridSpan"] || ""),
                      10,
                    );
                    const colSpan =
                      Number.isFinite(gridSpanRaw) && gridSpanRaw > 1
                        ? gridSpanRaw
                        : undefined;

                    const rowSpanRaw = Number.parseInt(
                      String(cell["@_rowSpan"] || ""),
                      10,
                    );
                    const rSpan =
                      Number.isFinite(rowSpanRaw) && rowSpanRaw > 1
                        ? rowSpanRaw
                        : undefined;

                    const bandStyle = getTableCellBandStyle(
                      element,
                      rowIndex,
                      cellIndex,
                      parsedTable.rowCount,
                      parsedTable.columnCount,
                      options?.styleCtx,
                    );

                    return (
                      <td
                        key={`${element.id}-cell-${rowIndex}-${cellIndex}`}
                        className={cn(
                          "border px-1 py-0.5 align-top",
                          isEditable && hasCellSelectionHandler
                            ? "border-blue-200/70 cursor-cell"
                            : "border-white/30",
                          selectedCell?.rowIndex === rowIndex &&
                            selectedCell?.columnIndex === cellIndex
                            ? "ring-1 ring-inset ring-blue-500"
                            : null,
                          isCellInRect(rowIndex, cellIndex, xmlSelectionRect) &&
                            !(
                              selectedCell?.rowIndex === rowIndex &&
                              selectedCell?.columnIndex === cellIndex
                            )
                            ? "bg-blue-500/15 ring-1 ring-inset ring-blue-400/50"
                            : null,
                        )}
                        colSpan={colSpan}
                        rowSpan={rSpan}
                        style={{
                          ...extractTableCellStyle(cell, textStyle),
                          ...bandStyle,
                        }}
                        onClick={(event) => {
                          if (!isEditable || !hasCellSelectionHandler) return;
                          event.stopPropagation();
                          if (
                            event.shiftKey &&
                            selectedCell &&
                            tableEl.tableData
                          ) {
                            const rect = computeSelectionRect(
                              selectedCell.rowIndex,
                              selectedCell.columnIndex,
                              rowIndex,
                              cellIndex,
                              tableEl.tableData,
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
                        {selectedCell?.rowIndex === rowIndex &&
                        selectedCell?.columnIndex === cellIndex &&
                        selectedCell?.isEditing ? (
                          <TableCellInput
                            initialText={extractCellText(cell) ?? ""}
                            style={{
                              ...extractTableCellStyle(cell, textStyle),
                              ...bandStyle,
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
                          extractCellText(cell) || "\u00a0"
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TableResizeOverlay>
  );
}
