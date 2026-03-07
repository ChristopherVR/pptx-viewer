import React from "react";
import { useTranslation } from "react-i18next";

import type { ShapeStyle, StrokeDashType } from "../../../core";
import { STROKE_DASH_OPTIONS, DEFAULT_STROKE_COLOR } from "../../constants";
import { normalizeHexColor } from "../../utils";
import {
  NUM,
  RNG,
  DIS,
  LBL,
  COL2,
  safeNum,
  SelectRow,
  ColorPickerRow,
  EffectField,
  EFFECT_CONFIGS,
  COMPOUND_LINE_OPTIONS,
  LINE_JOIN_OPTIONS,
  LINE_CAP_OPTIONS,
  getCompoundLinePreviewStyle,
} from "./FillStrokeHelpers";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StrokeEffectsSectionProps {
  style: ShapeStyle | undefined;
  isLine: boolean;
  recentColors: string[];
  onUpdateShapeStyle: (updates: Partial<ShapeStyle>) => void;
  onSetStrokeColor: (color: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StrokeEffectsSection({
  style,
  isLine,
  recentColors,
  onUpdateShapeStyle,
  onSetStrokeColor,
}: StrokeEffectsSectionProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <>
      {/* Stroke color + swatches + recent colors */}
      <ColorPickerRow
        label="Stroke"
        prefix="stroke"
        value={normalizeHexColor(style?.strokeColor, DEFAULT_STROKE_COLOR)}
        recentColors={recentColors}
        onChange={onSetStrokeColor}
      />

      {/* Stroke Width */}
      <label className="flex flex-col gap-1">
        <span className={LBL}>Stroke Width</span>
        <input
          type="number"
          min={0}
          value={Math.round(style?.strokeWidth || 0)}
          onChange={(e) => {
            const v = safeNum(e.target.value, 0);
            onUpdateShapeStyle({ strokeWidth: Math.max(0, v) });
          }}
          className={NUM}
        />
      </label>

      {/* Fill Opacity */}
      <label className="flex flex-col gap-1">
        <span className={LBL}>Fill Opacity</span>
        <input
          type="range"
          min={0}
          max={100}
          disabled={isLine}
          value={Math.round((style?.fillOpacity ?? 1) * 100)}
          onChange={(e) =>
            onUpdateShapeStyle({ fillOpacity: Number(e.target.value) / 100 })
          }
          className={`${RNG} ${DIS}`}
        />
      </label>

      {/* Stroke Opacity */}
      <label className="flex flex-col gap-1">
        <span className={LBL}>Stroke Opacity</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round((style?.strokeOpacity ?? 1) * 100)}
          onChange={(e) =>
            onUpdateShapeStyle({
              strokeOpacity: Number(e.target.value) / 100,
            })
          }
          className={RNG}
        />
      </label>

      {/* Stroke Dash */}
      <label className={`flex flex-col gap-1 ${COL2}`}>
        <span className={LBL}>Stroke Dash</span>
        <select
          value={style?.strokeDash || "solid"}
          onChange={(e) =>
            onUpdateShapeStyle({
              strokeDash: e.target.value as StrokeDashType,
            })
          }
          className="bg-muted border border-border rounded px-2 py-1"
        >
          {STROKE_DASH_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {/* Compound Line with visual preview */}
      <label className={`flex flex-col gap-1 ${COL2}`}>
        <span className={LBL}>Compound Line</span>
        <div className="grid grid-cols-5 gap-1">
          {COMPOUND_LINE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              title={opt.label}
              className={`h-10 px-2 rounded border transition-all ${
                (style?.compoundLine || "sng") === opt.value
                  ? "border-primary bg-accent"
                  : "border-border hover:border-primary/50"
              }`}
              onClick={() =>
                onUpdateShapeStyle({
                  compoundLine: opt.value as NonNullable<
                    ShapeStyle["compoundLine"]
                  >,
                })
              }
            >
              <div
                className="w-full h-full flex items-center justify-center"
                style={getCompoundLinePreviewStyle(opt.value)}
              />
            </button>
          ))}
        </div>
      </label>

      {/* Effects: Shadow, Glow, Soft Edge, Reflection, Blur, Bevel/3D */}
      {EFFECT_CONFIGS.map((cfg) => {
        const on = cfg.isOn(style);
        return (
          <React.Fragment key={cfg.label}>
            <label
              className={`inline-flex items-center gap-2 text-foreground ${COL2}`}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={(e) => {
                  onUpdateShapeStyle(
                    e.target.checked
                      ? cfg.onEnable(style)
                      : cfg.onDisable(style),
                  );
                }}
              />
              {cfg.i18nKey ? t(cfg.i18nKey) : cfg.label}
            </label>
            {on &&
              cfg.fields.map((f) => (
                <EffectField
                  key={f.key}
                  field={f}
                  style={style}
                  onUpdate={onUpdateShapeStyle}
                />
              ))}
          </React.Fragment>
        );
      })}

      {/* Line Join / Cap */}
      <SelectRow
        label="Line Join"
        value={style?.lineJoin || "round"}
        options={LINE_JOIN_OPTIONS}
        onChange={(v) =>
          onUpdateShapeStyle({ lineJoin: v as "round" | "bevel" | "miter" })
        }
      />

      <SelectRow
        label="Line Cap"
        value={style?.lineCap || "flat"}
        options={LINE_CAP_OPTIONS}
        onChange={(v) =>
          onUpdateShapeStyle({ lineCap: v as "flat" | "rnd" | "sq" })
        }
      />
    </>
  );
}
