import { useCallback } from "react";

import type { PptxElementAnimation } from "../../../core";
import {
  startPreviewAnimation,
  stopPreviewAnimation,
} from "../../utils/animation-preview";

// ---------------------------------------------------------------------------
// Sub-hook arguments
// ---------------------------------------------------------------------------

interface UseAnimationPreviewArgs {
  selectedElementId: string;
  selectedElementAnimation: PptxElementAnimation | undefined;
}

// ---------------------------------------------------------------------------
// Sub-hook return type
// ---------------------------------------------------------------------------

export interface AnimationPreviewHandlers {
  handleAnimationHover: (anim: PptxElementAnimation) => void;
  handleAnimationHoverEnd: () => void;
  handlePreviewClick: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAnimationPreview({
  selectedElementId,
  selectedElementAnimation,
}: UseAnimationPreviewArgs): AnimationPreviewHandlers {
  const handleAnimationHover = useCallback((anim: PptxElementAnimation) => {
    const preset = anim.entrance ?? anim.emphasis ?? anim.exit;
    if (!preset || preset === "none") return;
    startPreviewAnimation(anim.elementId, preset, {
      direction: anim.direction,
      durationMs: anim.durationMs ?? 500,
      timingCurve: anim.timingCurve,
    });
  }, []);

  const handleAnimationHoverEnd = useCallback(() => stopPreviewAnimation(), []);

  const handlePreviewClick = useCallback(() => {
    if (!selectedElementAnimation) return;
    const preset =
      selectedElementAnimation.entrance ??
      selectedElementAnimation.emphasis ??
      selectedElementAnimation.exit;
    if (!preset || preset === "none") return;
    startPreviewAnimation(selectedElementId, preset, {
      direction: selectedElementAnimation.direction,
      durationMs: selectedElementAnimation.durationMs ?? 500,
      timingCurve: selectedElementAnimation.timingCurve,
    });
  }, [selectedElementId, selectedElementAnimation]);

  return {
    handleAnimationHover,
    handleAnimationHoverEnd,
    handlePreviewClick,
  };
}
