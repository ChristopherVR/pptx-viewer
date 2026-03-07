/**
 * Extracted pointer-move processing logic for usePointerHandlers.
 * Handles marquee, drag, resize, and shape-adjustment interactions.
 */
import type { PptxElement } from "pptx-viewer-core";
import { MIN_ELEMENT_SIZE } from "../constants";
import { computeSnapToShapeResult } from "../utils/geometry-selection";
import type {
  UsePointerHandlersInput,
  PointerFrameTracker,
} from "./pointer-handler-types";

export function processPointerMove(
  e: PointerEvent,
  input: UsePointerHandlersInput,
  tracker: PointerFrameTracker,
): void {
  const {
    editorScale,
    canvasStageRef,
    canvasSize,
    snapToGrid,
    snapToShape,
    gridSpacingPx,
    editTemplateMode,
    templateElements,
    activeSlide,
    guides,
    elementLookup,
    marqueeStateRef,
    dragStateRef,
    resizeStateRef,
    shapeAdjustmentDragStateRef,
    setMarqueeSelectionState,
    setSnapLines,
    updateElementById,
  } = input;

  const marquee = marqueeStateRef.current;
  if (marquee) {
    processMarqueeMove(
      e,
      marquee,
      canvasStageRef,
      canvasSize,
      editorScale,
      setMarqueeSelectionState,
    );
    return;
  }

  const drag = dragStateRef.current;
  if (drag) {
    processDragMove(
      e,
      drag,
      editorScale,
      snapToGrid,
      snapToShape,
      gridSpacingPx,
      editTemplateMode,
      templateElements,
      activeSlide,
      guides,
      elementLookup,
      tracker,
      setSnapLines,
    );
    return;
  }

  const rs = resizeStateRef.current;
  if (rs) {
    processResizeMove(e, rs, editorScale, snapToGrid, gridSpacingPx);
    return;
  }

  const adj = shapeAdjustmentDragStateRef.current;
  if (adj) {
    processAdjustmentMove(e, adj, editorScale, updateElementById);
  }
}

// ── Marquee ──────────────────────────────────────────────────────────────────

function processMarqueeMove(
  e: PointerEvent,
  marquee: NonNullable<UsePointerHandlersInput["marqueeStateRef"]["current"]>,
  canvasStageRef: UsePointerHandlersInput["canvasStageRef"],
  canvasSize: UsePointerHandlersInput["canvasSize"],
  editorScale: number,
  setMarqueeSelectionState: UsePointerHandlersInput["setMarqueeSelectionState"],
): void {
  const stage = canvasStageRef.current;
  if (!stage) return;
  const rect = stage.getBoundingClientRect();
  marquee.currentX = Math.max(
    0,
    Math.min(canvasSize.width, (e.clientX - rect.left) / editorScale),
  );
  marquee.currentY = Math.max(
    0,
    Math.min(canvasSize.height, (e.clientY - rect.top) / editorScale),
  );
  setMarqueeSelectionState({ ...marquee });
}

// ── Drag ─────────────────────────────────────────────────────────────────────

function processDragMove(
  e: PointerEvent,
  drag: NonNullable<UsePointerHandlersInput["dragStateRef"]["current"]>,
  editorScale: number,
  snapToGrid: boolean,
  snapToShape: boolean,
  gridSpacingPx: number,
  editTemplateMode: boolean,
  templateElements: PptxElement[],
  activeSlide: UsePointerHandlersInput["activeSlide"],
  guides: UsePointerHandlersInput["guides"],
  elementLookup: UsePointerHandlersInput["elementLookup"],
  tracker: PointerFrameTracker,
  setSnapLines: UsePointerHandlersInput["setSnapLines"],
): void {
  const dx = (e.clientX - drag.startClientX) / editorScale;
  const dy = (e.clientY - drag.startClientY) / editorScale;
  if (!drag.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) drag.moved = true;
  if (!drag.moved) return;

  let appliedDx = dx;
  let appliedDy = dy;
  const draggedIds = Object.keys(drag.startPositionsById);
  const primaryId = draggedIds[0];
  const primaryStart = primaryId
    ? drag.startPositionsById[primaryId]
    : undefined;
  const primaryEl = primaryId ? elementLookup.get(primaryId) : undefined;

  if (primaryStart && primaryEl) {
    let targetX = primaryStart.x + appliedDx;
    let targetY = primaryStart.y + appliedDy;
    if (snapToGrid) {
      targetX = Math.round(targetX / gridSpacingPx) * gridSpacingPx;
      targetY = Math.round(targetY / gridSpacingPx) * gridSpacingPx;
    }
    if (snapToShape) {
      const siblingSource = editTemplateMode
        ? templateElements
        : (activeSlide?.elements ?? []);
      const siblings = siblingSource.map((el) => ({
        id: el.id,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
      }));
      const snapResult = computeSnapToShapeResult(
        targetX,
        targetY,
        primaryEl.width,
        primaryEl.height,
        siblings,
        new Set(draggedIds),
        guides.map((g) => ({ axis: g.axis, position: g.position })),
      );
      targetX = snapResult.x;
      targetY = snapResult.y;
      const newSnapLines = snapResult.lines.map((line) => ({
        axis: line.axis === "v" ? "x" : "y",
        position: line.position,
      }));
      const newKey = JSON.stringify(newSnapLines);
      if (newKey !== tracker.lastSnapLinesKey) {
        tracker.lastSnapLinesKey = newKey;
        setSnapLines(newSnapLines as { axis: "x" | "y"; position: number }[]);
      }
    } else if (tracker.lastSnapLinesKey !== "[]") {
      tracker.lastSnapLinesKey = "[]";
      setSnapLines([]);
    }
    appliedDx = targetX - primaryStart.x;
    appliedDy = targetY - primaryStart.y;
  }
  drag.lastDx = appliedDx;
  drag.lastDy = appliedDy;
  for (const [id, domEl] of drag.domEls) {
    const start = drag.startPositionsById[id];
    if (start) {
      domEl.style.left = `${start.x + appliedDx}px`;
      domEl.style.top = `${start.y + appliedDy}px`;
    }
  }
}

