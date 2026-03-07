/** useCanvasInteractions — Canvas interaction handlers for the PowerPoint editor. */
import { type PptxElement, hasTextProperties } from "pptx-viewer-core";
import type {
  CanvasSize,
  DragState,
  MarqueeSelectionState,
  ResizeState,
  ShapeAdjustmentDragState,
  ElementContextMenuState,
} from "../types";
import type { ViewerMode } from "../types-core";
import type { ElementOperations } from "./useElementOperations";
import type { EditorHistoryResult } from "./useEditorHistory";
import { remapTextToSegments } from "../utils/remap-text";
import type { CanvasInteractionHandlers } from "./canvas-interaction-types";
export type { CanvasInteractionHandlers } from "./canvas-interaction-types";

export interface UseCanvasInteractionsInput {
  mode: ViewerMode;
  canEdit: boolean;
  canvasSize: CanvasSize;
  activeSlideIndex: number;
  selectedElementId: string | null;
  selectedElementIds: string[];
  selectedElementIdSet: Set<string>;
  inlineEditingElementId: string | null;
  effectiveSelectedIds: string[];
  elementLookup: Map<string, PptxElement>;
  activeTool: string;
  editTemplateMode: boolean;
  editorScale: number;
  canvasStageRef: React.RefObject<HTMLDivElement | null>;
  dragStateRef: React.MutableRefObject<DragState | null>;
  resizeStateRef: React.MutableRefObject<ResizeState | null>;
  shapeAdjustmentDragStateRef: React.MutableRefObject<ShapeAdjustmentDragState | null>;
  marqueeStateRef: React.MutableRefObject<MarqueeSelectionState | null>;
  setInlineEditingElementId: React.Dispatch<
    React.SetStateAction<string | null>
  >;
  setInlineEditingText: React.Dispatch<React.SetStateAction<string>>;
  setContextMenuState: React.Dispatch<
    React.SetStateAction<ElementContextMenuState | null>
  >;
  setMarqueeSelectionState: React.Dispatch<
    React.SetStateAction<MarqueeSelectionState | null>
  >;
  setSnapLines: React.Dispatch<
    React.SetStateAction<Array<{ axis: string; position: number }>>
  >;
  inlineEditingText: string;
  ops: ElementOperations;
  history: EditorHistoryResult;
  presentationHandleAction: (action: Record<string, unknown>) => void;
  setEditingEquationOmml: (omml: Record<string, unknown> | null) => void;
  setIsEquationDialogOpen: (open: boolean) => void;
}

