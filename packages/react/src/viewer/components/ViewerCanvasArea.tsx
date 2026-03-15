/**
 * ViewerCanvasArea — The `<main>` element containing the slide canvas,
 * find/replace panel, and presentation annotation / toolbar overlays.
 */
import { useCallback, useMemo } from "react";
import type { PptxAction, PptxElement, PptxSlide } from "pptx-viewer-core";
import type { CanvasSize, TableCellEditorState } from "../types";
import type { ViewerMode } from "../types-core";
import type { CanvasInteractionHandlers } from "../hooks/useCanvasInteractions";
import type { InsertElementHandlers } from "../hooks/useInsertElements";
import type { TableOperationHandlers } from "../hooks/useTableOperations";
import type { UsePresentationAnnotationsResult } from "../hooks/usePresentationAnnotations";
import type { UsePresentationModeResult } from "../hooks/usePresentationMode";
import type { ViewerState } from "../hooks/useViewerState";
import type { UseZoomViewportResult } from "../hooks/useZoomViewport";
import { safeOpenUrl, isPpactionUrl, parsePpactionUrl } from "../utils/hyperlink-security";
import type { FieldSubstitutionContext } from "../utils/text-field-substitution";

import {
  FindReplacePanel,
  NotesMasterCanvas,
  HandoutMasterCanvas,
  SlideCanvas,
  PresentationAnnotationOverlay,
  PresentationSubtitleBar,
  PresentationToolbar,
} from ".";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ViewerCanvasAreaProps {
  mode: ViewerMode;
  canEdit: boolean;
  slides: PptxSlide[];
  activeSlide: PptxSlide | undefined;
  masterPseudoSlide: PptxSlide | undefined;
  templateElements: PptxElement[];
  canvasSize: CanvasSize;
  activeSlideIndex: number;
  gridSpacingPx: number;
  zoom: UseZoomViewportResult;
  state: ViewerState;
  selectedElement: PptxElement | null;
  canvasHandlers: CanvasInteractionHandlers;
  insertHandlers: InsertElementHandlers;
  tableOps: TableOperationHandlers;
  annotations: UsePresentationAnnotationsResult;
  presentation: UsePresentationModeResult;
  findReplace: {
    findReplaceOpen: boolean;
    findQuery: string;
    replaceQuery: string;
    findMatchCase: boolean;
    findResults: Array<{
      slideIndex: number;
      elementId: string;
      segmentIndex: number;
      startOffset: number;
      length: number;
    }>;
    findResultIndex: number;
    setFindQuery: (q: string) => void;
    setReplaceQuery: (q: string) => void;
    setFindMatchCase: (v: boolean) => void;
    performFind: () => void;
    navigateFindResult: (dir: 1 | -1) => void;
    handleReplace: () => void;
    handleReplaceAll: () => void;
    setFindReplaceOpen: (v: boolean) => void;
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ViewerCanvasArea(props: ViewerCanvasAreaProps) {
  const {
    mode,
    canEdit,
    slides,
    activeSlide,
    masterPseudoSlide,
    templateElements,
    canvasSize,
    activeSlideIndex,
    gridSpacingPx,
    zoom,
    state: s,
    selectedElement,
    canvasHandlers,
    insertHandlers,
    tableOps,
    annotations,
    presentation,
    findReplace,
  } = props;

  const effectiveSlide = mode === "master" ? masterPseudoSlide : activeSlide;
  const effectiveTemplateElements =
    mode === "master"
      ? s.activeLayout
        ? (s.activeMaster?.elements ?? [])
        : []
      : templateElements;

  // ── Field substitution context ──────────────────────────────────────
  const fieldContext = useMemo<FieldSubstitutionContext>(() => {
    const hf = s.headerFooter;
    // Extract slide title from first title/ctrTitle placeholder
    let slideTitle: string | undefined;
    if (activeSlide) {
      for (const el of activeSlide.elements) {
        const phType = (el as unknown as { placeholderType?: string }).placeholderType;
        if (phType === "title" || phType === "ctrTitle") {
          const txt = (el as unknown as { text?: string }).text;
          if (txt) {
            slideTitle = txt;
            break;
          }
        }
      }
    }
    return {
      slideNumber: activeSlide?.slideNumber,
      dateTimeText: hf.dateTimeText,
      dateFormat: hf.dateFormat,
      footerText: hf.footerText,
      headerText: hf.headerText,
      slideTitle,
      customProperties: s.customProperties.map((p) => ({
        name: p.name,
        value: p.value,
      })),
    };
  }, [s.headerFooter, s.customProperties, activeSlide]);

  // ── Action / hyperlink handlers for presentation mode ──────────────
  const handleActionClick = useCallback(
    (_elementId: string, action: PptxAction) => {
      presentation.handlePresentationAction(action);
    },
    [presentation.handlePresentationAction],
  );

  const handleHyperlinkClick = useCallback(
    (url: string) => {
      // Internal ppaction:// URLs (slide jumps, show jumps) are routed
      // through the presentation action handler instead of opening a tab.
      if (isPpactionUrl(url)) {
        const parsed = parsePpactionUrl(url);
        if (parsed) {
          const action: PptxAction = {
            action: parsed.action,
            targetSlideIndex: parsed.targetSlideIndex,
          };
          presentation.handlePresentationAction(action);
        }
        return;
      }
      safeOpenUrl(url);
    },
    [presentation.handlePresentationAction],
  );

  return (
    <main aria-label="Slide editor" className="flex-1 min-w-0 relative flex flex-col">
      {findReplace.findReplaceOpen && (
        <FindReplacePanel
          findQuery={findReplace.findQuery}
          replaceQuery={findReplace.replaceQuery}
          findMatchCase={findReplace.findMatchCase}
          findResults={findReplace.findResults}
          findResultIndex={findReplace.findResultIndex}
          onSetFindQuery={findReplace.setFindQuery}
          onSetReplaceQuery={findReplace.setReplaceQuery}
          onSetFindMatchCase={findReplace.setFindMatchCase}
          onPerformFind={findReplace.performFind}
          onNavigateResult={findReplace.navigateFindResult}
          onReplace={findReplace.handleReplace}
          onReplaceAll={findReplace.handleReplaceAll}
          onClose={() => findReplace.setFindReplaceOpen(false)}
        />
      )}

      {mode === "master" && s.masterViewTab === "notes" ? (
        <NotesMasterCanvas
          notesMaster={s.notesMaster}
          canvasSize={canvasSize}
          notesCanvasSize={s.notesCanvasSize}
        />
      ) : mode === "master" && s.masterViewTab === "handout" ? (
        <HandoutMasterCanvas
          handoutMaster={s.handoutMaster}
          canvasSize={canvasSize}
          slidesPerPage={s.handoutSlidesPerPage}
        />
      ) : (
        <SlideCanvas
          activeSlide={effectiveSlide}
          templateElements={effectiveTemplateElements}
          canvasSize={canvasSize}
          zoom={zoom}
          mode={mode}
          canEdit={canEdit}
          editTemplateMode={mode === "master" || s.editTemplateMode}
          selectedElementIdSet={s.selectedElementIdSet}
          selectedElement={selectedElement}
          inlineEditingElementId={s.inlineEditingElementId}
          inlineEditingText={s.inlineEditingText}
          spellCheckEnabled={s.spellCheckEnabled}
          mediaDataUrls={s.mediaDataUrls}
          tableEditorState={s.tableEditorState}
          marqueeSelectionState={s.marqueeSelectionState}
          snapLines={s.snapLines}
          showGrid={s.showGrid}
          gridSpacingPx={gridSpacingPx}
          showRulers={s.showRulers}
          guides={s.guides}
          presentationElementStates={
            mode === "present"
              ? presentation.presentationElementStates
              : undefined
          }
          presentationKeyframesCss={
            mode === "present"
              ? presentation.presentationKeyframesCss
              : undefined
          }
          onClick={canvasHandlers.handleElementClick}
          onDoubleClick={canvasHandlers.handleElementDoubleClick}
          onMouseDown={canvasHandlers.handleElementMouseDown}
          onContextMenu={canvasHandlers.handleElementContextMenu}
          onCanvasMouseDown={canvasHandlers.handleCanvasMouseDown}
          onResizePointerDown={canvasHandlers.handleResizePointerDown}
          onAdjustmentPointerDown={canvasHandlers.handleAdjustmentPointerDown}
          onInlineEditChange={s.setInlineEditingText}
          onInlineEditCommit={canvasHandlers.handleInlineEditCommit}
          onInlineEditCancel={() => s.setInlineEditingElementId(null)}
          onTableCellSelect={(cell, elementId) =>
            s.setTableEditorState(
              cell ? ({ ...cell, elementId } as TableCellEditorState) : null,
            )
          }
          onCommitCellEdit={tableOps.handleCommitCellEdit}
          onResizeTableColumns={tableOps.handleResizeTableColumns}
          onResizeTableRow={tableOps.handleResizeTableRow}
          findResults={findReplace.findResults}
          findResultIndex={findReplace.findResultIndex}
          activeSlideIndex={activeSlideIndex}
          activeTool={s.activeTool}
          drawingColor={s.drawingColor}
          drawingWidth={s.drawingWidth}
          isDrawingRef={s.isDrawingRef}
          onAddInkElement={insertHandlers.handleAddInkElement}
          onAddFreeformShape={insertHandlers.handleAddFreeformShape}
          onActionClick={
            mode === "present" ? handleActionClick : undefined
          }
          onHyperlinkClick={
            mode === "present" ? handleHyperlinkClick : undefined
          }
          allSlides={mode === "present" ? slides : undefined}
          onZoomClick={
            mode === "present" ? presentation.handleZoomClick : undefined
          }
          sourceSlideIndex={
            mode === "present" ? activeSlideIndex : undefined
          }
          fieldContext={fieldContext}
          comments={activeSlide?.comments}
          showCommentMarkers={s.sidebarPanelMode === "comments"}
          onCommentMarkerClick={() => s.setSidebarPanelMode("comments")}
          onMoveGuide={(guideId, position) => {
            s.setGuides((prev) =>
              prev.map((guide) =>
                guide.id === guideId
                  ? {
                      ...guide,
                      position:
                        guide.axis === "h"
                          ? Math.max(0, Math.min(canvasSize.height, position))
                          : Math.max(0, Math.min(canvasSize.width, position)),
                    }
                  : guide,
              ),
            );
          }}
          onDeleteGuide={(guideId) => {
            s.setGuides((prev) => prev.filter((guide) => guide.id !== guideId));
          }}
          onCreateGuideFromRuler={(axis, positionPx) => {
            s.setGuides((prev) => [
              ...prev,
              {
                id: `guide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                axis,
                position: positionPx,
              },
            ]);
          }}
        />
      )}

      {/* Presentation annotation overlay */}
      {mode === "present" && annotations.presentationTool !== "none" && (
        <PresentationAnnotationOverlay
          canvasSize={canvasSize}
          editorScale={zoom.editorScale}
          presentationTool={annotations.presentationTool}
          annotationStrokes={annotations.annotationStrokes}
          currentStroke={annotations.currentStroke}
          laserPosition={annotations.laserPosition}
          onPointerDown={annotations.handlePointerDown}
          onPointerMove={annotations.handlePointerMove}
          onPointerUp={annotations.handlePointerUp}
          onLaserMove={annotations.handleLaserMove}
          onLaserLeave={annotations.handleLaserLeave}
          onEraseAtPoint={annotations.eraseAtPoint}
        />
      )}

      {/* Presentation subtitle bar */}
      {mode === "present" && (
        <PresentationSubtitleBar
          visible={Boolean(s.presentationProperties.showSubtitles)}
        />
      )}

      {/* Presentation floating toolbar */}
      {mode === "present" && annotations.toolbarVisible && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[80]">
          <PresentationToolbar
            presentationTool={annotations.presentationTool}
            penColor={annotations.penColor}
            highlighterColor={annotations.highlighterColor}
            hasAnnotations={annotations.annotationStrokes.length > 0}
            onSetTool={annotations.setPresentationTool}
            onSetPenColor={annotations.setPenColor}
            onSetHighlighterColor={annotations.setHighlighterColor}
            onClearAnnotations={annotations.clearAnnotations}
          />
        </div>
      )}
    </main>
  );
}
