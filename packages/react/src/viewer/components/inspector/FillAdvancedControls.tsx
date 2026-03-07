import React from "react";

import type { ShapeStyle } from "pptx-viewer-core";
import { DEFAULT_FILL_COLOR } from "../../constants";
import { normalizeHexColor } from "../../utils";
import { getPatternSvg } from "../../utils/color";
import {
  type GradientStop,
  SEL,
  LBL,
  RNG,
  COL2,
  SelectRow,
  ColorPickerRow,
  GradientStopRow,
  GRADIENT_TYPE_OPTIONS,
  IMAGE_MODE_OPTIONS,
  PATTERN_PRESET_OPTIONS,
} from "./FillStrokeHelpers";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FillAdvancedControlsProps {
  style: ShapeStyle | undefined;
  gradientStops: GradientStop[];
  showGradient: boolean;
  gradType: string;
  isLine: boolean;
  onUpdateShapeStyle: (updates: Partial<ShapeStyle>) => void;
  onUpdateGradientStops: (stops: GradientStop[]) => void;
  onSetFillColor: (color: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FillAdvancedControls({
  style,
  gradientStops,
  showGradient,
  gradType,
  isLine,
  onUpdateShapeStyle,
  onUpdateGradientStops,
  onSetFillColor: _onSetFillColor,
}: FillAdvancedControlsProps): React.ReactElement {
  return (
    <>
      {/* Gradient controls */}
      {showGradient && (
        <>
          <SelectRow
            label="Gradient Type"
            span2
            value={gradType}
            options={GRADIENT_TYPE_OPTIONS}
            onChange={(v) =>
              onUpdateShapeStyle({
                fillMode: "gradient",
                fillGradientType: v as "linear" | "radial",
              })
            }
          />

          {gradType === "linear" && (
            <label className={`flex flex-col gap-1 ${COL2}`}>
              <span className={LBL}>Gradient Angle</span>
              <input
                type="range"
                min={0}
                max={360}
                value={Math.round(style?.fillGradientAngle ?? 90)}
                onChange={(e) =>
                  onUpdateShapeStyle({
                    fillMode: "gradient",
                    fillGradientAngle: Number(e.target.value),
                  })
                }
                className={RNG}
              />
            </label>
          )}

          <div
            className={`${COL2} space-y-1.5 rounded border border-border p-2`}
          >
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Gradient Stops
            </div>
            {gradientStops.map((stop, i) => (
              <GradientStopRow
                key={`gradient-stop-${i}`}
                stop={stop}
                index={i}
                total={gradientStops.length}
                allStops={gradientStops}
                onUpdate={onUpdateGradientStops}
              />
            ))}
            <button
              type="button"
              className="inline-flex items-center justify-center rounded bg-muted px-2 py-1 text-[11px] hover:bg-accent"
              onClick={() =>
                onUpdateGradientStops([
                  ...gradientStops,
                  {
                    color: normalizeHexColor(
                      style?.fillColor,
                      DEFAULT_FILL_COLOR,
                    ),
                    position: 50,
                    opacity: 1,
                  },
                ])
              }
            >
              Add Stop
            </button>
          </div>
        </>
      )}

      {/* Pattern Fill controls */}
      {style?.fillMode === "pattern" && (
        <>
          <div className={`${COL2} flex flex-col gap-2`}>
            <span className={LBL}>Pattern</span>
            <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto rounded border border-border p-2">
              {PATTERN_PRESET_OPTIONS.map((opt) => {
                const fgColor = normalizeHexColor(
                  style?.fillColor,
                  DEFAULT_FILL_COLOR,
                );
                const bgColor = normalizeHexColor(
                  style?.fillPatternBackgroundColor,
                  "#ffffff",
                );
                const svgPattern = getPatternSvg(opt.value, fgColor, bgColor);
                const isSelected =
                  (style.fillPatternPreset || "pct20") === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    title={opt.label}
                    className={`h-8 w-8 rounded border transition-all ${
                      isSelected
                        ? "border-primary border-2 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() =>
                      onUpdateShapeStyle({
                        fillMode: "pattern",
                        fillPatternPreset: opt.value,
                      })
                    }
                  >
                    {svgPattern && (
                      <div
                        className="w-full h-full rounded-sm"
                        style={{
                          backgroundImage: `url('data:image/svg+xml;utf8,${encodeURIComponent(svgPattern)}')`,
                          backgroundRepeat: "repeat",
                          backgroundSize: "8px 8px",
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <ColorPickerRow
            label="Foreground Color"
            prefix="pattern-fg"
            value={normalizeHexColor(style?.fillColor, DEFAULT_FILL_COLOR)}
            disabled={isLine}
            onChange={(color) =>
              onUpdateShapeStyle({ fillMode: "pattern", fillColor: color })
            }
          />
          <ColorPickerRow
            label="Background Color"
            prefix="pattern-bg"
            value={normalizeHexColor(
              style?.fillPatternBackgroundColor,
              "#ffffff",
            )}
            disabled={isLine}
            onChange={(color) =>
              onUpdateShapeStyle({
                fillMode: "pattern",
                fillPatternBackgroundColor: color,
              })
            }
          />
        </>
      )}

      {/* Image / Texture Fill */}
      {style?.fillMode === "image" && (
        <div className={`${COL2} space-y-2`}>
          <label className="flex flex-col gap-1">
            <span className={LBL}>Image URL</span>
            <input
              type="text"
              placeholder="https://example.com/image.png"
              value={style?.fillImageUrl || ""}
              onChange={(e) =>
                onUpdateShapeStyle({ fillImageUrl: e.target.value })
              }
              className={`${SEL} text-xs`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LBL}>Or choose a file</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () =>
                  onUpdateShapeStyle({ fillImageUrl: reader.result as string });
                reader.readAsDataURL(file);
              }}
              className="text-xs text-foreground file:bg-accent file:border-0 file:rounded file:px-2 file:py-1 file:text-xs file:text-foreground file:mr-2"
            />
          </label>
          <SelectRow
            label="Image Mode"
            value={style?.fillImageMode || "stretch"}
            options={IMAGE_MODE_OPTIONS}
            onChange={(v) =>
              onUpdateShapeStyle({ fillImageMode: v as "stretch" | "tile" })
            }
          />
          {style?.fillImageUrl && (
            <div className="mt-1 rounded border border-border overflow-hidden h-16">
              <img
                src={style.fillImageUrl}
                alt="Fill preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