export function useCanvasInteractions(
  input: UseCanvasInteractionsInput,
): CanvasInteractionHandlers {
  const {
    mode,
    canEdit,
    canvasSize,
    selectedElementId,
    selectedElementIds,
    selectedElementIdSet,
    inlineEditingElementId,
    effectiveSelectedIds,
    elementLookup,
    activeTool,
    editorScale,
    canvasStageRef,
    dragStateRef,
    resizeStateRef,
    shapeAdjustmentDragStateRef,
    marqueeStateRef,
    setInlineEditingElementId,
    setInlineEditingText,
    setContextMenuState,
    setMarqueeSelectionState,
    setSnapLines,
    inlineEditingText,
    ops,
    history,
    presentationHandleAction,
    setEditingEquationOmml,
    setIsEquationDialogOpen,
  } = input;

  const handleElementClick = (elementId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (mode === "present") {
      const el = elementLookup.get(elementId);
      if (el?.actionClick)
        presentationHandleAction(el.actionClick as Record<string, unknown>);
      return;
    }
    if (e.shiftKey || e.metaKey) {
      const ids = selectedElementIds.length
        ? selectedElementIds
        : selectedElementId
          ? [selectedElementId]
          : [];
      const newIds = ids.includes(elementId)
        ? ids.filter((id) => id !== elementId)
        : [...ids, elementId];
      ops.applySelection(newIds[0] ?? null, newIds);
    } else if (selectedElementIdSet.has(elementId) && !inlineEditingElementId) {
      const el = elementLookup.get(elementId);
      if (el && hasTextProperties(el) && !el.locks?.noTextEdit) {
        setInlineEditingElementId(elementId);
        setInlineEditingText(el.text ?? "");
      }
    } else {
      ops.applySelection(elementId);
    }
  };

  const handleElementDoubleClick = (
    elementId: string,
    _e: React.MouseEvent,
  ) => {
    const el = elementLookup.get(elementId);
    if (!el) return;
    if (
      hasTextProperties(el) &&
      el.textSegments?.some((seg) => seg.equationXml)
    ) {
      const eqSeg = el.textSegments?.find((seg) => seg.equationXml);
      if (eqSeg?.equationXml) {
        setEditingEquationOmml(eqSeg.equationXml);
        setIsEquationDialogOpen(true);
        return;
      }
    }
    if (hasTextProperties(el)) {
      setInlineEditingElementId(elementId);
      setInlineEditingText(el.text ?? "");
    }
  };

  const handleElementMouseDown = (elementId: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (!selectedElementIdSet.has(elementId)) ops.applySelection(elementId);
    const ids = effectiveSelectedIds.length
      ? effectiveSelectedIds
      : [elementId];
    const startPositions: Record<string, { x: number; y: number }> = {};
    const domEls = new Map<string, HTMLElement>();
    for (const id of ids) {
      const el = elementLookup.get(id);
      if (el) startPositions[id] = { x: el.x, y: el.y };
      const domEl = document.querySelector(
        `[data-element-id="${id}"]`,
      ) as HTMLElement | null;
      if (domEl) domEls.set(id, domEl);
    }
    dragStateRef.current = {
      elementId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPositionsById: startPositions,
      domEls,
      moved: false,
      lastDx: 0,
      lastDy: 0,
    };
    setSnapLines([]);
  };

  const handleElementContextMenu = (elementId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedElementIdSet.has(elementId)) ops.applySelection(elementId);
    setContextMenuState({ x: e.clientX, y: e.clientY, elementId });
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (
      mode !== "edit" ||
      !canEdit ||
      e.button !== 0 ||
      activeTool !== "select"
    )
      return;
    const stage = canvasStageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const scale = editorScale || 1;
    const startX = Math.max(
      0,
      Math.min(canvasSize.width, (e.clientX - rect.left) / scale),
    );
    const startY = Math.max(
      0,
      Math.min(canvasSize.height, (e.clientY - rect.top) / scale),
    );
    const additive = e.shiftKey || e.metaKey;
    const nextMarquee = {
      startX,
      startY,
      currentX: startX,
      currentY: startY,
      additive,
      baseSelectionIds: additive ? effectiveSelectedIds : [],
    };
    marqueeStateRef.current = nextMarquee;
    setMarqueeSelectionState(nextMarquee);
    setContextMenuState(null);
  };

  const handleResizePointerDown = (
    elementId: string,
    e: React.MouseEvent,
    handle: string,
  ) => {
    e.stopPropagation();
    const el = elementLookup.get(elementId);
    if (!el) return;
    resizeStateRef.current = {
      elementId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: el.x,
      startY: el.y,
      startWidth: el.width,
      startHeight: el.height,
      handle: handle as "nw" | "ne" | "sw" | "se",
      moved: false,
      domEl: document.querySelector(
        `[data-element-id="${elementId}"]`,
      ) as HTMLElement | null,
      lastX: el.x,
      lastY: el.y,
      lastWidth: el.width,
      lastHeight: el.height,
    };
  };

  const handleAdjustmentPointerDown = (
    elementId: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    const el = elementLookup.get(elementId);
    if (!el || !("shapeType" in el) || !("shapeAdjustments" in el)) return;
    const adjEntries = Object.entries(
      (el as { shapeAdjustments?: Record<string, number> }).shapeAdjustments ??
        {},
    );
    if (!adjEntries.length) return;
    const [key, value] = adjEntries[0];
    shapeAdjustmentDragStateRef.current = {
      elementId,
      key,
      shapeType: (el as { shapeType?: string }).shapeType ?? "rect",
      startClientX: e.clientX,
      startClientY: e.clientY,
      startAdjustment: value,
      startWidth: el.width,
      startHeight: el.height,
      moved: false,
    };
  };

  const handleInlineEditCommit = () => {
    const editId = inlineEditingElementId;
    if (!editId) return;
    const el = elementLookup.get(editId);
    if (el && hasTextProperties(el)) {
      const newSegments = remapTextToSegments(
        inlineEditingText,
        el.textSegments,
        el.textStyle,
      );
      ops.updateElementById(editId, {
        text: inlineEditingText,
        textSegments: newSegments,
      } as Partial<PptxElement>);
      history.markDirty();
    }
    setInlineEditingElementId(null);
    setInlineEditingText("");
  };

  return {
    handleElementClick,
    handleElementDoubleClick,
    handleElementMouseDown,
    handleElementContextMenu,
    handleCanvasMouseDown,
    handleResizePointerDown,
    handleAdjustmentPointerDown,
    handleInlineEditCommit,
  };
}
