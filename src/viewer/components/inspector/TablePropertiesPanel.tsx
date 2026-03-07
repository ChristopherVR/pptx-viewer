import React from "react";
import { useTranslation } from "react-i18next";

import type {
  PptxElement,
  PptxTableCellStyle,
  TablePptxElement,
} from "../../../core";
import type { TableCellEditorState } from "../../types";
import { TABLE_STYLE_PRESETS } from "../../constants";
import { HEADING, CARD, INPUT, BTN } from "./inspector-pane-constants";
import { TableCellFormattingPanel } from "./TableCellFormattingPanel";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TablePropertiesPanelProps {
  tableElement: TablePptxElement;
  canEdit: boolean;
  onUpdateElement: (updates: Partial<PptxElement>) => void;
  tableEditorState?: TableCellEditorState | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TablePropertiesPanel({
  tableElement,
  canEdit,
  onUpdateElement,
  tableEditorState,
}: TablePropertiesPanelProps): React.ReactElement | null {
  const { t } = useTranslation();
  const td = tableElement.tableData;
  if (!td) return null;

  const rowCount = td.rows.length;
  const colCount = td.columnWidths.length;

  const updateTableData = (patch: Partial<typeof td>) => {
    onUpdateElement({
      tableData: { ...td, ...patch },
    } as Partial<PptxElement>);
  };

  return (
    <>
      {/* Structure & Style Toggles */}
      <div className={CARD}>
        <div className={HEADING}>{t("pptx.table.title")}</div>
        <div className="text-[11px] text-muted-foreground mb-2">
          {t("pptx.table.rowsColumns", { rows: rowCount, cols: colCount })}
        </div>
        <div className="space-y-1">
          {(
            [
              ["bandedRows", "pptx.table.bandedRows"],
              ["firstRowHeader", "pptx.table.headerRow"],
              ["bandedColumns", "pptx.table.bandedColumns"],
              ["firstCol", "pptx.table.firstColumn"],
              ["lastCol", "pptx.table.lastColumn"],
              ["lastRow", "pptx.table.lastRow"],
            ] as const
          ).map(([key, i18nKey]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={Boolean(td[key as keyof typeof td])}
                onChange={(e) => updateTableData({ [key]: e.target.checked })}
                className="accent-primary"
              />
              <span className="text-[11px]">{t(i18nKey)}</span>
            </label>
          ))}
        </div>
        {td.bandedRows && (
          <label className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-muted-foreground">
              {t("pptx.table.bandRowCycle")}
            </span>
            <input
              type="number"
              min={1}
              max={99}
              disabled={!canEdit}
              value={td.bandRowCycle ?? 1}
              onChange={(e) =>
                updateTableData({
                  bandRowCycle: Math.max(1, parseInt(e.target.value, 10) || 1),
                })
              }
              className="w-14 rounded border border-border bg-background px-1 py-0.5 text-[11px]"
            />
          </label>
        )}
        {td.bandedColumns && (
          <label className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-muted-foreground">
              {t("pptx.table.bandColCycle")}
            </span>
            <input
              type="number"
              min={1}
              max={99}
              disabled={!canEdit}
              value={td.bandColCycle ?? 1}
              onChange={(e) =>
                updateTableData({
                  bandColCycle: Math.max(1, parseInt(e.target.value, 10) || 1),
                })
              }
              className="w-14 rounded border border-border bg-background px-1 py-0.5 text-[11px]"
            />
          </label>
        )}
      </div>

      {/* Table Style Presets */}
      <div className={CARD}>
        <div className={HEADING}>{t("pptx.table.stylePresets")}</div>
        <div className="grid grid-cols-3 gap-1.5">
          {TABLE_STYLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={!canEdit}
              title={preset.label}
              className="rounded border border-border hover:border-primary overflow-hidden h-10 transition-colors"
              onClick={() => {
                const newRows = td.rows.map((row, ri) => ({
                  ...row,
                  cells: row.cells.map((cell) => ({
                    ...cell,
                    style: {
                      ...cell.style,
                      backgroundColor:
                        ri === 0 && td.firstRowHeader
                          ? preset.headerBg
                          : td.bandedRows &&
                              (ri - (td.firstRowHeader ? 1 : 0)) % 2 === 0
                            ? preset.bandBg
                            : undefined,
                      color:
                        ri === 0 && td.firstRowHeader
                          ? preset.headerFg
                          : cell.style?.color,
                      bold:
                        ri === 0 && td.firstRowHeader ? true : cell.style?.bold,
                      borderColor: preset.borderColor,
                    } satisfies PptxTableCellStyle,
                  })),
                }));
                updateTableData({ rows: newRows });
              }}
            >
              <div className="flex flex-col h-full">
                <div
                  className="flex-1"
                  style={{ backgroundColor: preset.headerBg }}
                />
                <div
                  className="flex-1"
                  style={{ backgroundColor: preset.bandBg }}
                />
                <div
                  className="flex-1 border-t"
                  style={{ borderColor: preset.borderColor }}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Column Widths */}
      <div className={CARD}>
        <div className="flex items-center justify-between mb-1">
          <div className={HEADING}>{t("pptx.table.columnWidths")}</div>
          <button
            type="button"
            className={BTN}
            disabled={!canEdit}
            onClick={() => {
              const even = 1 / colCount;
              updateTableData({
                columnWidths: Array(colCount).fill(even) as number[],
              });
            }}
          >
            {t("pptx.table.even")}
          </button>
        </div>
        <div className="space-y-1">
          {td.columnWidths.map((w, ci) => (
            <label key={ci} className="flex items-center gap-2 text-[11px]">
              <span className="w-6 text-muted-foreground shrink-0">
                {ci + 1}
              </span>
              <input
                type="range"
                disabled={!canEdit}
                min={5}
                max={80}
                value={Math.round(w * 100)}
                className="flex-1 accent-primary"
                onChange={(e) => {
                  const newPct = Number(e.target.value) / 100;
                  const oldPct = td.columnWidths[ci];
                  const diff = newPct - oldPct;
                  const newWidths = [...td.columnWidths];
                  newWidths[ci] = newPct;
                  const othersTotal = 1 - oldPct;
                  if (othersTotal > 0) {
                    for (let j = 0; j < newWidths.length; j++) {
                      if (j !== ci) {
                        newWidths[j] = Math.max(
                          0.05,
                          td.columnWidths[j] -
                            diff * (td.columnWidths[j] / othersTotal),
                        );
                      }
                    }
                  }
                  const sum = newWidths.reduce((a, b) => a + b, 0);
                  const normed = newWidths.map((v) => v / sum);
                  updateTableData({ columnWidths: normed });
                }}
              />
              <span className="w-10 text-right text-muted-foreground">
                {Math.round(w * 100)}%
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Row Heights */}
      <div className={CARD}>
        <div className="flex items-center justify-between mb-1">
          <div className={HEADING}>{t("pptx.table.rowHeights")}</div>
          <button
            type="button"
            className={BTN}
            disabled={!canEdit}
            onClick={() => {
              const avg = Math.round(
                td.rows.reduce((s, r) => s + (r.height ?? 32), 0) / rowCount,
              );
              updateTableData({
                rows: td.rows.map((r) => ({ ...r, height: avg })),
              });
            }}
          >
            {t("pptx.table.even")}
          </button>
        </div>
        <div className="space-y-1">
          {td.rows.map((row, ri) => (
            <label key={ri} className="flex items-center gap-2 text-[11px]">
              <span className="w-6 text-muted-foreground shrink-0">
                {ri + 1}
              </span>
              <input
                type="number"
                disabled={!canEdit}
                className={INPUT}
                min={16}
                max={500}
                value={row.height ?? 32}
                onChange={(e) => {
                  const newRows = td.rows.map((r, i) =>
                    i === ri ? { ...r, height: Number(e.target.value) } : r,
                  );
                  updateTableData({ rows: newRows });
                }}
              />
              <span className="w-6 text-muted-foreground">px</span>
            </label>
          ))}
        </div>
      </div>

      {/* Selected Cell Formatting */}
      {tableEditorState && (
        <TableCellFormattingPanel
          tableData={td}
          tableEditorState={tableEditorState}
          canEdit={canEdit}
          onUpdateTableData={updateTableData}
        />
      )}
    </>
  );
}
