import React from "react";
import { LuChevronDown, LuChevronUp } from "react-icons/lu";

import type { PptxElement, ShapeStyle } from "../../../core";
import { hasShapeProperties } from "../../../core";
import {
  SHAPE_PRESETS,
  CONNECTOR_GEOMETRY_OPTIONS,
  DEFAULT_FILL_COLOR,
  MIN_ELEMENT_SIZE,
} from "../../constants";
import { getElementLabel } from "../../utils";
import { NUMBER_CLS, BTN_CLS } from "./element-properties-constants";
import { ShapeTypeSection } from "./ShapeTypeSection";
import { ConnectorArrowsSection } from "./ConnectorArrowsSection";
import { ImageCropSection } from "./ImageCropSection";

interface ElementPropertiesProps {
  selectedElement: PptxElement;
  selectedShapeType: string | undefined;
  selectedShapeStyle: ShapeStyle | undefined;
  selectedElementIsTemplate: boolean;
  selectedElementIsImage: boolean;
  canEdit: boolean;
  onUpdateElement: (updates: Partial<PptxElement>) => void;
  onUpdateShapeStyle: (updates: Partial<ShapeStyle>) => void;
  onMoveLayer: (direction: "forward" | "backward") => void;
  onOpenImagePicker: () => void;
  markDirty: () => void;
}

const POS_SIZE_FIELDS = [
  ["X", "x"],
  ["Y", "y"],
  ["Width", "width"],
  ["Height", "height"],
] as const;

