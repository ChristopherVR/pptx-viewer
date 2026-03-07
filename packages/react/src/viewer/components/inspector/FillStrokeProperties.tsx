import React from "react";

import { DEFAULT_FILL_COLOR } from "../../constants";
import { normalizeHexColor, sanitizeGradientStops } from "../../utils";
import {
  type FillStrokePropertiesProps,
  type GradientStop,
  isLineish,
  SelectRow,
  ColorPickerRow,
  FILL_MODE_OPTIONS,
} from "./FillStrokeHelpers";
import { FillAdvancedControls } from "./FillAdvancedControls";
import { QuickStylesGallery } from "./QuickStylesGallery";
import { StrokeEffectsSection } from "./StrokeEffectsSection";

export type { FillStrokePropertiesProps };

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Inspector panel for editing the fill and stroke properties of shapes and text elements.
 *
 * Supports multiple fill modes (solid, gradient, pattern, image, none) and manages
 * the transitions between them. Renders sub-sections for:
 * - Quick style presets (for shapes/text)
 * - Fill mode selector and color picker
 * - Advanced gradient, pattern, and image fill controls
 * - Stroke color, width, line join/cap, and effects
 *
 * @param props - {@link FillStrokePropertiesProps}
 * @returns The fill/stroke inspector panel.
 */
export function FillStrokeProperties({
  selectedElement,
  selectedShapeStyle,
  selectedShapeType,
  selectedGradientStops,
  recentColors,
  onUpdateShapeStyle,
  onSetFillColor,
  onSetStrokeColor,
}: FillStrokePropertiesProps): React.ReactElement {
  // Lines (and line-like shapes) have fill disabled since they have no area to fill
  const line = isLineish(selectedElement, selectedShapeType);
  const style = selectedShapeStyle;

  /**
   * Handles fill mode transitions. Each mode requires specific default
   * properties to be set: gradient needs stops, pattern needs preset/background,
   * image needs a stretch mode, and "none" sets transparent fill.
   */
  const handleFillModeChange = (nextMode: string): void => {
    if (nextMode === "none") {
      onUpdateShapeStyle({ fillMode: "none", fillColor: "transparent" });
      return;
    }
    if (nextMode === "image") {
      onUpdateShapeStyle({
        fillMode: "image",
        fillImageMode: style?.fillImageMode || "stretch",
      });
      return;
    }
    if (nextMode === "gradient") {
      const existing = sanitizeGradientStops(style?.fillGradientStops);
      const stops =
        existing.length >= 2
          ? existing
          : [
              {
                color: normalizeHexColor(style?.fillColor, DEFAULT_FILL_COLOR),
                position: 0,
                opacity: 1,
              },
              { color: "#ffffff", position: 100, opacity: 1 },
            ];
      onUpdateShapeStyle({
        fillMode: "gradient",
        fillGradientType: style?.fillGradientType || "linear",
        fillGradientAngle: style?.fillGradientAngle ?? 90,
        fillGradientStops: stops,
      });
      return;
    }
    if (nextMode === "pattern") {
      onUpdateShapeStyle({
        fillMode: "pattern",
        fillPatternPreset: style?.fillPatternPreset || "pct20",
        fillPatternBackgroundColor:
          style?.fillPatternBackgroundColor || "#ffffff",
      });
      return;
    }
    onUpdateShapeStyle({ fillMode: "solid" });
  };

  // Fall back to a two-stop default gradient (primary fill color to white)
  // when no gradient stops have been configured yet
  const gradientStops: GradientStop[] =
    selectedGradientStops.length > 0
      ? selectedGradientStops
      : [
          { color: DEFAULT_FILL_COLOR, position: 0 },
          { color: "#ffffff", position: 100 },
        ];

  const showGradient =
    style?.fillMode === "gradient" || selectedGradientStops.length > 0;
  const gradType = style?.fillGradientType || "linear";

  const updateGradientStops = (stops: GradientStop[]): void => {
    onUpdateShapeStyle({ fillMode: "gradient", fillGradientStops: stops });
  };

  const showQuickStyles =
    selectedElement.type === "shape" || selectedElement.type === "text";

  return (
    <>
      {showQuickStyles && (
        <QuickStylesGallery onUpdateShapeStyle={onUpdateShapeStyle} />
      )}

      <div className="grid grid-cols-2 gap-2">
        {/* Fill Mode */}
        <SelectRow
          label="Fill Mode"
          span2
          value={
            style?.fillMode ||
            (style?.fillColor === "transparent" ? "none" : "solid")
          }
          options={FILL_MODE_OPTIONS}
          onChange={handleFillModeChange}
        />

        {/* Fill Color */}
        <ColorPickerRow
          label="Fill"
          prefix="fill"
          value={normalizeHexColor(style?.fillColor, DEFAULT_FILL_COLOR)}
          disabled={line}
          onChange={onSetFillColor}
        />

        {/* Gradient / Pattern / Image controls */}
        <FillAdvancedControls
          style={style}
          gradientStops={gradientStops}
          showGradient={showGradient}
          gradType={gradType}
          isLine={line}
          onUpdateShapeStyle={onUpdateShapeStyle}
          onUpdateGradientStops={updateGradientStops}
          onSetFillColor={onSetFillColor}
        />

        {/* Stroke, effects, line join/cap */}
        <StrokeEffectsSection
          style={style}
          isLine={line}
          recentColors={recentColors}
          onUpdateShapeStyle={onUpdateShapeStyle}
          onSetStrokeColor={onSetStrokeColor}
        />
      </div>
    </>
  );
}
