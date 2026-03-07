import React from "react";

import { LuEyeOff } from "react-icons/lu";

import type { PptxSlide } from "../../../core";
import { cn } from "../../utils";
import type { CanvasSize } from "../../types";
import { SlideThumbnail } from "../SlideThumbnail";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SlideCardProps {
  slide: PptxSlide;
  index: number;
  isActive: boolean;
  isDragTarget: boolean;
  isSelected: boolean;
  selectedCount: number;
  selectionOrder: number;
  canvasSize: CanvasSize;
  canEdit: boolean;
  onSlideClick: (e: React.MouseEvent, index: number) => void;
  onDoubleClick: (index: number) => void;
  onContextMenu: (e: React.MouseEvent, index: number) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, toIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlideCard({
  slide,
  index,
  isActive,
  isDragTarget,
  isSelected,
  selectedCount,
  selectionOrder,
  canvasSize,
  canEdit,
  onSlideClick,
  onDoubleClick,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: SlideCardProps): React.ReactElement {
  return (
    <div
      className={cn(
        "group relative cursor-pointer rounded-lg border-2 p-1 transition-all",
        isDragTarget
          ? "border-primary bg-primary/20"
          : isSelected
            ? "border-primary bg-primary/10 ring-1 ring-primary/50"
            : isActive
              ? "border-primary/50 bg-primary/5"
              : "border-border bg-background/50 hover:border-border",
        slide.hidden && "opacity-40",
      )}
      onClick={(e) => onSlideClick(e, index)}
      onDoubleClick={() => onDoubleClick(index)}
      onContextMenu={(e) => onContextMenu(e, index)}
      draggable={canEdit}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
    >
      {/* Thumbnail */}
      <div className="aspect-video overflow-hidden rounded bg-white">
        <SlideThumbnail
          slide={slide}
          templateElements={[]}
          canvasSize={canvasSize}
        />
      </div>

      {/* Slide number label */}
      <div className="mt-1 flex items-center justify-between px-0.5">
        <span
          className={cn(
            "text-[11px] font-medium",
            isSelected
              ? "text-primary"
              : isActive
                ? "text-primary/70"
                : "text-muted-foreground",
          )}
        >
          {index + 1}
        </span>
        {slide.hidden && <LuEyeOff className="h-3 w-3 text-muted-foreground" />}
      </div>

      {/* Selection checkmark */}
      {isSelected && selectedCount > 1 && (
        <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold">
          {selectionOrder}
        </div>
      )}
    </div>
  );
}
