import React from "react";
import { useTranslation } from "react-i18next";

import type { PptxTableCellStyle } from "../../../core";
import {
  FILL_MODE_OPTIONS,
  GRADIENT_TYPE_OPTIONS,
  LBL,
  NUM,
  PATTERN_OPTIONS,
  SECTION_HEADING,
  SEL,
} from "./table-cell-advanced-fill-constants";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TableCellAdvancedFillProps {
  cellStyle: PptxTableCellStyle;
  canEdit: boolean;
  onUpdateCellStyle: (updates: Partial<PptxTableCellStyle>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TableCellAdvancedFill({
  cellStyle,
  canEdit,
  onUpdateCellStyle,
}: TableCellAdvancedFillProps): React.ReactElement {
  const { t } = useTranslation();
  const fillMode = cellStyle.fillMode ?? "solid";

  const handleFillModeChange = (mode: string): void => {
    const next = mode as PptxTableCellStyle["fillMode"];
    if (next === "gradient") {
      onUpdateCellStyle({
        fillMode: "gradient",
        gradientFillType: cellStyle.gradientFillType ?? "linear",
        gradientFillAngle: cellStyle.gradientFillAngle ?? 90,
        gradientFillStops: cellStyle.gradientFillStops ?? [
          { color: "#FF0000", position: 0 },
          { color: "#0000FF", position: 100 },
        ],
      });
    } else if (next === "pattern") {
      onUpdateCellStyle({
        fillMode: "pattern",
        patternFillPreset: cellStyle.patternFillPreset ?? "ltDnDiag",
        patternFillForeground: cellStyle.patternFillForeground ?? "#000000",
        patternFillBackground: cellStyle.patternFillBackground ?? "#FFFFFF",
      });
    } else {
      onUpdateCellStyle({ fillMode: next });
    }
  };

  return (
    <div className="space-y-2">
      {/* Fill Type Picker */}
      <label className="flex flex-col gap-1">
        <span className={LBL}>{t("pptx.table.fillMode")}</span>
        <select
          disabled={!canEdit}
          className={SEL}
          value={fillMode}
          onChange={(e) => handleFillModeChange(e.target.value)}
        >
          {FILL_MODE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value ?? ""}>
              {t(opt.i18nKey)}
            </option>
          ))}
        </select>
      </label>

      {/* Gradient Controls */}
      {fillMode === "gradient" && (
        <GradientControls
          cellStyle={cellStyle}
          canEdit={canEdit}
          onUpdateCellStyle={onUpdateCellStyle}
        />
      )}

      {/* Pattern Controls */}
      {fillMode === "pattern" && (
        <PatternControls
          cellStyle={cellStyle}
          canEdit={canEdit}
          onUpdateCellStyle={onUpdateCellStyle}
        />
      )}

      {/* Cell Margins */}
      <div className="space-y-1">
        <span className={SECTION_HEADING}>{t("pptx.table.margins")}</span>
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              ["marginTop", "pptx.table.marginTop"],
              ["marginBottom", "pptx.table.marginBottom"],
              ["marginLeft", "pptx.table.marginLeft"],
              ["marginRight", "pptx.table.marginRight"],
            ] as const
          ).map(([key, i18nKey]) => (
            <label key={key} className="flex flex-col gap-0.5">
              <span className={LBL}>{t(i18nKey)}</span>
              <input
                type="number"
                disabled={!canEdit}
                className={NUM}
                min={0}
                max={200}
                value={cellStyle[key] ?? 0}
                onChange={(e) =>
                  onUpdateCellStyle({
                    [key]: Number(e.target.value),
                  })
                }
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gradient sub-controls
// ---------------------------------------------------------------------------

function GradientControls({
  cellStyle,
  canEdit,
  onUpdateCellStyle,
}: TableCellAdvancedFillProps): React.ReactElement {
  const { t } = useTranslation();
  const stops = cellStyle.gradientFillStops ?? [];
  const gradType = cellStyle.gradientFillType ?? "linear";

  const updateStop = (
    index: number,
    patch: Partial<{ color: string; position: number }>,
  ): void => {
    const next = stops.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onUpdateCellStyle({ gradientFillStops: next });
  };

  const addStop = (): void => {
    onUpdateCellStyle({
      gradientFillStops: [...stops, { color: "#888888", position: 50 }],
    });
  };

  return (
    <div className="space-y-1.5">
      {/* Type + Angle */}
      <div className="grid grid-cols-2 gap-1.5">
        <label className="flex flex-col gap-0.5">
          <span className={LBL}>{t("pptx.table.gradientType")}</span>
          <select
            disabled={!canEdit}
            className={SEL}
            value={gradType}
            onChange={(e) =>
              onUpdateCellStyle({
                gradientFillType: e.target.value as "linear" | "radial",
              })
            }
          >
            {GRADIENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.i18nKey)}
              </option>
            ))}
          </select>
        </label>
        {gradType === "linear" && (
          <label className="flex flex-col gap-0.5">
            <span className={LBL}>{t("pptx.table.gradientAngle")}</span>
            <input
              type="number"
              disabled={!canEdit}
              className={NUM}
              min={0}
              max={360}
              value={cellStyle.gradientFillAngle ?? 90}
              onChange={(e) =>
                onUpdateCellStyle({
                  gradientFillAngle: Number(e.target.value),
                })
              }
            />
          </label>
        )}
      </div>

      {/* Colour Stops */}
      <span className={LBL}>{t("pptx.table.gradientStops")}</span>
      {stops.map((stop, idx) => (
        <div key={idx} className="flex items-center gap-1">
          <input
            type="color"
            disabled={!canEdit}
            className="h-6 w-6 rounded border border-border cursor-pointer"
            value={stop.color}
            onChange={(e) => updateStop(idx, { color: e.target.value })}
          />
          <input
            type="number"
            disabled={!canEdit}
            className={NUM}
            min={0}
            max={100}
            value={Math.round(stop.position)}
            onChange={(e) =>
              updateStop(idx, {
                position: Number(e.target.value),
              })
            }
          />
          <span className="text-[10px] text-muted-foreground">%</span>
        </div>
      ))}
      <button
        type="button"
        disabled={!canEdit}
        className="text-[10px] text-primary hover:underline"
        onClick={addStop}
      >
        {t("pptx.table.gradientAddStop")}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pattern sub-controls
