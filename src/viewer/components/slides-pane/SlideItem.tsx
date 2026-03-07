import React, { useCallback } from "react";

import { LuEyeOff, LuMessageSquare } from "react-icons/lu";

import type { PptxSlide } from "../../../core";
import { cn } from "../../utils";
import type { CanvasSize } from "../../types";
import { SlideThumbnail } from "../SlideThumbnail";
import { formatTimingMs } from "./utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SlideItemProps {
  slide: PptxSlide;
  slideIndex: number;
  isActive: boolean;
  canvasSize: CanvasSize;
  canEdit: boolean;
  rehearsalTimings?: Record<number, number>;
  onSelectSlide: (index: number) => void;
  onSlideContextMenu: (e: React.MouseEvent, index: number) => void;
  onAddSection?: (name: string, afterSlideIndex: number) => void;
  onOpenSlideCtxMenu: (x: number, y: number, slideIndex: number) => void;
  onDragStart: (e: React.DragEvent, slideIndex: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, toIndex: number) => void;
  slideRef: (el: HTMLDivElement | null) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlideItem({
  slide,
  slideIndex,
  isActive,
  canvasSize,
  canEdit,
  rehearsalTimings,
  onSelectSlide,
  onSlideContextMenu,
  onAddSection,
  onOpenSlideCtxMenu,
  onDragStart,
  onDragOver,
  onDrop,
  slideRef,
}: SlideItemProps): React.ReactElement {
  const isHidden = Boolean(slide.hidden);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (canEdit && onAddSection) {
        e.preventDefault();
        e.stopPropagation();
        onOpenSlideCtxMenu(e.clientX, e.clientY, slideIndex);
      } else {
        onSlideContextMenu(e, slideIndex);
      }
    },
    [canEdit, onAddSection, onOpenSlideCtxMenu, onSlideContextMenu, slideIndex],
  );

  return (
    <div
      ref={slideRef}
      className={cn(
        "group relative cursor-pointer rounded-lg border-2 p-1 transition-all",
        isActive
          ? "border-primary bg-primary/10"
          : "border-border bg-background/40 hover:border-muted-foreground",
        isHidden && "opacity-50",
      )}
      draggable={canEdit}
      onClick={() => onSelectSlide(slideIndex)}
      onContextMenu={handleContextMenu}
      onDragStart={(e) => onDragStart(e, slideIndex)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, slideIndex)}
    >
      {/* Hidden-slide indicator stripe */}
      {isHidden && (
        <div className="absolute inset-0 rounded-lg pointer-events-none bg-[repeating-linear-gradient(135deg,transparent,transparent_4px,rgba(255,255,255,0.04)_4px,rgba(255,255,255,0.04)_8px)]" />
      )}

      {/* Thumbnail */}
      <div className="relative overflow-hidden rounded bg-white">
        <SlideThumbnail
          slide={slide}
          templateElements={[]}
          canvasSize={canvasSize}
        />
        {(slide.comments?.length ?? 0) > 0 && (
          <div className="absolute top-0.5 right-0.5 flex items-center gap-0.5 rounded bg-amber-500/90 px-1 py-0.5 text-[8px] font-medium text-white leading-none">
            <LuMessageSquare className="w-2 h-2" />
            {slide.comments?.length}
          </div>
        )}
      </div>

      {/* Footer: slide number + timing + hidden icon */}
      <div className="mt-1 flex items-center justify-between px-1">
        <span
          className={cn(
            "text-[10px]",
            isActive ? "text-primary" : "text-muted-foreground",
          )}
        >
          {slideIndex + 1}
        </span>
        <div className="flex items-center gap-1">
          {rehearsalTimings &&
            typeof rehearsalTimings[slideIndex] === "number" && (
              <span className="text-[9px] font-mono text-amber-400/80 tabular-nums">
                {formatTimingMs(rehearsalTimings[slideIndex])}
              </span>
            )}
          {isHidden && <LuEyeOff className="w-3 h-3 text-muted-foreground" />}
        </div>
      </div>
    </div>
  );
}
