/**
 * PowerPoint Viewer Plugin — Top-level Orchestrator Component.
 *
 * This is the main entry point for rendering and editing PowerPoint (.pptx) files.
 * It composes the full viewer UI from sub-components (toolbar, canvas, dialogs,
 * overlays, presentation layer) and delegates business logic to a collection of
 * custom hooks:
 *
 * - `useViewerState` -- all mutable editor state (slides, selection, mode, etc.)
 * - `useDerivedSlideState` -- computed values derived from state (visible indexes, sections)
 * - `useZoomViewport` -- zoom level and viewport DOM ref management
 * - `useEditorHistory` -- undo/redo snapshot stack
 * - `usePresentationSetup` -- slideshow mode + annotation handling
 * - `useViewerDialogs` -- dialog open/close state and callbacks
 * - `useEditorOperations` -- element manipulation, insert, canvas, find/replace
 * - `useViewerIntegration` -- I/O, export, print, pointers, clipboard, lifecycle
 *
 * The component exposes a `PowerPointViewerHandle` via `forwardRef` so host
 * applications can call `getContent()` to retrieve the current file bytes.
 */
import { forwardRef, useCallback, useEffect, useState } from "react";

import type { PowerPointViewerProps, PowerPointViewerHandle } from "./types";
export type { PowerPointViewerProps, PowerPointViewerHandle } from "./types";
export { getAnimationInitialStyle } from "./utils/animation";

import { ViewerThemeProvider, useThemeStyle } from "../theme";

// Hooks
import { useViewerState } from "./hooks/useViewerState";
import { useEditorHistory } from "./hooks/useEditorHistory";
import { useZoomViewport } from "./hooks/useZoomViewport";
import { useViewerDialogs } from "./hooks/useViewerDialogs";
import { useDerivedSlideState } from "./hooks/useDerivedSlideState";
import { usePresentationSetup } from "./hooks/usePresentationSetup";
import { useEditorOperations } from "./hooks/useEditorOperations";
import { useViewerIntegration } from "./hooks/useViewerIntegration";
import { useReducedMotion } from "./hooks/useReducedMotion";

// Components
import {
  LoadingState,
  ErrorState,
  ViewerOverlays,
  ViewerBottomPanels,
} from "./components";
import { ViewerToolbarSection } from "./components/ViewerToolbarSection";
import { ViewerMainContent } from "./components/ViewerMainContent";
import { ViewerDialogGroup } from "./components/ViewerDialogGroup";
import { ViewerPresentationLayer } from "./components/ViewerPresentationLayer";

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

/**
 * Root React component for the PowerPoint viewer/editor.
 *
 * Accepts binary `.pptx` content and renders a full-featured editor with
 * slide canvas, toolbar, inspector panels, presentation mode, and more.
 *
 * Uses `forwardRef` to expose a `PowerPointViewerHandle` for imperative
 * access (e.g. serialising the current content for saving).
 */
export const PowerPointViewer = forwardRef<
  PowerPointViewerHandle,
  PowerPointViewerProps
