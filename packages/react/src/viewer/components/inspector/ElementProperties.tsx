import React from "react";
import { LuChevronDown, LuChevronUp } from "react-icons/lu";

import type { PptxElement, ShapeStyle } from "pptx-viewer-core";
import { hasShapeProperties } from "pptx-viewer-core";
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

/**
 * Props for the {@link ElementProperties} component.
 */
interface ElementPropertiesProps {
  /** The currently selected element whose properties are being edited. */
  selectedElement: PptxElement;
  /** Resolved shape type (e.g. "rect", "roundRect") or undefined if not a shape. */
  selectedShapeType: string | undefined;
  /** Current shape style (fill, stroke, etc.) of the selected element. */
  selectedShapeStyle: ShapeStyle | undefined;
  /** Whether the element belongs to a layout or master template (restricts editing). */
  selectedElementIsTemplate: boolean;
  /** Whether the element is an image or picture type. */
  selectedElementIsImage: boolean;
  /** Whether editing is permitted in the current mode. */
  canEdit: boolean;
  /** Callback to apply partial updates to the selected element. */
  onUpdateElement: (updates: Partial<PptxElement>) => void;
  /** Callback to apply partial updates to the element's shape style. */
  onUpdateShapeStyle: (updates: Partial<ShapeStyle>) => void;
  /** Callback to move the element forward or backward in the z-order stack. */
  onMoveLayer: (direction: "forward" | "backward") => void;
  /** Callback to open the image picker dialog for replacing images. */
  onOpenImagePicker: () => void;
  /** Marks the presentation as dirty (unsaved changes). */
  markDirty: () => void;
}

/** Label/field-key tuples for position and size numeric inputs. */
const POS_SIZE_FIELDS = [
  ["X", "x"],
  ["Y", "y"],
  ["Width", "width"],
  ["Height", "height"],
] as const;

/**
 * Displays and edits core element properties: identity, shape type, position,
 * size, rotation, flip toggles, layer ordering, connector arrows, and image cropping.
 *
 * This is the primary property panel shown when a single element is selected
 * on the slide canvas.
 *
 * @param props - {@link ElementPropertiesProps}
 * @returns The element properties inspector panel.
 */
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
  // Template elements (from layout/master slides) cannot be mutated in normal editing mode
  const canMutate = canEdit && !selectedElementIsTemplate;
  const elType = selectedElement.type;
  const shapeType = hasShapeProperties(selectedElement)
    ? selectedElement.shapeType
    : undefined;

  /**
   * Applies an updater function to the element, stripping the `id` before
   * dispatching the update so the element identity is preserved.
   */
  const updateElement = (updater: (el: PptxElement) => PptxElement): void => {
    const updated = updater(selectedElement);
    if (updated !== selectedElement) {
      const { id: _id, ...rest } = updated;
      onUpdateElement(rest as Partial<PptxElement>);
      markDirty();
    }
  };

  /**
   * Handles shape type dropdown changes. For connectors, simply updates the
   * shapeType. For shapes/text, also adjusts fill defaults and shape
   * adjustments (e.g. corner radius for roundRect, depth for cylinder/can).
   */
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
    // Set default shape adjustment values: roundRect gets corner radius (16667 EMU),
    // cylinder/can get depth (25000 EMU). Other shapes clear adjustments.
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
