import React from "react";
import { useTranslation } from "react-i18next";

import type { PptxTableCellStyle } from "../../../core";
import { OOXML_PATTERN_PRESETS } from "../../utils/color";

// ---------------------------------------------------------------------------
// Shared CSS
// ---------------------------------------------------------------------------

const SEL =
  "bg-muted border border-border rounded px-2 py-1 text-[11px] w-full";
const NUM =
  "flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full text-[11px]";
const LBL = "text-muted-foreground text-[11px]";

// ---------------------------------------------------------------------------
// Gradient type options
// ---------------------------------------------------------------------------

const GRADIENT_TYPE_OPTIONS: Array<{ value: string; i18nKey: string }> = [
  { value: "linear", i18nKey: "pptx.table.gradientLinear" },
  { value: "radial", i18nKey: "pptx.table.gradientRadial" },
];

const PATTERN_OPTIONS = OOXML_PATTERN_PRESETS.slice(0, 20);

// ---------------------------------------------------------------------------
// Gradient sub-controls
// ---------------------------------------------------------------------------

interface SubControlProps {
  cellStyle: PptxTableCellStyle;
  canEdit: boolean;
  onUpdateCellStyle: (updates: Partial<PptxTableCellStyle>) => void;
}

export function GradientControls({
  cellStyle,
  canEdit,
  onUpdateCellStyle,
}: SubControlProps): React.ReactElement {
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
                onUpdateCellStyle({ gradientFillAngle: Number(e.target.value) })
              }
            />
          </label>
        )}
      </div>

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
              updateStop(idx, { position: Number(e.target.value) })
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

export function PatternControls({
  cellStyle,
  canEdit,
  onUpdateCellStyle,
}: SubControlProps): React.ReactElement {
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
            onUpdateCellStyle({ patternFillPreset: e.target.value })
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
              onUpdateCellStyle({ patternFillForeground: e.target.value })
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
              onUpdateCellStyle({ patternFillBackground: e.target.value })
            }
          />
        </label>
      </div>
    </div>
  );
}
