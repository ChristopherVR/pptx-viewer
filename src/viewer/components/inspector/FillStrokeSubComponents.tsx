import React from "react";
import { LuPipette } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import type { ShapeStyle } from "../../../core";
import { THEME_COLOR_SWATCHES } from "../../constants";
import { normalizeHexColor, useNativeEyeDropper } from "../../utils";
import type { EffectToggleCfg } from "./fill-stroke-effect-configs";
import {
  SEL,
  NUM,
  RNG,
  SWATCH,
  DIS,
  LBL,
  COL2,
  safeNum,
  type GradientStop,
} from "./FillStrokeHelpers";

// ---------------------------------------------------------------------------
// SelectRow
// ---------------------------------------------------------------------------

/** Render a simple <select> row. */
export const SelectRow: React.FC<{
  label: string;
  value: string;
  span2?: boolean;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}> = ({ label, value, span2, options, onChange }) => (
  <label className={`flex flex-col gap-1 ${span2 ? COL2 : ""}`}>
    <span className={LBL}>{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={SEL}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

// ---------------------------------------------------------------------------
// ColorPickerRow
// ---------------------------------------------------------------------------

/** Color picker + theme swatches + recent colors + eyedropper. */
export const ColorPickerRow: React.FC<{
  label: string;
  value: string;
  disabled?: boolean;
  prefix: string;
  recentColors?: string[];
  onChange: (c: string) => void;
}> = ({ label, value, disabled, prefix, recentColors, onChange }) => {
  const handleEyedropper = async (): Promise<void> => {
    const color = await useNativeEyeDropper();
    if (color) onChange(color);
  };

  return (
    <label className="flex flex-col gap-1">
      <span className={LBL}>{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="color"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`h-8 flex-1 ${SEL} px-1 ${DIS}`}
        />
        <button
          type="button"
          disabled={disabled}
          className="h-8 w-8 flex items-center justify-center rounded border border-border bg-muted hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Eyedropper — pick colour from screen"
          onClick={(e) => {
            e.preventDefault();
            void handleEyedropper();
          }}
        >
          <LuPipette className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {THEME_COLOR_SWATCHES.map((c) => (
          <button
            key={`${prefix}-theme-${c}`}
            type="button"
            className={`${SWATCH} ${DIS}`}
            style={{ backgroundColor: c }}
            title={`${label} ${c}`}
            disabled={disabled}
            onClick={() => onChange(c)}
          />
        ))}
        {recentColors?.map((c) => (
          <button
            key={`${prefix}-recent-${c}`}
            type="button"
            className="h-4 w-4 rounded border border-primary"
            style={{ backgroundColor: c }}
            title={`Recent ${c}`}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
    </label>
  );
};

// ---------------------------------------------------------------------------
// GradientStopRow
// ---------------------------------------------------------------------------

/** A single gradient stop row. */
export const GradientStopRow: React.FC<{
  stop: GradientStop;
  index: number;
  total: number;
  onUpdate: (stops: GradientStop[]) => void;
  allStops: GradientStop[];
}> = ({ stop, index, total, onUpdate, allStops }) => {
  const patchStop = (patch: Partial<GradientStop>): void => {
    const next = allStops.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onUpdate(next);
  };
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[auto,1fr,auto] items-center gap-2">
        <input
          type="color"
          value={normalizeHexColor(stop.color, "#3b82f6")}
          onChange={(e) =>
            patchStop({ color: normalizeHexColor(e.target.value, "#3b82f6") })
          }
          className="h-7 w-10 rounded border border-border bg-muted"
        />
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(stop.position)}
          onChange={(e) => patchStop({ position: Number(e.target.value) })}
          className={RNG}
        />
        <button
          type="button"
          disabled={total <= 2}
          className="rounded bg-muted px-2 py-1 text-[11px] hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => onUpdate(allStops.filter((_, i) => i !== index))}
        >
          Remove
        </button>
      </div>
      <div className="grid grid-cols-[auto,1fr,auto] items-center gap-2 pl-1">
        <span className="text-[10px] text-muted-foreground w-10 text-center">
          Opacity
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round((stop.opacity ?? 1) * 100)}
          onChange={(e) => patchStop({ opacity: Number(e.target.value) / 100 })}
          className={RNG}
        />
        <span className="text-[10px] text-muted-foreground w-[52px] text-right">
          {Math.round((stop.opacity ?? 1) * 100)}%
        </span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// EffectField
// ---------------------------------------------------------------------------

/** Render fields for a togglable effect (shadow, glow, etc.). */
export const EffectField: React.FC<{
  field: EffectToggleCfg["fields"][number];
  style: ShapeStyle | undefined;
  onUpdate: (u: Partial<ShapeStyle>) => void;
}> = ({ field, style, onUpdate }) => {
  const { t } = useTranslation();
  const fieldLabel = field.i18nKey ? t(field.i18nKey) : field.label;
  const val = field.read(style);
  const cls = `flex flex-col gap-1 ${field.span2 ? COL2 : ""}`;
  if (field.type === "select" && field.options) {
    return (
      <label className={cls}>
        <span className={LBL}>{fieldLabel}</span>
        <select
          value={String(val)}
          onChange={(e) => {
            const result = field.write(e.target.value, style);
            onUpdate(typeof result === "function" ? result(style) : result);
          }}
          className={SEL}
        >
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (field.type === "color") {
    return (
      <label className={cls}>
        <span className={LBL}>{fieldLabel}</span>
        <input
          type="color"
          value={String(val)}
          onChange={(e) => {
            const result = field.write(e.target.value, style);
            onUpdate(typeof result === "function" ? result(style) : result);
          }}
          className={`h-8 ${SEL} px-1`}
        />
      </label>
    );
  }
  if (field.type === "checkbox") {
    return (
      <label className={`flex items-center gap-2 ${field.span2 ? COL2 : ""}`}>
        <input
          type="checkbox"
          checked={Boolean(val)}
          onChange={(e) => {
            const result = field.write(e.target.checked, style);
            onUpdate(typeof result === "function" ? result(style) : result);
          }}
          className="h-4 w-4"
        />
        <span className={LBL}>{fieldLabel}</span>
      </label>
    );
  }
  if (field.type === "range") {
    return (
      <label className={cls}>
        <span className={LBL}>{fieldLabel}</span>
        <input
          type="range"
          min={field.min ?? 0}
          max={field.max ?? 100}
          value={Number(val)}
          onChange={(e) => {
            const result = field.write(Number(e.target.value), style);
            onUpdate(typeof result === "function" ? result(style) : result);
          }}
          className={RNG}
        />
      </label>
    );
  }
  return (
    <label className={cls}>
      <span className={LBL}>{fieldLabel}</span>
      <input
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        value={Number(val)}
        onChange={(e) => {
          const n = safeNum(e.target.value, Number(val));
          const result = field.write(n, style);
          onUpdate(typeof result === "function" ? result(style) : result);
        }}
        className={NUM}
      />
    </label>
  );
};
