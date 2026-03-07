/**
 * useEditorOperations — Composes all editor-interaction hooks (element ops,
 * section ops, find/replace, comments, canvas interactions, insert, manipulate,
 * slide management, table operations) into a single return value.
 */
import type React from "react";

import type { PptxSlide, PptxElement } from "pptx-viewer-core";
import type { ViewerMode, CanvasSize } from "../types";

import {
  useElementOperations,
  type ElementOperations,
} from "./useElementOperations";
import {
  useSectionOperations,
  type SectionOperations,
} from "./useSectionOperations";
import { useFindReplace } from "./useFindReplace";
import { useComments } from "./useComments";
import {
  useCanvasInteractions,
  type CanvasInteractionHandlers,
} from "./useCanvasInteractions";
import {
  useInsertElements,
  type InsertElementHandlers,
} from "./useInsertElements";
import {
  useElementManipulation,
  type ElementManipulationHandlers,
} from "./useElementManipulation";
import {
  useSlideManagement,
  type SlideManagementHandlers,
} from "./useSlideManagement";
import {
  useTableOperations,
  type TableOperationHandlers,
} from "./useTableOperations";
import type { EditorHistoryResult } from "./useEditorHistory";
import type { ViewerState } from "./useViewerState";
import type { ViewerDialogsResult } from "./useViewerDialogs";
import type { UsePresentationModeResult } from "./usePresentationMode";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UseEditorOperationsInput {
  state: ViewerState;
  history: EditorHistoryResult;
  zoom: {
    editorScale: number;
    canvasStageRef: React.RefObject<HTMLDivElement | null>;
  };
  mode: ViewerMode;
  canEdit: boolean;
  slides: PptxSlide[];
  activeSlide: PptxSlide | undefined;
  activeSlideIndex: number;
  selectedElement: PptxElement | null;
  selectedElementId: string | null;
  selectedElementIds: string[];
  canvasSize: CanvasSize;
  dialogs: ViewerDialogsResult;
  presentation: UsePresentationModeResult;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface EditorOperationsResult {
  ops: ElementOperations;
  sectionOps: SectionOperations;
  findReplace: ReturnType<typeof useFindReplace>;
  comments: ReturnType<typeof useComments>;
  canvasHandlers: CanvasInteractionHandlers;
  insertHandlers: InsertElementHandlers;
  manipulation: ElementManipulationHandlers;
  slideOps: SlideManagementHandlers;
  tableOps: TableOperationHandlers;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEditorOperations(
  input: UseEditorOperationsInput,
): EditorOperationsResult {
  const {
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
  } = input;

  const ops = useElementOperations({
    slides,
    activeSlide,
    activeSlideIndex,
    selectedElement,
    selectedElementId,
    templateElementsBySlideId: state.templateElementsBySlideId,
    history,
    setSlides: state.setSlides,
    setTemplateElementsBySlideId: state.setTemplateElementsBySlideId,
    setSelectedElementId: state.setSelectedElementId,
    setSelectedElementIds: state.setSelectedElementIds,
    setInlineEditingElementId: state.setInlineEditingElementId,
    setContextMenuState: state.setContextMenuState,
  });

  const sectionOps = useSectionOperations({
    sections: state.sections,
    setSections: state.setSections,
    slides,
    setSlides: state.setSlides,
    markDirty: history.markDirty,
  });

  const findReplace = useFindReplace({
    slides,
    mode,
    onSetActiveSlideIndex: state.setActiveSlideIndex,
    onSetSelectedElementId: state.setSelectedElementId,
    onUpdateSlides: ops.updateSlides,
    onMarkDirty: history.markDirty,
  });

  const comments = useComments({
    slides,
    activeSlideIndex,
    canEdit,
    selectedElementId: state.selectedElementId,
    onUpdateSlides: ops.updateSlides,
    onMarkDirty: history.markDirty,
  });

  const canvasHandlers = useCanvasInteractions({
    mode,
    canEdit,
    canvasSize,
    activeSlideIndex,
    selectedElementId,
    selectedElementIds,
    selectedElementIdSet: state.selectedElementIdSet,
    inlineEditingElementId: state.inlineEditingElementId,
    effectiveSelectedIds: state.effectiveSelectedIds,
    elementLookup: state.elementLookup,
    activeTool: state.activeTool,
    editTemplateMode: state.editTemplateMode,
    editorScale: zoom.editorScale,
    canvasStageRef: zoom.canvasStageRef,
    dragStateRef: state.dragStateRef,
    resizeStateRef: state.resizeStateRef,
    shapeAdjustmentDragStateRef: state.shapeAdjustmentDragStateRef,
    marqueeStateRef: state.marqueeStateRef,
    setInlineEditingElementId: state.setInlineEditingElementId,
    setInlineEditingText: state.setInlineEditingText,
    setContextMenuState: state.setContextMenuState,
    setMarqueeSelectionState: state.setMarqueeSelectionState,
    setSnapLines: state.setSnapLines,
    inlineEditingText: state.inlineEditingText,
    ops,
    history,
    presentationHandleAction: presentation.handlePresentationAction,
    setEditingEquationOmml: dialogs.setEditingEquationOmml,
    setIsEquationDialogOpen: dialogs.setIsEquationDialogOpen,
  });

  const insertHandlers = useInsertElements({
    activeSlide,
    activeSlideIndex,
    canvasSize,
    newShapeType: state.newShapeType,
    selectedElements: state.selectedElements,
    ops,
    history,
  });

  const manipulation = useElementManipulation({
    activeSlide,
    activeSlideIndex,
    selectedElement,
    effectiveSelectedIds: state.effectiveSelectedIds,
    selectedElements: state.selectedElements,
    selectedElementIdSet: state.selectedElementIdSet,
    elementLookup: state.elementLookup,
    editTemplateMode: state.editTemplateMode,
    clipboardPayload: state.clipboardPayload,
    setClipboardPayload: state.setClipboardPayload,
    setSelectedElementIds: state.setSelectedElementIds,
    setTemplateElementsBySlideId: state.setTemplateElementsBySlideId,
    setIsInspectorPaneOpen: state.setIsInspectorPaneOpen,
    setSidebarPanelMode: state.setSidebarPanelMode,
    ops,
    history,
    onOpenHyperlinkDialog: () => dialogs.setIsHyperlinkDialogOpen(true),
  });

  const slideOps = useSlideManagement({
    slides,
    activeSlide,
    activeSlideIndex,
    setActiveSlideIndex: state.setActiveSlideIndex,
    ops,
    history,
  });

  const tableOps = useTableOperations({
    selectedElement,
    elementLookup: state.elementLookup,
    tableEditorState: state.tableEditorState,
    setTableEditorState: state.setTableEditorState,
    ops,
    history,
  });

  return {
    ops,
    sectionOps,
    findReplace,
    comments,
    canvasHandlers,
    insertHandlers,
    manipulation,
    slideOps,
    tableOps,
  };
}
