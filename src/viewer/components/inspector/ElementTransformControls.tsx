import React from "react";
import { LuChevronDown, LuChevronUp, LuImage } from "react-icons/lu";

import type { PptxElement } from "../../../core";
import { isImageLikeElement } from "../../../core";
import { MIN_ELEMENT_SIZE } from "../../constants";
import { clampCropValue } from "../../utils";

// ---------------------------------------------------------------------------
// Shared CSS
// ---------------------------------------------------------------------------

const BTN_CLS =
  "inline-flex items-center justify-center gap-1 rounded bg-muted hover:bg-accent px-2 py-1";
const NUMBER_CLS = "bg-muted border border-border rounded px-2 py-1";

const CROP_SIDES = ["Left", "Top", "Right", "Bottom"] as const;
const POS_SIZE_FIELDS = [
  ["X", "x"],
  ["Y", "y"],
  ["Width", "width"],
  ["Height", "height"],
] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ElementTransformControlsProps {
  selectedElement: PptxElement;
  selectedElementIsImage: boolean;
  canMutate: boolean;
  canEdit: boolean;
  onUpdateElement: (updates: Partial<PptxElement>) => void;
  onMoveLayer: (direction: "forward" | "backward") => void;
  onOpenImagePicker: () => void;
  markDirty: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ElementTransformControls({
  selectedElement,
  selectedElementIsImage: _selectedElementIsImage,
  canMutate,
  canEdit: _canEdit,
  onUpdateElement,
  onMoveLayer,
  onOpenImagePicker,
  markDirty,
}: ElementTransformControlsProps): React.ReactElement {
  const showImage =
    selectedElement.type === "picture" || selectedElement.type === "image";

  const updateElement = (updater: (el: PptxElement) => PptxElement): void => {
    const updated = updater(selectedElement);
    if (updated !== selectedElement) {
      const { id: _id, ...rest } = updated;
      onUpdateElement(rest as Partial<PptxElement>);
      markDirty();
    }
  };

  return (
    <>
      {/* Image Properties */}
      {showImage && (
        <div className="space-y-2">
          <button type="button" className={BTN_CLS} onClick={onOpenImagePicker}>
            <LuImage className="w-3.5 h-3.5" /> Replace Image
          </button>
          <div className="grid grid-cols-2 gap-2">
            {CROP_SIDES.map((side) => {
              const k = `crop${side}` as keyof PptxElement;
              return (
                <label key={side} className="flex flex-col gap-1 col-span-2">
                  <span className="text-muted-foreground">Crop {side}</span>
                  <input
                    type="range"
                    min={0}
                    max={80}
                    className="accent-primary"
                    value={Math.round(
                      clampCropValue(selectedElement[k] as number | undefined) *
                        100,
                    )}
                    onChange={(e) =>
                      updateElement((el) =>
                        !isImageLikeElement(el)
                          ? el
                          : { ...el, [k]: Number(e.target.value) / 100 },
                      )
                    }
                  />
                </label>
              );
            })}
            <button
              type="button"
              className={`${BTN_CLS} col-span-2`}
              onClick={() =>
                updateElement((el) =>
                  !isImageLikeElement(el)
                    ? el
                    : {
                        ...el,
                        cropLeft: 0,
                        cropTop: 0,
                        cropRight: 0,
                        cropBottom: 0,
                      },
                )
              }
            >
              Reset Crop
            </button>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Alt Text</span>
            <textarea
              rows={2}
              placeholder="Describe this image for accessibility"
              value={
                showImage
                  ? ((selectedElement as unknown as Record<string, unknown>)
                      .altText as string) || ""
                  : ""
              }
              onChange={(e) =>
                updateElement((el) =>
                  !isImageLikeElement(el)
                    ? el
                    : { ...el, altText: e.target.value },
                )
              }
              className="bg-muted border border-border rounded px-2 py-1 resize-y text-xs"
            />
          </label>
        </div>
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
