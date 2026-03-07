/**
 * ViewerPresentationLayer — Renders presenter-view, rehearsal HUD, and
 * rehearsal summary overlays that sit above the main editor UI.
 */
import type { PptxSlide, PptxElement } from "pptx-viewer-core";
import type { CanvasSize } from "../types";
import type { ViewerMode } from "../types-core";
import type { UsePresentationModeResult } from "../hooks/usePresentationMode";

import { PresenterView, RehearseTimingsHud, RehearseTimingsSummary } from ".";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ViewerPresentationLayerProps {
  mode: ViewerMode;
  slides: PptxSlide[];
  canvasSize: CanvasSize;
  templateElements: PptxElement[];
  presentation: UsePresentationModeResult;
  onExitPresentation: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ViewerPresentationLayer(props: ViewerPresentationLayerProps) {
  const {
    mode,
    slides,
    canvasSize,
    templateElements,
    presentation,
    onExitPresentation,
  } = props;

  return (
    <>
      {mode === "present" && presentation.presenterMode && (
        <PresenterView
          slides={slides}
          currentSlideIndex={presentation.presentationSlideIndex}
          canvasSize={canvasSize}
          templateElements={templateElements}
          presentationStartTime={presentation.presentationStartTime}
          onMovePresentationSlide={presentation.movePresentationSlide}
          onExit={onExitPresentation}
        />
      )}

      {mode === "present" && presentation.rehearsing && (
        <RehearseTimingsHud
          presentationStartTime={presentation.presentationStartTime}
          slideStartTime={presentation.slideStartTime}
          paused={presentation.rehearsalPaused}
          onTogglePause={presentation.toggleRehearsalPause}
        />
      )}

      {presentation.showRehearsalSummary && (
        <RehearseTimingsSummary
          slides={slides}
          canvasSize={canvasSize}
          recordedTimings={presentation.recordedTimings}
          onSave={presentation.saveRehearsalTimings}
          onDiscard={presentation.dismissRehearsalSummary}
        />
      )}
    </>
  );
}
