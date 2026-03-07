import type React from "react";

import type {
  PptxElementAnimation,
  PptxAnimationDirection,
} from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Hook argument types
// ---------------------------------------------------------------------------

export interface UseAnimationHandlersArgs {
  selectedElement: { id: string } & Record<string, unknown>;
  activeSlide: {
    animations?: PptxElementAnimation[];
    elements?: Array<{ id: string } & Record<string, unknown>>;
  };
  canEdit: boolean;
  onUpdateSlide: (updates: { animations?: PptxElementAnimation[] }) => void;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface AnimationHandlers {
  selectedElementAnimation: PptxElementAnimation | undefined;
  sortedAnimations: PptxElementAnimation[];
  hasAnimation: boolean;
  showDirectionPicker: boolean;
  dragIndex: number | null;
  dragOverIndex: number | null;
  timelineBarData: Array<{
    anim: PptxElementAnimation;
    leftPercent: number;
    widthPercent: number;
  }>;
  handleEntranceChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleExitChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleEmphasisChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleTriggerChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleTriggerShapeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleTimingCurveChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleDurationChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDelayChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRepeatCountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRepeatModeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleDirectionChange: (dir: PptxAnimationDirection) => void;
  handleSequenceChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handlePreviewClick: () => void;
  handleAnimationHover: (anim: PptxElementAnimation) => void;
  handleAnimationHoverEnd: () => void;
  handleDragStart: (index: number, event: React.DragEvent) => void;
  handleDragOver: (index: number, event: React.DragEvent) => void;
  handleDragEnter: (index: number) => void;
  handleDragLeave: () => void;
  handleDrop: (targetIndex: number, event: React.DragEvent) => void;
  handleDragEnd: () => void;
  handleMoveUp: (animIndex: number) => void;
  handleMoveDown: (animIndex: number) => void;
  getTimelineLabel: (anim: PptxElementAnimation) => string;
}

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

export const DIRECTIONAL_PRESETS = new Set<string>(["flyIn", "flyOut"]);

// ---------------------------------------------------------------------------
// Shared callback type used by sub-hooks
// ---------------------------------------------------------------------------

export type AnimationUpdater = (
  updater: (anims: PptxElementAnimation[]) => PptxElementAnimation[],
) => void;
