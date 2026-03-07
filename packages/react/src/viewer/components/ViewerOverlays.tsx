/**
 * ViewerOverlays — Shortcut, Accessibility, and Slide Sorter overlay panels.
 *
 * Consolidates the three overlay panels that render on top of the viewer
 * so the main orchestrator component stays lean.
 */
import type { PptxSlide } from "pptx-viewer-core";
import type {
  AccessibilityIssue,
  CanvasSize,
  SlideSectionGroup,
} from "../types";
import { ShortcutPanel } from "./ShortcutPanel";
import { AccessibilityPanel } from "./AccessibilityPanel";
import { SlideSorterOverlay } from "./SlideSorterOverlay";

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

export interface ViewerOverlaysProps {
  isShortcutHelpOpen: boolean;
  isAccessibilityPanelOpen: boolean;
  showSlideSorter: boolean;
  accessibilityIssues: AccessibilityIssue[];
  slides: PptxSlide[];
  activeSlideIndex: number;
  canvasSize: CanvasSize;
  canEdit: boolean;
  sectionGroups: SlideSectionGroup[];
  onCloseShortcuts: () => void;
  onCloseAccessibility: () => void;
  onSelectSlide: (i: number) => void;
  onMoveSlide: (fromIndex: number, toIndex: number) => void;
  onDeleteSlides: (indexes: number[]) => void;
  onDuplicateSlides: (indexes: number[]) => void;
  onToggleHideSlides: (indexes: number[]) => void;
  onCloseSorter: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function ViewerOverlays({
  isShortcutHelpOpen,
  isAccessibilityPanelOpen,
  showSlideSorter,
  accessibilityIssues,
  slides,
  activeSlideIndex,
  canvasSize,
  canEdit,
  sectionGroups,
  onCloseShortcuts,
  onCloseAccessibility,
  onSelectSlide,
  onMoveSlide,
  onDeleteSlides,
  onDuplicateSlides,
  onToggleHideSlides,
  onCloseSorter,
}: ViewerOverlaysProps): React.ReactElement | null {
  const hasOverlay =
    isShortcutHelpOpen || isAccessibilityPanelOpen || showSlideSorter;
  if (!hasOverlay) return null;

  return (
    <>
      {isShortcutHelpOpen && (
        <ShortcutPanel isOpen={isShortcutHelpOpen} onClose={onCloseShortcuts} />
      )}
      {isAccessibilityPanelOpen && (
        <AccessibilityPanel
          isOpen={isAccessibilityPanelOpen}
          issues={accessibilityIssues}
          onClose={onCloseAccessibility}
        />
      )}
      {showSlideSorter && (
        <SlideSorterOverlay
          slides={slides}
          activeSlideIndex={activeSlideIndex}
          canvasSize={canvasSize}
          canEdit={canEdit}
          sectionGroups={sectionGroups}
          onSelectSlide={onSelectSlide}
          onMoveSlide={onMoveSlide}
          onDeleteSlides={onDeleteSlides}
          onDuplicateSlides={onDuplicateSlides}
          onToggleHideSlides={onToggleHideSlides}
          onClose={onCloseSorter}
        />
      )}
    </>
  );
}