// ── Resize ───────────────────────────────────────────────────────────────────

function processResizeMove(
  e: PointerEvent,
  rs: NonNullable<UsePointerHandlersInput["resizeStateRef"]["current"]>,
  editorScale: number,
  snapToGrid: boolean,
  gridSpacingPx: number,
): void {
  const dx = (e.clientX - rs.startClientX) / editorScale;
  const dy = (e.clientY - rs.startClientY) / editorScale;
  if (!rs.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) rs.moved = true;
  if (!rs.moved) return;

  let newX = rs.startX,
    newY = rs.startY,
    newW = rs.startWidth,
    newH = rs.startHeight;
  switch (rs.handle) {
    case "se":
      newW = Math.max(MIN_ELEMENT_SIZE, rs.startWidth + dx);
      newH = Math.max(MIN_ELEMENT_SIZE, rs.startHeight + dy);
      break;
    case "sw":
      newX = rs.startX + dx;
      newW = Math.max(MIN_ELEMENT_SIZE, rs.startWidth - dx);
      newH = Math.max(MIN_ELEMENT_SIZE, rs.startHeight + dy);
      break;
    case "ne":
      newY = rs.startY + dy;
      newW = Math.max(MIN_ELEMENT_SIZE, rs.startWidth + dx);
      newH = Math.max(MIN_ELEMENT_SIZE, rs.startHeight - dy);
      break;
    case "nw":
      newX = rs.startX + dx;
      newY = rs.startY + dy;
      newW = Math.max(MIN_ELEMENT_SIZE, rs.startWidth - dx);
      newH = Math.max(MIN_ELEMENT_SIZE, rs.startHeight - dy);
      break;
  }
  if (snapToGrid) {
    const gs = gridSpacingPx;
    if (rs.handle === "se" || rs.handle === "ne") {
      const right = Math.round((newX + newW) / gs) * gs;
      newW = Math.max(MIN_ELEMENT_SIZE, right - newX);
    }
    if (rs.handle === "sw" || rs.handle === "nw") {
      const snappedX = Math.round(newX / gs) * gs;
      newW = Math.max(MIN_ELEMENT_SIZE, newW + (newX - snappedX));
      newX = snappedX;
    }
    if (rs.handle === "se" || rs.handle === "sw") {
      const bottom = Math.round((newY + newH) / gs) * gs;
      newH = Math.max(MIN_ELEMENT_SIZE, bottom - newY);
    }
    if (rs.handle === "ne" || rs.handle === "nw") {
      const snappedY = Math.round(newY / gs) * gs;
      newH = Math.max(MIN_ELEMENT_SIZE, newH + (newY - snappedY));
      newY = snappedY;
    }
  }
  rs.lastX = newX;
  rs.lastY = newY;
  rs.lastWidth = newW;
  rs.lastHeight = newH;
  if (rs.domEl) {
    rs.domEl.style.left = `${newX}px`;
    rs.domEl.style.top = `${newY}px`;
    rs.domEl.style.width = `${Math.max(newW, MIN_ELEMENT_SIZE)}px`;
    rs.domEl.style.height = `${Math.max(newH, MIN_ELEMENT_SIZE)}px`;
  }
}

// ── Shape adjustment ─────────────────────────────────────────────────────────

function processAdjustmentMove(
  e: PointerEvent,
  adj: NonNullable<
    UsePointerHandlersInput["shapeAdjustmentDragStateRef"]["current"]
  >,
  editorScale: number,
  updateElementById: UsePointerHandlersInput["updateElementById"],
): void {
  const dx = (e.clientX - adj.startClientX) / editorScale;
  const range = adj.startWidth || 200;
  const delta = dx / range;
  const newValue = Math.max(0, Math.min(1, adj.startAdjustment + delta));
  if (!adj.moved && Math.abs(dx) > 2) adj.moved = true;
  if (adj.moved) {
    updateElementById(adj.elementId, {
      shapeAdjustments: { [adj.key]: newValue },
    } as Partial<PptxElement>);
  }
}
