import React from "react";

import type { PptxElement } from "pptx-viewer-core";
import { hasShapeProperties } from "pptx-viewer-core";
import {
  SHAPE_PRESETS,
  CONNECTOR_GEOMETRY_OPTIONS,
  SHAPE_ADJUSTMENT_MIN,
  SHAPE_ADJUSTMENT_MAX,
  DEFAULT_ROUND_RECT_ADJUSTMENT,
} from "../../constants";
import { clampShapeAdjustmentValue } from "../../utils";
import { SELECT_CLS } from "./element-properties-constants";

interface ShapeTypeSectionProps {
  elType: string;
  shapeType: string | undefined;
  selectedElement: PptxElement;
  isUnknownShape: boolean;
  showRoundness: boolean;
  onShapeTypeChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  updateElement: (updater: (el: PptxElement) => PptxElement) => void;
}

export function ShapeTypeSection({
  elType,
  shapeType,
  selectedElement,
  isUnknownShape,
  showRoundness,
  onShapeTypeChange,
  updateElement,
}: ShapeTypeSectionProps): React.ReactElement {
  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">Shape Type</span>
        <select
          value={
            elType === "connector"
              ? shapeType || "straightConnector1"
              : shapeType || "rect"
          }
          onChange={onShapeTypeChange}
          className={SELECT_CLS}
        >
          {elType === "connector"
            ? CONNECTOR_GEOMETRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))
            : SHAPE_PRESETS.filter((p) => p.type !== "connector").map((p) => (
                <option key={p.type} value={p.type}>
                  {p.label}
                </option>
              ))}
          {isUnknownShape ? (
            <option value={shapeType}>{shapeType}</option>
          ) : null}
        </select>
      </label>

      {showRoundness && (
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Roundness</span>
          <input
            type="range"
            min={SHAPE_ADJUSTMENT_MIN}
            max={SHAPE_ADJUSTMENT_MAX}
            step={500}
            value={Math.round(
              (hasShapeProperties(selectedElement)
                ? selectedElement.shapeAdjustments?.adj
                : undefined) ?? DEFAULT_ROUND_RECT_ADJUSTMENT,
            )}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              updateElement((el) => {
                if (!hasShapeProperties(el)) return el;
                return {
                  ...el,
                  shapeAdjustments: {
                    ...(el.shapeAdjustments || {}),
                    adj: clampShapeAdjustmentValue(v),
                  },
                };
              });
            }}
            className="accent-primary"
          />
        </label>
      )}
    </>
  );
}
