import React, { useCallback, useMemo } from "react";

import type {
  PptxElement,
  PptxSlide,
  PptxElementAnimation,
  PptxAnimationPreset,
  PptxAnimationDirection,
  PptxAnimationRepeatMode,
  PptxAnimationSequence,
  PptxAnimationTimingCurve,
  PptxAnimationTrigger,
} from "pptx-viewer-core";
import { hasTextProperties } from "pptx-viewer-core";
import { getElementLabel } from "../../utils";
import { DIRECTIONAL_PRESETS } from "./animation-handler-types";
import { useAnimationDragDrop } from "./useAnimationDragDrop";
import { useAnimationPreview } from "./useAnimationPreview";

export type { AnimationHandlers } from "./animation-handler-types";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseAnimationHandlersArgs {
  selectedElement: PptxElement;
  activeSlide: PptxSlide;
  canEdit: boolean;
  onUpdateSlide: (updates: Partial<PptxSlide>) => void;
}

export function useAnimationHandlers({
  selectedElement,
  activeSlide,
  canEdit,
  onUpdateSlide,
}: UseAnimationHandlersArgs) {
  const selectedElementAnimation = useMemo(
    () =>
      (activeSlide.animations ?? []).find(
        (a) => a.elementId === selectedElement.id,
      ),
    [activeSlide, selectedElement],
  );

  const sortedAnimations = useMemo(
    () =>
      [...(activeSlide.animations ?? [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0),
      ),
    [activeSlide.animations],
  );

  // ── Core updater ──

  const updateAnimations = useCallback(
    (updater: (anims: PptxElementAnimation[]) => PptxElementAnimation[]) => {
      if (!canEdit) return;
      const current = activeSlide.animations ?? [];
      onUpdateSlide({ animations: updater([...current]) });
    },
    [canEdit, activeSlide.animations, onUpdateSlide],
  );

  const updateAnimationField = useCallback(
    <K extends keyof PptxElementAnimation>(
      field: K,
      value: PptxElementAnimation[K],
    ) => {
      updateAnimations((anims) =>
        anims.map((a) =>
          a.elementId === selectedElement.id ? { ...a, [field]: value } : a,
        ),
      );
    },
    [updateAnimations, selectedElement.id],
  );

  const setAnimationPreset = useCallback(
    (
      entrance: string | undefined,
      exit: string | undefined,
      emphasis?: string | undefined,
    ) => {
      if (!canEdit) return;
      updateAnimations((anims) => {
        const idx = anims.findIndex((a) => a.elementId === selectedElement.id);
        const hasEffect = entrance || exit || emphasis;
        if (idx >= 0) {
          if (!hasEffect)
            return anims.filter((a) => a.elementId !== selectedElement.id);
          anims[idx] = {
            ...anims[idx],
            entrance: entrance as PptxAnimationPreset | undefined,
            exit: exit as PptxAnimationPreset | undefined,
            emphasis: emphasis as PptxAnimationPreset | undefined,
          };
        } else if (hasEffect) {
          anims.push({
            elementId: selectedElement.id,
            entrance: entrance as PptxAnimationPreset | undefined,
            exit: exit as PptxAnimationPreset | undefined,
            emphasis: emphasis as PptxAnimationPreset | undefined,
            durationMs: 500,
            order: anims.length,
            trigger: "onClick",
          });
        }
        return anims;
      });
    },
    [canEdit, updateAnimations, selectedElement.id],
  );

  // ── Preset handlers ──

  const handleEntranceChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const v = event.target.value;
      setAnimationPreset(
        v === "none" ? undefined : v,
        selectedElementAnimation?.exit,
        selectedElementAnimation?.emphasis,
      );
    },
    [setAnimationPreset, selectedElementAnimation],
  );

  const handleExitChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const v = event.target.value;
      setAnimationPreset(
        selectedElementAnimation?.entrance,
        v === "none" ? undefined : v,
        selectedElementAnimation?.emphasis,
      );
    },
    [setAnimationPreset, selectedElementAnimation],
  );

  const handleEmphasisChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const v = event.target.value;
      setAnimationPreset(
        selectedElementAnimation?.entrance,
        selectedElementAnimation?.exit,
        v === "none" ? undefined : v,
      );
    },
    [setAnimationPreset, selectedElementAnimation],
  );

  // ── Timing handlers ──

  const handleTriggerChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const newTrigger = event.target.value as PptxAnimationTrigger;
      updateAnimationField("trigger", newTrigger);
      if (newTrigger !== "onShapeClick")
        updateAnimationField("triggerShapeId", undefined);
    },
    [updateAnimationField],
  );

  const handleTriggerShapeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      updateAnimationField("triggerShapeId", e.target.value || undefined),
    [updateAnimationField],
  );

  const handleTimingCurveChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      updateAnimationField(
        "timingCurve",
        e.target.value as PptxAnimationTimingCurve,
      ),
    [updateAnimationField],
  );

  const handleDurationChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      updateAnimationField(
        "durationMs",
        Math.max(100, Math.min(10000, Number(e.target.value) || 450)),
      ),
    [updateAnimationField],
  );

  const handleDelayChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      updateAnimationField(
        "delayMs",
        Math.max(0, Math.min(10000, Number(e.target.value) || 0)),
      ),
    [updateAnimationField],
  );

  const handleRepeatCountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      updateAnimationField(
        "repeatCount",
        Math.max(1, Math.min(100, Number(e.target.value) || 1)),
      ),
    [updateAnimationField],
  );

  const handleRepeatModeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const v = e.target.value;
      updateAnimationField(
        "repeatMode",
        v === "none" ? undefined : (v as PptxAnimationRepeatMode),
      );
    },
    [updateAnimationField],
  );

  const handleDirectionChange = useCallback(
    (dir: PptxAnimationDirection) => updateAnimationField("direction", dir),
    [updateAnimationField],
  );

  const handleSequenceChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      updateAnimationField("sequence", e.target.value as PptxAnimationSequence),
    [updateAnimationField],
  );

  // ── Sub-hooks ──

  const preview = useAnimationPreview({
    selectedElementId: selectedElement.id,
    selectedElementAnimation,
  });

  const dragDrop = useAnimationDragDrop({ canEdit, updateAnimations });

  const getTimelineLabel = useCallback(
    (anim: PptxElementAnimation): string => {
      const el = activeSlide.elements?.find((e) => e.id === anim.elementId);
      if (!el) return anim.elementId.slice(0, 8);
      const text = hasTextProperties(el) ? el.text : undefined;
      return text || getElementLabel(el);
    },
    [activeSlide.elements],
  );

  // ── Derived state ──

  const hasAnimation = Boolean(
    selectedElementAnimation?.entrance ||
    selectedElementAnimation?.exit ||
    selectedElementAnimation?.emphasis,
  );

  const showDirectionPicker =
    hasAnimation &&
    (DIRECTIONAL_PRESETS.has(selectedElementAnimation?.entrance ?? "") ||
      DIRECTIONAL_PRESETS.has(selectedElementAnimation?.exit ?? ""));

  const timelineBarData = useMemo(() => {
    if (sortedAnimations.length === 0) return [];
    let maxEndMs = 0;
    const entries = sortedAnimations.map((anim) => {
      const startMs = anim.delayMs ?? 0;
      const durationMs = anim.durationMs ?? 500;
      const endMs = startMs + durationMs;
      if (endMs > maxEndMs) maxEndMs = endMs;
      return { anim, startMs, durationMs, endMs };
    });
    const totalMs = Math.max(maxEndMs, 1);
    return entries.map((entry) => ({
      anim: entry.anim,
      leftPercent: (entry.startMs / totalMs) * 100,
      widthPercent: (entry.durationMs / totalMs) * 100,
    }));
  }, [sortedAnimations]);

  return {
    selectedElementAnimation,
    sortedAnimations,
    hasAnimation,
    showDirectionPicker,
    timelineBarData,
    handleEntranceChange,
    handleExitChange,
    handleEmphasisChange,
    handleTriggerChange,
    handleTriggerShapeChange,
    handleTimingCurveChange,
    handleDurationChange,
    handleDelayChange,
    handleRepeatCountChange,
    handleRepeatModeChange,
    handleDirectionChange,
    handleSequenceChange,
    getTimelineLabel,
    ...preview,
    ...dragDrop,
  };
}
