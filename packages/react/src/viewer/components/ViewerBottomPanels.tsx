/**
 * ViewerBottomPanels — SlideNotesPanel + StatusBar wrapper.
 *
 * Renders the bottom section of the viewer (notes panel and status bar)
 * when the viewer is not in presentation mode.
 */
import type { PptxSlide, TextSegment } from "pptx-viewer-core";
import type { AutosaveStatus } from "../hooks/useAutosave";
import { SlideNotesPanel } from "./SlideNotesPanel";
import { StatusBar } from "./StatusBar";

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

export interface ViewerBottomPanelsProps {
  activeSlide: PptxSlide | undefined;
  allSlides?: PptxSlide[];
  isSlideNotesCollapsed: boolean;
  canEdit: boolean;
  slideCount: number;
  activeSlideIndex: number;
  isDirty: boolean;
  autosaveStatus?: AutosaveStatus;
  onToggleNotes: () => void;
  onUpdateNotes: (text: string, segments?: TextSegment[]) => void;
  /** Optional collaboration status indicator rendered in the status bar row. */
  collaborationSlot?: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function ViewerBottomPanels({
  activeSlide,
  allSlides,
  isSlideNotesCollapsed,
  canEdit,
  slideCount,
  activeSlideIndex,
  isDirty,
  autosaveStatus,
  onToggleNotes,
  onUpdateNotes,
  collaborationSlot,
}: ViewerBottomPanelsProps): React.ReactElement {
  return (
    <>
      <SlideNotesPanel
        activeSlide={activeSlide}
        allSlides={allSlides}
        isExpanded={!isSlideNotesCollapsed}
        canEdit={canEdit}
        onToggle={onToggleNotes}
        onUpdateNotes={onUpdateNotes}
      />
      <div className="flex items-center justify-between">
        <StatusBar
          slideCount={slideCount}
          activeSlideIndex={activeSlideIndex}
          isDirty={isDirty}
          autosaveStatus={autosaveStatus}
        />
        {collaborationSlot}
      </div>
    </>
  );
}
