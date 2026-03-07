import type React from "react";

import type { PptxSlide } from "pptx-viewer-core";
import type { CanvasSize, SlideSectionGroup } from "../../types";

// ---------------------------------------------------------------------------
// SlidesPaneSidebar props
// ---------------------------------------------------------------------------

export interface SlidesPaneSidebarProps {
  slides: PptxSlide[];
  activeSlideIndex: number;
  canvasSize: CanvasSize;
  sectionGroups: SlideSectionGroup[];
  isOpen: boolean;
  canEdit: boolean;
  onSelectSlide: (index: number) => void;
  onSlideContextMenu: (e: React.MouseEvent, index: number) => void;
  onMoveSlide: (fromIndex: number, toIndex: number) => void;
  onAddSlide: () => void;
  onCollapse: () => void;
  onAddSection?: (name: string, afterSlideIndex: number) => void;
  onRenameSection?: (sectionId: string, newName: string) => void;
  onDeleteSection?: (sectionId: string) => void;
  onMoveSectionUp?: (sectionId: string) => void;
  onMoveSectionDown?: (sectionId: string) => void;
  /** Recorded rehearsal timings in ms, keyed by slide index. */
  rehearsalTimings?: Record<number, number>;
}

// ---------------------------------------------------------------------------
// Context-menu state shapes
// ---------------------------------------------------------------------------

export interface SectionContextMenuState {
  x: number;
  y: number;
  sectionId: string;
  sectionIndex: number;
  totalSections: number;
}

export interface SlideContextMenuState {
  x: number;
  y: number;
  slideIndex: number;
}
