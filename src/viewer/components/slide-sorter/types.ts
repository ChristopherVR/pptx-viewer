import type { PptxSlide } from "../../../core";
import type { CanvasSize, SlideSectionGroup } from "../../types";

// ---------------------------------------------------------------------------
// Props for SlideSorterOverlay
// ---------------------------------------------------------------------------

export interface SlideSorterOverlayProps {
  slides: PptxSlide[];
  activeSlideIndex: number;
  canvasSize: CanvasSize;
  canEdit: boolean;
  sectionGroups: SlideSectionGroup[];
  onSelectSlide: (index: number) => void;
  onMoveSlide: (fromIndex: number, toIndex: number) => void;
  onDeleteSlides: (indexes: number[]) => void;
  onDuplicateSlides: (indexes: number[]) => void;
  onToggleHideSlides: (indexes: number[]) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Context menu state
// ---------------------------------------------------------------------------

export interface SorterContextMenuState {
  x: number;
  y: number;
  slideIndex: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MIN_ZOOM = 50;
export const MAX_ZOOM = 200;
export const DEFAULT_ZOOM = 100;
export const ZOOM_STEP = 10;
