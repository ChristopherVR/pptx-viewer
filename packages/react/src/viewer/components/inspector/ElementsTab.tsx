import React from "react";

import { LuEyeOff } from "react-icons/lu";

import { cn } from "../../utils";
import type { PptxElement, PptxSlide } from "pptx-viewer-core";
import { hasTextProperties } from "pptx-viewer-core";

interface ElementsTabProps {
  slides: PptxSlide[];
  activeSlideIndex: number;
  selectedElementId: string | null;
  selectedElementIds: string[];
  canEdit: boolean;
  setSelectedElementId: (id: string | null) => void;
  setSelectedElementIds: (ids: string[]) => void;
  setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
  markDirty: () => void;
}

export function ElementsTab({
  slides,
  activeSlideIndex,
  selectedElementId,
  selectedElementIds,
  setSelectedElementId,
  setSelectedElementIds,
  setSlides,
  markDirty,
}: ElementsTabProps): React.ReactElement {
  const activeSlide = slides[activeSlideIndex] as PptxSlide | undefined;

  return (
    <div className="space-y-1 text-xs">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
        Layer Order (top → bottom)
      </div>
      {activeSlide ? (
        [...(activeSlide.elements || [])]
          .reverse()
          .map((element, reversedIndex) => {
            const realIndex =
              (activeSlide.elements || []).length - 1 - reversedIndex;
            const isSelected =
              selectedElementId === element.id ||
              selectedElementIds.includes(element.id);
            const label =
              (hasTextProperties(element)
                ? (element.text || "").slice(0, 24)
                : undefined) || element.type;
            return (
              <div
                key={element.id}
                className={cn(
                  "flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors",
                  isSelected
                    ? "bg-primary/30 text-primary-foreground"
                    : "hover:bg-muted text-foreground",
                )}
                onClick={() => {
                  setSelectedElementId(element.id);
                  setSelectedElementIds([element.id]);
                }}
                title={`${element.type} — ${element.id}`}
              >
                <span className="text-muted-foreground w-4 text-right">
                  {realIndex + 1}
                </span>
                <span className="flex-1 truncate">{label}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  title={element.hidden ? "Show element" : "Hide element"}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSlides((prevSlides) => {
                      const nextSlides = [...prevSlides];
                      const slideIdx = activeSlideIndex;
                      const slide = nextSlides[slideIdx];
                      if (!slide) return prevSlides;
                      const nextElements = [...(slide.elements || [])];
                      const elIdx = nextElements.findIndex(
                        (e) => e.id === element.id,
                      );
                      if (elIdx === -1) return prevSlides;
                      nextElements[elIdx] = {
                        ...nextElements[elIdx],
                        hidden: !nextElements[elIdx].hidden,
                      } as PptxElement;
                      nextSlides[slideIdx] = {
                        ...slide,
                        elements: nextElements,
                      };
                      return nextSlides;
                    });
                    markDirty();
                  }}
                >
                  {element.hidden ? (
                    <LuEyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <LuEyeOff className="w-3.5 h-3.5 opacity-30" />
                  )}
                </button>
              </div>
            );
          })
      ) : (
        <div className="text-muted-foreground italic">No slide selected</div>
      )}
    </div>
  );
}
