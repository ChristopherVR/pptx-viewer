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

/**
 * Props for the {@link SlideProperties} component.
 */
interface SlidePropertiesProps {
  /** Current slide canvas dimensions (width and height in pixels). */
  canvasSize: CanvasSize;
  /** The currently active slide, or null if no slide is selected. */
  activeSlide: PptxSlide | null;
  /** Whether editing controls should be enabled. */
  canEdit: boolean;
  /** Callback to update the presentation canvas (slide) size. */
  onCanvasSizeChange: (size: CanvasSize) => void;
  /** Callback to apply partial updates to the active slide's transition settings. */
  onTransitionChange: (updates: Partial<PptxSlideTransition>) => void;
  /** Marks the presentation as dirty (unsaved changes). */
  markDirty: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Slide-level properties panel combining slide size and transition settings.
 *
 * Delegates to {@link SlideSizeSection} for canvas dimension controls and
 * {@link SlideTransitionSection} for transition type/duration/advance settings.
 *
 * @param props - {@link SlidePropertiesProps}
 * @returns The slide properties inspector panel.
 */
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
