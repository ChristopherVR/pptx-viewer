/**
 * useViewerIntegration — Wires pointer handling, content lifecycle,
 * I/O, annotations, recovery, imperative handle, parent callbacks,
 * and keyboard shortcuts into the viewer orchestrator.
 */
import {
  type Dispatch,
  type ForwardedRef,
  type SetStateAction,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";

import type { PptxSlide } from "pptx-viewer-core";
import type { PowerPointViewerHandle } from "../types";
import type { ViewerState } from "./useViewerState";
import type { EditorHistoryResult } from "./useEditorHistory";
import type { UseZoomViewportResult } from "./useZoomViewport";
import type { PresentationSetupResult } from "./usePresentationSetup";
import type { ViewerDialogsResult } from "./viewer-dialog-types";
import type { EditorOperationsResult } from "./useEditorOperations";
import type { IOHandlersResult } from "./useIOHandlers";
import type { AnnotationHandlersResult } from "./useAnnotationHandlers";
import type { AutosaveStatus } from "./useAutosave";

import { usePointerHandlers } from "./usePointerHandlers";
import { useContentLifecycle } from "./useContentLifecycle";
import { useIOHandlers } from "./useIOHandlers";
import { useAnnotationHandlers } from "./useAnnotationHandlers";
import { useRecoveryDetection } from "./useRecoveryDetection";
import { useKeyboardShortcutWiring } from "./useKeyboardShortcutWiring";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UseViewerIntegrationInput {
  state: ViewerState;
  zoom: UseZoomViewportResult;
  history: EditorHistoryResult;
  presentation: PresentationSetupResult["presentation"];
  annotations: PresentationSetupResult["annotations"];
  actionSoundHandlerRef: PresentationSetupResult["actionSoundHandlerRef"];
  editorOps: EditorOperationsResult;
  dialogs: ViewerDialogsResult;
  gridSpacingPx: number;
  content: ArrayBuffer | Uint8Array | null;
  filePath: string | undefined;
  canEdit: boolean;
  mode: ViewerState["mode"];
  slides: PptxSlide[];
  activeSlide: PptxSlide | undefined;
  activeSlideIndex: number;
  canvasSize: ViewerState["canvasSize"];
  loading: boolean;
  error: string | null;
  ref: ForwardedRef<PowerPointViewerHandle>;
  setContent: Dispatch<SetStateAction<ArrayBuffer | Uint8Array | null>>;
  onContentChange: ((content: Uint8Array) => void) | undefined;
  onDirtyChange: ((dirty: boolean) => void) | undefined;
  onActiveSlideChange: ((index: number) => void) | undefined;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface ViewerIntegrationResult {
  exportHandlers: IOHandlersResult["exportHandlers"];
  printHandlers: IOHandlersResult["printHandlers"];
  themeHandlers: IOHandlersResult["themeHandlers"];
  propertyHandlers: IOHandlersResult["propertyHandlers"];
  showKeepAnnotationsDialog: AnnotationHandlersResult["showKeepAnnotationsDialog"];
  handleSetMode: AnnotationHandlersResult["handleSetMode"];
  handleKeepAnnotations: AnnotationHandlersResult["handleKeepAnnotations"];
  handleDiscardAnnotations: AnnotationHandlersResult["handleDiscardAnnotations"];
  handleEnterPresenterView: AnnotationHandlersResult["handleEnterPresenterView"];
  handleEnterRehearsalMode: AnnotationHandlersResult["handleEnterRehearsalMode"];
  autosaveStatus: AutosaveStatus;
  isEncryptedDialogOpen: boolean;
  setIsEncryptedDialogOpen: Dispatch<SetStateAction<boolean>>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useViewerIntegration(
  input: UseViewerIntegrationInput,
): ViewerIntegrationResult {
  const {
    state,
    zoom,
    history,
    presentation,
    annotations,
    actionSoundHandlerRef,
    editorOps,
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
  } = input;

  // ── Global pointer handlers for drag / resize / adjustment ────
  usePointerHandlers({
    editorScale: zoom.editorScale,
    canvasStageRef: zoom.canvasStageRef,
    canvasSize,
    activeSlide,
    activeSlideIndex,
    gridSpacingPx,
    dragStateRef: state.dragStateRef,
    resizeStateRef: state.resizeStateRef,
    shapeAdjustmentDragStateRef: state.shapeAdjustmentDragStateRef,
    marqueeStateRef: state.marqueeStateRef,
    editTemplateMode: state.editTemplateMode,
    snapToGrid: state.snapToGrid,
    snapToShape: state.snapToShape,
    guides: state.guides,
    templateElements: state.templateElements,
    elementLookup: state.elementLookup,
    setMarqueeSelectionState: state.setMarqueeSelectionState,
    setSnapLines: state.setSnapLines,
    setTemplateElementsBySlideId: state.setTemplateElementsBySlideId,
    setPointerCommitNonce: state.setPointerCommitNonce,
    effectiveSelectedIds: state.effectiveSelectedIds,
    applySelection: editorOps.ops.applySelection,
    clearSelection: editorOps.ops.clearSelection,
    updateSlides: editorOps.ops.updateSlides,
    updateElementById: editorOps.ops.updateElementById,
    markDirty: history.markDirty,
  });

  // ── Content lifecycle (load, font, serialize, autosave) ───────
  const [isEncryptedDialogOpen, setIsEncryptedDialogOpen] = useState(false);
  const { handlerRef, serializeSlides, autosaveStatus } = useContentLifecycle({
    content,
    filePath,
    slides,
    state,
    history,
    ops: editorOps.ops,
    actionSoundHandlerRef,
    setIsEncryptedDialogOpen,
  });

  // ── I/O handlers (export, print, theme, properties) ───────────
  const { exportHandlers, printHandlers, themeHandlers, propertyHandlers } =
    useIOHandlers({
      state,
      slides,
      activeSlideIndex,
      canvasSize,
      filePath,
      history,
      ops: editorOps.ops,
      zoom,
      handlerRef,
      serializeSlides,
      setContent,
      onContentChange,
    });

  // ── Mode switching with annotation awareness ──────────────────
  const {
    showKeepAnnotationsDialog,
    handleSetMode,
    handleKeepAnnotations,
    handleDiscardAnnotations,
    handleEnterPresenterView,
    handleEnterRehearsalMode,
  } = useAnnotationHandlers({
    mode,
    presentation,
    annotations,
    history,
    setMode: state.setMode,
    setSlides: state.setSlides,
  });

  // ── Recovery detection ────────────────────────────────────────
  useRecoveryDetection({
    filePath,
    loading,
    error,
    slideCount: slides.length,
    openVersionHistory: () => propertyHandlers.setIsVersionHistoryOpen(true),
  });

  // ── Imperative handle ─────────────────────────────────────────
  useImperativeHandle(
    ref,
    () => ({
      async getContent() {
        const data = await serializeSlides();
        if (data && onContentChange) onContentChange(data);
        return data ?? new Uint8Array(0);
      },
    }),
    [serializeSlides, onContentChange],
  );

  // ── Notify parent callbacks ───────────────────────────────────
  useEffect(() => {
    if (onDirtyChange) onDirtyChange(state.isDirty);
  }, [state.isDirty, onDirtyChange]);

  useEffect(() => {
    if (onActiveSlideChange) onActiveSlideChange(activeSlideIndex);
  }, [activeSlideIndex, onActiveSlideChange]);

  useEffect(() => {
    state.activeSlideIndexRef.current = activeSlideIndex;
  }, [activeSlideIndex, state.activeSlideIndexRef]);

  // ── Keyboard shortcuts ────────────────────────────────────────
  useKeyboardShortcutWiring({
    state,
    mode,
    canEdit,
    slides,
    activeSlide,
    ops: editorOps.ops,
    manipulation: editorOps.manipulation,
    history,
  });

  return {
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
  };
}