export function ElementProperties({
  selectedElement,
  selectedShapeType,
  selectedShapeStyle,
  selectedElementIsTemplate,
  canEdit,
  onUpdateElement,
  onUpdateShapeStyle,
  onMoveLayer,
  onOpenImagePicker,
  markDirty,
}: ElementPropertiesProps): React.ReactElement {
  const canMutate = canEdit && !selectedElementIsTemplate;
  const elType = selectedElement.type;
  const shapeType = hasShapeProperties(selectedElement)
    ? selectedElement.shapeType
    : undefined;

  const updateElement = (updater: (el: PptxElement) => PptxElement): void => {
    const updated = updater(selectedElement);
    if (updated !== selectedElement) {
      const { id: _id, ...rest } = updated;
      onUpdateElement(rest as Partial<PptxElement>);
      markDirty();
    }
  };

  const handleShapeTypeChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ): void => {
    const next = event.target.value;
    if (elType === "connector") {
      onUpdateElement({ shapeType: next } as Partial<PptxElement>);
      markDirty();
      return;
    }
    const existing = hasShapeProperties(selectedElement)
      ? { ...(selectedElement.shapeAdjustments || {}) }
      : {};
    const isLine = next === "line";
    const adj =
      next === "roundRect"
        ? {
            ...existing,
            adj: (existing as Record<string, number>).adj ?? 16667,
          }
        : next === "cylinder" || next === "can"
          ? {
              ...existing,
              adj: (existing as Record<string, number>).adj ?? 25000,
            }
          : undefined;
    updateElement((el) => {
      if (!hasShapeProperties(el)) return el;
      return {
        ...el,
        shapeType: next,
        shapeAdjustments: adj,
        shapeStyle: {
          ...el.shapeStyle,
          fillColor: isLine
            ? "transparent"
            : el.shapeStyle?.fillColor || DEFAULT_FILL_COLOR,
          fillMode: isLine ? "none" : el.shapeStyle?.fillMode || "solid",
          strokeWidth: isLine
            ? Math.max(2, el.shapeStyle?.strokeWidth || 0)
            : el.shapeStyle?.strokeWidth || 1,
        },
      };
    });
  };

  const showShapeSelector =
    elType === "shape" || elType === "text" || elType === "connector";
  const showRoundness =
    (elType === "shape" || elType === "text") &&
    (shapeType === "roundRect" ||
      shapeType === "cylinder" ||
      shapeType === "can");
  const showArrows = elType === "connector" || selectedShapeType === "line";
  const showImage = elType === "picture" || elType === "image";
  const isUnknownShape =
    shapeType &&
    ((elType === "connector" &&
      !CONNECTOR_GEOMETRY_OPTIONS.some((o) => o.value === shapeType)) ||
      (elType !== "connector" &&
        !SHAPE_PRESETS.some((p) => p.type === shapeType)));

  return (
    <>
      {/* Identity */}
      <div>
        <div className="font-medium text-foreground mb-1">
          {getElementLabel(selectedElement)}
        </div>
        <div className="text-muted-foreground">ID: {selectedElement.id}</div>
        {selectedElementIsTemplate && (
          <div className="text-amber-300 mt-1">
            Template element (layout/master)
          </div>
        )}
      </div>

      {/* Shape Type + Roundness */}
      {showShapeSelector && (
        <ShapeTypeSection
          elType={elType}
          shapeType={shapeType}
          selectedElement={selectedElement}
          isUnknownShape={Boolean(isUnknownShape)}
          showRoundness={showRoundness}
          onShapeTypeChange={handleShapeTypeChange}
          updateElement={updateElement}
        />
      )}

      {/* Connector Arrows */}
      {showArrows && (
        <ConnectorArrowsSection
          selectedShapeStyle={selectedShapeStyle}
          onUpdateShapeStyle={onUpdateShapeStyle}
          markDirty={markDirty}
        />
      )}

      {/* Image Properties */}
      {showImage && (
        <ImageCropSection
          selectedElement={selectedElement}
          updateElement={updateElement}
          onOpenImagePicker={onOpenImagePicker}
        />
      )}

      {/* Layer ordering */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={BTN_CLS}
          onClick={() => onMoveLayer("backward")}
          disabled={!canMutate}
        >
          <LuChevronDown className="w-3.5 h-3.5" /> Back
        </button>
        <button
          type="button"
          className={BTN_CLS}
          onClick={() => onMoveLayer("forward")}
          disabled={!canMutate}
        >
          <LuChevronUp className="w-3.5 h-3.5" /> Forward
        </button>
      </div>

      {/* Position & Size */}
      <div className="grid grid-cols-2 gap-2">
        {POS_SIZE_FIELDS.map(([label, field]) => (
          <label key={field} className="flex flex-col gap-1">
            <span className="text-muted-foreground">{label}</span>
            <input
              type="number"
              className={NUMBER_CLS}
              value={Math.round(selectedElement[field] as number)}
              min={
                field === "width" || field === "height"
                  ? MIN_ELEMENT_SIZE
                  : undefined
              }
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isFinite(v)) return;
                onUpdateElement({
                  [field]:
                    field === "width" || field === "height"
                      ? Math.max(v, MIN_ELEMENT_SIZE)
                      : v,
                });
                markDirty();
              }}
            />
          </label>
        ))}
      </div>

      {/* Rotation */}
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">Rotation</span>
        <input
          type="number"
          className={NUMBER_CLS}
          value={Math.round(selectedElement.rotation || 0)}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isFinite(v)) return;
            onUpdateElement({ rotation: v });
            markDirty();
          }}
        />
      </label>

      {/* Flip toggles */}
      <div className="grid grid-cols-2 gap-2">
        <label className="inline-flex items-center gap-2 text-foreground">
          <input
            type="checkbox"
            checked={Boolean(selectedElement.flipHorizontal)}
            onChange={(e) => {
              onUpdateElement({ flipHorizontal: e.target.checked });
              markDirty();
            }}
          />
          Flip Horizontally
        </label>
        <label className="inline-flex items-center gap-2 text-foreground">
          <input
            type="checkbox"
            checked={Boolean(selectedElement.flipVertical)}
            onChange={(e) => {
              onUpdateElement({ flipVertical: e.target.checked });
              markDirty();
            }}
          />
          Flip Vertically
        </label>
      </div>
    </>
  );
}