// ---------------------------------------------------------------------------

function PatternControls({
  cellStyle,
  canEdit,
  onUpdateCellStyle,
}: TableCellAdvancedFillProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div className="space-y-1.5">
      <label className="flex flex-col gap-0.5">
        <span className={LBL}>{t("pptx.table.patternPreset")}</span>
        <select
          disabled={!canEdit}
          className={SEL}
          value={cellStyle.patternFillPreset ?? "ltDnDiag"}
          onChange={(e) =>
            onUpdateCellStyle({
              patternFillPreset: e.target.value,
            })
          }
        >
          {PATTERN_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-1.5">
        <label className="flex flex-col gap-0.5">
          <span className={LBL}>{t("pptx.table.patternForeground")}</span>
          <input
            type="color"
            disabled={!canEdit}
            className="w-full h-7 rounded border border-border bg-transparent cursor-pointer"
            value={cellStyle.patternFillForeground ?? "#000000"}
            onChange={(e) =>
              onUpdateCellStyle({
                patternFillForeground: e.target.value,
              })
            }
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className={LBL}>{t("pptx.table.patternBackground")}</span>
          <input
            type="color"
            disabled={!canEdit}
            className="w-full h-7 rounded border border-border bg-transparent cursor-pointer"
            value={cellStyle.patternFillBackground ?? "#FFFFFF"}
            onChange={(e) =>
              onUpdateCellStyle({
                patternFillBackground: e.target.value,
              })
            }
          />
        </label>
      </div>
    </div>
  );
}