>(function PowerPointViewer(props, ref) {
  const {
    content: incomingContent,
    filePath,
    canEdit = false,
    onContentChange,
    onDirtyChange,
    onActiveSlideChange,
    theme,
  } = props;

  const themeStyle = useThemeStyle(theme);

  // Local content state -- synced from incoming prop but may diverge during editing.
  const [content, setContent] = useState<ArrayBuffer | Uint8Array | null>(
    incomingContent,
  );
  // Re-sync when the parent provides a new content buffer (e.g. file reload).
  useEffect(() => {
    setContent(incomingContent);
  }, [incomingContent]);

  // ── Reduced motion ──────────────────────────────────────────
  const {
    reducedMotion,
    toggleReducedMotion,
  } = useReducedMotion();

  // ── All state via custom hook ─────────────────────────────────
  const state = useViewerState({ content, canEdit });
  const {
    containerRef,
    mode,
    slides,
    canvasSize,
    loading,
    error,
    activeSlideIndex,
    selectedElementId,
    selectedElementIds,
    templateElementsBySlideId,
    activeSlide,
    selectedElement,
  } = state;

  // ── Derived computed values ───────────────────────────────────
  const {
    gridSpacingPx,
    visibleSlideIndexes,
    slideSectionGroups,
    masterPseudoSlide,
  } = useDerivedSlideState({
    slides,
    sections: state.sections,
    customShows: state.customShows,
    activeCustomShowId: state.activeCustomShowId,
    mode,
    activeLayout: state.activeLayout,
    activeMaster: state.activeMaster,
    presentationGridSpacing: state.presentationProperties.gridSpacing,
  });

  // ── Core hooks ────────────────────────────────────────────────
  // Returns true when a drag, resize, marquee, adjustment, or drawing
  // interaction is in progress. Used by the history hook to defer
  // snapshot capture until the interaction completes.
  const hasActivePointerInteraction = useCallback(
    () =>
      !!(
        state.dragStateRef.current ||
        state.resizeStateRef.current ||
        state.marqueeStateRef.current ||
        state.shapeAdjustmentDragStateRef.current ||
        state.isDrawingRef.current
      ),
    [
      state.dragStateRef,
      state.resizeStateRef,
      state.marqueeStateRef,
      state.shapeAdjustmentDragStateRef,
      state.isDrawingRef,
    ],
  );

  const zoom = useZoomViewport({
    canvasSize,
    selectedElements: state.selectedElements,
  });

  const history = useEditorHistory({
    slides,
    canvasSize,
    activeSlideIndex,
    templateElementsBySlideId,
    selectedElementId,
    selectedElementIds,
    editTemplateMode: state.editTemplateMode,
    headerFooter: state.headerFooter,
    loading,
    error,
    hasActivePointerInteraction,
    pointerCommitNonce: state.pointerCommitNonce,
    setSlides: state.setSlides,
    setCanvasSize: state.setCanvasSize,
    setActiveSlideIndex: state.setActiveSlideIndex,
    setTemplateElementsBySlideId: state.setTemplateElementsBySlideId,
    setSelectedElementId: state.setSelectedElementId,
    setSelectedElementIds: state.setSelectedElementIds,
    setEditTemplateMode: state.setEditTemplateMode,
    setHeaderFooter: state.setHeaderFooter,
  });

  // ── Presentation mode + annotations ───────────────────────────
  const { presentation, annotations, actionSoundHandlerRef } =
    usePresentationSetup({
      mode,
      slides,
      visibleSlideIndexes,
      activeSlideIndex,
      containerRef,
      mediaDataUrls: state.mediaDataUrls,
      presentationProperties: state.presentationProperties,
      setMode: state.setMode,
      setActiveSlideIndex: state.setActiveSlideIndex,
      setSlides: state.setSlides,
      history,
    });

  // ── Dialogs ───────────────────────────────────────────────────
  const dialogs = useViewerDialogs({
    mode,
    slides,
    activeSlide,
    activeSlideIndex,
    canvasSize,
    containerRef,
    customShows: state.customShows,
    activeCustomShowId: state.activeCustomShowId,
    setCustomShows: state.setCustomShows,
    setActiveCustomShowId: state.setActiveCustomShowId,
    setGuides: state.setGuides,
    setPresentationProperties: state.setPresentationProperties,
    setAccessibilityIssues:
      state.setAccessibilityIssues as unknown as React.Dispatch<
        React.SetStateAction<
          Array<{
            slideIndex: number;
            elementId: string;
            severity: "error" | "warning" | "info";
            message: string;
          }>
        >
      >,
    setIsAccessibilityPanelOpen: state.setIsAccessibilityPanelOpen,
    setMode: state.setMode,
    setPreMasterMode: state.setPreMasterMode,
    setActiveMasterIndex: state.setActiveMasterIndex,
    setActiveLayoutIndex: state.setActiveLayoutIndex,
    setSelectedElementId: state.setSelectedElementId,
    setSelectedElementIds: state.setSelectedElementIds,
    preMasterMode: state.preMasterMode,
    hasDigitalSignatures: state.hasDigitalSignatures,
    isDirty: state.isDirty,
    history,
  });

  // ── Editor operations (element ops, canvas, insert, etc.) ─────
  const editorOps = useEditorOperations({
    state,
    history,
    zoom,
    mode,
    canEdit,
    slides,
    activeSlide,
    activeSlideIndex,
    selectedElement,
    selectedElementId,
    selectedElementIds,
    canvasSize,
    dialogs,
    presentation,
  });

  // ── Integration (pointers, lifecycle, I/O, annotations, etc.) ─
  const {
    exportHandlers,
    printHandlers,
    themeHandlers,
    propertyHandlers,
    showKeepAnnotationsDialog,
    handleSetMode,
    handleKeepAnnotations,
    handleDiscardAnnotations,
    handleEnterPresenterView,
    handleEnterRehearsalMode,
    autosaveStatus,
    isEncryptedDialogOpen,
    setIsEncryptedDialogOpen,
  } = useViewerIntegration({
    state,
    zoom,
    history,
    presentation,
    annotations,
    actionSoundHandlerRef,
    editorOps,
    dialogs,
    gridSpacingPx,
    content,
    filePath,
    canEdit,
    mode,
    slides,
    activeSlide,
    activeSlideIndex,
    canvasSize,
    loading,
    error,
    ref,
    setContent,
    onContentChange,
    onDirtyChange,
    onActiveSlideChange,
  });

  // ── Early returns ─────────────────────────────────────────────
  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  const showSlidesPane =
    mode === "edit" && !dialogs.isNarrowViewport && state.isSlidesPaneOpen;
  const showMasterPane = mode === "master" && state.isSlidesPaneOpen;

  // ── JSX ───────────────────────────────────────────────────────
  return (
    <ViewerThemeProvider theme={theme}>
    <div
      ref={containerRef}
      tabIndex={0}
      style={themeStyle}
      className="h-full w-full bg-gray-950 text-gray-100 flex flex-col relative overflow-hidden outline-none"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-purple-500/3 to-transparent z-0" />

      {mode !== "present" && (
        <ViewerToolbarSection
          mode={mode}
          canEdit={canEdit}
          state={state}
          selectedElement={selectedElement}
          activeSlide={activeSlide}
          zoom={zoom}
          history={history}
          findReplace={editorOps.findReplace}
          manipulation={editorOps.manipulation}
          insertHandlers={editorOps.insertHandlers}
          exportHandlers={exportHandlers}
          printHandlers={printHandlers}
          propertyHandlers={propertyHandlers}
          dialogs={dialogs}
          slideOps={editorOps.slideOps}
          ops={editorOps.ops}
          onSetMode={handleSetMode}
          onEnterPresenterView={handleEnterPresenterView}
          onEnterRehearsalMode={handleEnterRehearsalMode}
        />
      )}

      <ViewerMainContent
        mode={mode}
        canEdit={canEdit}
        slides={slides}
        activeSlide={activeSlide}
        masterPseudoSlide={masterPseudoSlide}
        activeSlideIndex={activeSlideIndex}
        canvasSize={canvasSize}
        gridSpacingPx={gridSpacingPx}
        slideSectionGroups={slideSectionGroups}
        showSlidesPane={showSlidesPane}
        showMasterPane={showMasterPane}
        selectedElement={selectedElement}
        state={state}
        editorOps={editorOps}
        dialogs={dialogs}
        presentation={presentation}
        annotations={annotations}
        propertyHandlers={propertyHandlers}
        themeHandlers={themeHandlers}
        history={history}
        comments={editorOps.comments}
        zoom={zoom}
      />

      {mode !== "present" && (
        <ViewerBottomPanels
          activeSlide={activeSlide}
          allSlides={slides}
          isSlideNotesCollapsed={state.isSlideNotesCollapsed}
          canEdit={canEdit}
          slideCount={slides.length}
          activeSlideIndex={activeSlideIndex}
          isDirty={state.isDirty}
          autosaveStatus={autosaveStatus}
          onToggleNotes={() => state.setIsSlideNotesCollapsed((p) => !p)}
          onUpdateNotes={propertyHandlers.handleUpdateNotes}
        />
      )}

      <ViewerDialogGroup
        dialogs={dialogs}
        insertHandlers={editorOps.insertHandlers}
        exportHandlers={exportHandlers}
        printHandlers={printHandlers}
        propertyHandlers={propertyHandlers}
        annotations={annotations}
        slides={slides}
        activeSlideIndex={activeSlideIndex}
        canvasSize={canvasSize}
        filePath={filePath}
        coreProperties={state.coreProperties}
        customProperties={state.customProperties}
        appProperties={state.appProperties}
        embeddedFonts={state.embeddedFonts}
        hasDigitalSignatures={state.hasDigitalSignatures}
        digitalSignatureCount={state.digitalSignatureCount}
        presentationProperties={state.presentationProperties}
        customShows={state.customShows}
        selectedElements={state.selectedElements}
        isEncryptedDialogOpen={isEncryptedDialogOpen}
        setIsEncryptedDialogOpen={setIsEncryptedDialogOpen}
        showKeepAnnotationsDialog={showKeepAnnotationsDialog}
        onKeepAnnotations={handleKeepAnnotations}
        onDiscardAnnotations={handleDiscardAnnotations}
      />

      <ViewerOverlays
        isShortcutHelpOpen={state.isShortcutHelpOpen}
        isAccessibilityPanelOpen={state.isAccessibilityPanelOpen}
        showSlideSorter={state.showSlideSorter}
        accessibilityIssues={state.accessibilityIssues}
        slides={slides}
        activeSlideIndex={activeSlideIndex}
        canvasSize={canvasSize}
        canEdit={canEdit}
        sectionGroups={slideSectionGroups}
        onCloseShortcuts={() => state.setIsShortcutHelpOpen(false)}
        onCloseAccessibility={() => state.setIsAccessibilityPanelOpen(false)}
        onSelectSlide={(i) => {
          state.setActiveSlideIndex(i);
          state.setShowSlideSorter(false);
        }}
        onMoveSlide={editorOps.slideOps.handleMoveSlide}
        onDeleteSlides={editorOps.slideOps.handleDeleteSlides}
        onDuplicateSlides={editorOps.slideOps.handleDuplicateSlides}
        onToggleHideSlides={editorOps.slideOps.handleToggleHideSlides}
        onCloseSorter={() => state.setShowSlideSorter(false)}
        reducedMotion={reducedMotion}
        onToggleReducedMotion={toggleReducedMotion}
      />

      <ViewerPresentationLayer
        mode={mode}
        slides={slides}
        canvasSize={canvasSize}
        templateElements={state.templateElements}
        presentation={presentation}
        onExitPresentation={() => handleSetMode("edit")}
      />
    </div>
    </ViewerThemeProvider>
  );
});

PowerPointViewer.displayName = "PowerPointViewer";
