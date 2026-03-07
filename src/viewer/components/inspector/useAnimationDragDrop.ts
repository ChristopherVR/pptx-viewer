import React, { useCallback, useRef, useState } from "react";

import type { PptxElementAnimation } from "../../../core";
import type { AnimationUpdater } from "./animation-handler-types";

// ---------------------------------------------------------------------------
// Sub-hook arguments
// ---------------------------------------------------------------------------

interface UseAnimationDragDropArgs {
  canEdit: boolean;
  updateAnimations: AnimationUpdater;
}

// ---------------------------------------------------------------------------
// Sub-hook return type
// ---------------------------------------------------------------------------

export interface AnimationDragDropHandlers {
  dragIndex: number | null;
  dragOverIndex: number | null;
  handleDragStart: (index: number, event: React.DragEvent) => void;
  handleDragOver: (index: number, event: React.DragEvent) => void;
  handleDragEnter: (index: number) => void;
  handleDragLeave: () => void;
  handleDrop: (targetIndex: number, event: React.DragEvent) => void;
  handleDragEnd: () => void;
  handleMoveUp: (animIndex: number) => void;
  handleMoveDown: (animIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAnimationDragDrop({
  canEdit,
  updateAnimations,
}: UseAnimationDragDropArgs): AnimationDragDropHandlers {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragCounterRef = useRef(0);

  const handleDragStart = useCallback(
    (index: number, event: React.DragEvent) => {
      if (!canEdit) return;
      setDragIndex(index);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    },
    [canEdit],
  );

  const handleDragOver = useCallback(
    (_index: number, event: React.DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDragOverIndex(_index);
    },
    [],
  );

  const handleDragEnter = useCallback((index: number) => {
    dragCounterRef.current++;
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      setDragOverIndex(null);
      dragCounterRef.current = 0;
    }
  }, []);

  const reorderAnimations = useCallback(
    (sourceIndex: number, targetIndex: number) => {
      updateAnimations((anims: PptxElementAnimation[]) => {
        const sorted = [...anims].sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0),
        );
        const [moved] = sorted.splice(sourceIndex, 1);
        sorted.splice(targetIndex, 0, moved);
        return sorted.map((a, i) => ({ ...a, order: i }));
      });
    },
    [updateAnimations],
  );

  const handleDrop = useCallback(
    (targetIndex: number, event: React.DragEvent) => {
      event.preventDefault();
      dragCounterRef.current = 0;
      const sourceIndex = dragIndex;
      setDragIndex(null);
      setDragOverIndex(null);
      if (sourceIndex === null || sourceIndex === targetIndex) return;
      reorderAnimations(sourceIndex, targetIndex);
    },
    [dragIndex, reorderAnimations],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
    dragCounterRef.current = 0;
  }, []);

  const handleMoveUp = useCallback(
    (animIndex: number) => {
      if (animIndex <= 0) return;
      reorderAnimations(animIndex, animIndex - 1);
    },
    [reorderAnimations],
  );

  const handleMoveDown = useCallback(
    (animIndex: number) => {
      updateAnimations((anims: PptxElementAnimation[]) => {
        const sorted = [...anims].sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0),
        );
        if (animIndex >= sorted.length - 1) return anims;
        const temp = sorted[animIndex + 1];
        sorted[animIndex + 1] = sorted[animIndex];
        sorted[animIndex] = temp;
        return sorted.map((a, i) => ({ ...a, order: i }));
      });
    },
    [updateAnimations],
  );

  return {
    dragIndex,
    dragOverIndex,
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    handleMoveUp,
    handleMoveDown,
  };
}
