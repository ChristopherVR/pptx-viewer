import type React from "react";
import { useTranslation } from "react-i18next";

import type { TablePptxElement } from "pptx-viewer-core";

import type { ContextMenuProps } from "./context-menu-types";

export function ContextMenu({
  contextMenuState,
  mode,
  selectedElement,
  tableEditorState,
  hasMultiSelection,
  onAction,
  onInsertTableRow,
  onDeleteTableRow,
  onInsertTableColumn,
  onDeleteTableColumn,
  onMergeCellRight,
  onMergeCellDown,
  onMergeSelectedCells,
  onSplitCell,
  onClose,
}: ContextMenuProps): React.ReactElement | null {
  const { t } = useTranslation();

  if (!contextMenuState || mode !== "edit") return null;

  const isTable =
    selectedElement?.type === "table" && tableEditorState !== null;
  const hasMultiCellSelection =
    isTable &&
    tableEditorState !== null &&
    Array.isArray(tableEditorState.selectedCells) &&
    tableEditorState.selectedCells.length >= 2;
  const isMergedCell = (() => {
    if (!isTable || !tableEditorState) return false;
    const tbl = selectedElement as TablePptxElement;
    const td = tbl.tableData;
    if (!td) return false;
    const cell =
      td.rows[tableEditorState.rowIndex]?.cells[tableEditorState.columnIndex];
    if (!cell) return false;
    return (
      (cell.gridSpan !== undefined && cell.gridSpan > 1) ||
      (cell.rowSpan !== undefined && cell.rowSpan > 1)
    );
  })();

  return (
    <>
      {/* Invisible backdrop to close menu on outside click */}
      <div
        className="fixed inset-0 z-[119]"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        data-pptx-context-menu="true"
        className="fixed z-[120] min-w-[180px] rounded border border-border bg-popover shadow-2xl py-1.5 text-xs text-foreground"
        style={{
          left: Math.max(contextMenuState.x, 8),
          top: Math.max(contextMenuState.y, 8),
        }}
      >
        <button
          type="button"
          className="w-full px-3 py-1.5 text-left hover:bg-muted"
          onClick={() => onAction("copy")}
        >
          {t("pptx.contextMenu.copy")}
        </button>
        <button
          type="button"
          className="w-full px-3 py-1.5 text-left hover:bg-muted"
          onClick={() => onAction("cut")}
        >
          {t("pptx.contextMenu.cut")}
        </button>
        <button
          type="button"
          className="w-full px-3 py-1.5 text-left hover:bg-muted"
          onClick={() => onAction("paste")}
        >
          {t("pptx.contextMenu.paste")}
        </button>
        <button
          type="button"
          className="w-full px-3 py-1.5 text-left hover:bg-muted"
          onClick={() => onAction("duplicate")}
        >
          {t("pptx.contextMenu.duplicate")}
        </button>
        <div className="my-1 border-t border-border" />
        <button
          type="button"
          className="w-full px-3 py-1.5 text-left hover:bg-muted"
          onClick={() => onAction("bring-forward")}
        >
          {t("pptx.contextMenu.bringForward")}
        </button>
        <button
          type="button"
          className="w-full px-3 py-1.5 text-left hover:bg-muted"
          onClick={() => onAction("send-backward")}
        >
          {t("pptx.contextMenu.sendBackward")}
        </button>
        <button
          type="button"
          className="w-full px-3 py-1.5 text-left hover:bg-muted"
          onClick={() => onAction("bring-front")}
        >
          {t("pptx.contextMenu.bringToFront")}
        </button>
        <button
          type="button"
          className="w-full px-3 py-1.5 text-left hover:bg-muted"
          onClick={() => onAction("send-back")}
        >
          {t("pptx.contextMenu.sendToBack")}
        </button>
        <div className="my-1 border-t border-border" />
        <button
          type="button"
          className="w-full px-3 py-1.5 text-left hover:bg-muted"
          onClick={() => onAction("comment")}
        >
          {t("pptx.contextMenu.addComment")}
        </button>
        <button
          type="button"
          className="w-full px-3 py-1.5 text-left hover:bg-muted"
          onClick={() => {
            onAction("editHyperlink");
            onClose();
          }}
        >
          {t("pptx.contextMenu.editHyperlink")}
        </button>
        {isTable && tableEditorState && (
          <>
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left hover:bg-muted"
              onClick={() => {
                onInsertTableRow("above");
                onClose();
              }}
            >
              {t("pptx.contextMenu.insertRowAbove")}
            </button>
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left hover:bg-muted"
              onClick={() => {
                onInsertTableRow("below");
                onClose();
              }}
            >
              {t("pptx.contextMenu.insertRowBelow")}
            </button>
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left hover:bg-muted"
              onClick={() => {
                onDeleteTableRow();
                onClose();
              }}
            >
              {t("pptx.contextMenu.deleteRow")}
            </button>
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left hover:bg-muted"
              onClick={() => {
                onInsertTableColumn("left");
                onClose();
              }}
            >
              {t("pptx.contextMenu.insertColumnLeft")}
            </button>
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left hover:bg-muted"
              onClick={() => {
                onInsertTableColumn("right");
                onClose();
              }}
            >
              {t("pptx.contextMenu.insertColumnRight")}
            </button>
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left hover:bg-muted"
              onClick={() => {
                onDeleteTableColumn();
                onClose();
              }}
            >
              {t("pptx.contextMenu.deleteColumn")}
            </button>
            {/* Merge / Split */}
            <div className="my-1 border-t border-border" />
            {hasMultiCellSelection && onMergeSelectedCells && (
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left hover:bg-muted"
                onClick={() => {
                  onMergeSelectedCells();
                  onClose();
                }}
              >
                {t("pptx.contextMenu.mergeSelectedCells")}
              </button>
            )}
            {!hasMultiCellSelection && !isMergedCell && onMergeCellRight && (
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left hover:bg-muted"
                onClick={() => {
                  onMergeCellRight();
                  onClose();
                }}
              >
                {t("pptx.contextMenu.mergeCells")}
              </button>
            )}
            {!hasMultiCellSelection && !isMergedCell && onMergeCellDown && (
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left hover:bg-muted"
                onClick={() => {
                  onMergeCellDown();
                  onClose();
                }}
              >
                {t("pptx.table.mergeDown")}
              </button>
            )}
            {isMergedCell && onSplitCell && (
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left hover:bg-muted"
                onClick={() => {
                  onSplitCell();
                  onClose();
                }}
              >
                {t("pptx.contextMenu.splitCell")}
              </button>
            )}
          </>
        )}
        <div className="my-1 border-t border-border" />
        {hasMultiSelection && (
          <button
            type="button"
            className="w-full px-3 py-1.5 text-left hover:bg-muted"
            onClick={() => {
              onAction("group");
              onClose();
            }}
          >
            {t("pptx.contextMenu.group")}
          </button>
        )}
        {selectedElement?.type === "group" && (
          <button
            type="button"
            className="w-full px-3 py-1.5 text-left hover:bg-muted"
            onClick={() => {
              onAction("ungroup");
              onClose();
            }}
          >
            {t("pptx.contextMenu.ungroup")}
          </button>
        )}
        <button
          type="button"
          className="w-full px-3 py-1.5 text-left text-red-300 hover:bg-red-900/40"
          onClick={() => onAction("delete")}
        >
          {t("pptx.contextMenu.delete")}
        </button>
      </div>
    </>
  );
}
