import React from "react";
import { useTranslation } from "react-i18next";
import {
  LuChevronDown,
  LuChevronUp,
  LuGripVertical,
  LuMoveRight,
  LuRotateCw,
} from "react-icons/lu";

import { cn } from "../../utils";
import type { PptxElementAnimation } from "../../../core";
import type { AnimationHandlers } from "./useAnimationHandlers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnimationTimelineSectionProps {
  selectedElementId: string;
  canEdit: boolean;
  handlers: AnimationHandlers;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function animationTypeColor(anim: PptxElementAnimation): string {
  if (anim.entrance) return "bg-green-500/60";
  if (anim.emphasis) return "bg-yellow-500/60";
  if (anim.exit) return "bg-red-500/60";
  return "bg-muted-foreground/40";
}

function animationTypeLabel(anim: PptxElementAnimation): string {
  return anim.entrance ?? anim.emphasis ?? anim.exit ?? "custom";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AnimationTimelineSection({
  selectedElementId,
  canEdit,
  handlers,
}: AnimationTimelineSectionProps): React.ReactElement | null {
  const { t } = useTranslation();
  const {
    sortedAnimations,
    dragIndex,
    dragOverIndex,
    timelineBarData,
    handleAnimationHover,
    handleAnimationHoverEnd,
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    handleMoveUp,
    handleMoveDown,
    getTimelineLabel,
  } = handlers;

  if (sortedAnimations.length === 0 && timelineBarData.length === 0) {
    return null;
  }

  return (
    <>
      {/* Horizontal Timeline Bar */}
      {timelineBarData.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            {t("pptx.animation.timelineBar")}
          </div>
          <div className="relative h-6 rounded bg-muted/50 border border-border overflow-hidden">
            {timelineBarData.map((bar) => (
              <div
                key={bar.anim.elementId}
                className={cn(
                  "absolute top-0.5 bottom-0.5 rounded-sm transition-colors",
                  animationTypeColor(bar.anim),
                  bar.anim.elementId === selectedElementId &&
                    "ring-1 ring-primary",
                )}
                style={{
                  left: `${bar.leftPercent}%`,
                  width: `${Math.max(bar.widthPercent, 2)}%`,
                }}
                title={`${getTimelineLabel(bar.anim)} - ${animationTypeLabel(bar.anim)} (${bar.anim.durationMs ?? 500}ms)`}
                onMouseEnter={() => handleAnimationHover(bar.anim)}
                onMouseLeave={handleAnimationHoverEnd}
              />
            ))}
          </div>
        </div>
      )}

      {/* Animation List with Drag Reordering */}
      {sortedAnimations.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            {t("pptx.animation.timeline")}
          </div>
          <div className="space-y-0.5 max-h-40 overflow-y-auto">
            {sortedAnimations.map((anim, index) => {
              const isSelected = selectedElementId === anim.elementId;
              const isDragging = dragIndex === index;
              const isDragOver = dragOverIndex === index;

              return (
                <div
                  key={anim.elementId}
                  draggable={canEdit}
                  onDragStart={(e) => handleDragStart(index, e)}
                  onDragOver={(e) => handleDragOver(index, e)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(index, e)}
                  onDragEnd={handleDragEnd}
                  onMouseEnter={() => handleAnimationHover(anim)}
                  onMouseLeave={handleAnimationHoverEnd}
                  className={cn(
                    "flex items-center gap-1 px-1 py-0.5 rounded text-[10px] cursor-grab transition-colors",
                    isSelected
                      ? "bg-primary/30 text-primary"
                      : "bg-muted/50 text-muted-foreground",
                    isDragging && "opacity-40",
                    isDragOver && "border-t-2 border-primary",
                  )}
                >
                  {canEdit && (
                    <LuGripVertical className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                  )}
                  <span className="text-muted-foreground w-4 shrink-0">
                    {index + 1}.
                  </span>
                  <span className="truncate flex-1">
                    {getTimelineLabel(anim)}
                  </span>
                  {anim.entrance && (
                    <LuMoveRight className="w-3 h-3 text-green-400/70 shrink-0" />
                  )}
                  {anim.emphasis && (
                    <LuRotateCw className="w-3 h-3 text-yellow-400/70 shrink-0" />
                  )}
                  {anim.exit && (
                    <LuMoveRight className="w-3 h-3 text-red-400/70 rotate-180 shrink-0" />
                  )}
                  {canEdit && (
                    <div className="flex gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={index === 0}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveUp(index);
                        }}
                        title={t("pptx.animation.moveUp")}
                      >
                        <LuChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={index === sortedAnimations.length - 1}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveDown(index);
                        }}
                        title={t("pptx.animation.moveDown")}
                      >
                        <LuChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
