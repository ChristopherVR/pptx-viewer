import React from "react";

import type {
  PptxSlide,
  PptxSlideTransition,
} from "pptx-viewer-core";
import type { CanvasSize } from "../../types";
import { SlideSizeSection } from "./SlideSizeSection";
import { SlideTransitionSection } from "./SlideTransitionSection";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SlidePropertiesProps {
  canvasSize: CanvasSize;
  activeSlide: PptxSlide | null;
  canEdit: boolean;
  onCanvasSizeChange: (size: CanvasSize) => void;
  onTransitionChange: (updates: Partial<PptxSlideTransition>) => void;
  markDirty: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlideProperties({
  canvasSize,
  activeSlide,
  onCanvasSizeChange,
  onTransitionChange,
  markDirty,
}: SlidePropertiesProps): React.ReactElement {
  return (
    <>
      <SlideSizeSection
        canvasSize={canvasSize}
        onCanvasSizeChange={onCanvasSizeChange}
        markDirty={markDirty}
      />
      <SlideTransitionSection
        activeSlide={activeSlide}
        onTransitionChange={onTransitionChange}
      />
    </>
  );
}
