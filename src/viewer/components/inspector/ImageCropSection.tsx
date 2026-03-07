import React from "react";
import { LuImage } from "react-icons/lu";

import type { PptxElement } from "../../../core";
import { isImageLikeElement } from "../../../core";
import { clampCropValue } from "../../utils";
import { BTN_CLS } from "./element-properties-constants";

const CROP_SIDES = ["Left", "Top", "Right", "Bottom"] as const;

interface ImageCropSectionProps {
  selectedElement: PptxElement;
  updateElement: (updater: (el: PptxElement) => PptxElement) => void;
  onOpenImagePicker: () => void;
}

export function ImageCropSection({
  selectedElement,
  updateElement,
  onOpenImagePicker,
}: ImageCropSectionProps): React.ReactElement {
  return (
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
                      : {
                          ...el,
                          [k]: Number(e.target.value) / 100,
                        },
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
            ((selectedElement as unknown as Record<string, unknown>)
              .altText as string) || ""
          }
          onChange={(e) =>
            updateElement((el) =>
              !isImageLikeElement(el) ? el : { ...el, altText: e.target.value },
            )
          }
          className="bg-muted border border-border rounded px-2 py-1 resize-y text-xs"
        />
      </label>
    </div>
  );
}
