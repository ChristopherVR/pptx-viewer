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

// ---------------------------------------------------------------------------
// Pure helper functions (exported for testing)
// ---------------------------------------------------------------------------

export interface ResizeGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Compute new resize geometry from a delta and handle position. */
export function computeResizeGeometry(
  handle: "nw" | "ne" | "sw" | "se",
  startX: number,
  startY: number,
  startWidth: number,
  startHeight: number,
  dx: number,
  dy: number,
  snapToGrid: boolean,
  gridSpacingPx: number,
): ResizeGeometry {
  let newX = startX,
    newY = startY,
    newW = startWidth,
    newH = startHeight;
  switch (handle) {
    case "se":
      newW = Math.max(MIN_ELEMENT_SIZE, startWidth + dx);
      newH = Math.max(MIN_ELEMENT_SIZE, startHeight + dy);
      break;
    case "sw":
      newX = startX + dx;
      newW = Math.max(MIN_ELEMENT_SIZE, startWidth - dx);
      newH = Math.max(MIN_ELEMENT_SIZE, startHeight + dy);
      break;
    case "ne":
      newY = startY + dy;
      newW = Math.max(MIN_ELEMENT_SIZE, startWidth + dx);
      newH = Math.max(MIN_ELEMENT_SIZE, startHeight - dy);
      break;
    case "nw":
      newX = startX + dx;
      newY = startY + dy;
      newW = Math.max(MIN_ELEMENT_SIZE, startWidth - dx);
      newH = Math.max(MIN_ELEMENT_SIZE, startHeight - dy);
      break;
  }
  if (snapToGrid) {
    const gs = gridSpacingPx;
    if (handle === "se" || handle === "ne") {
      const right = Math.round((newX + newW) / gs) * gs;
      newW = Math.max(MIN_ELEMENT_SIZE, right - newX);
    }
    if (handle === "sw" || handle === "nw") {
      const snappedX = Math.round(newX / gs) * gs;
      newW = Math.max(MIN_ELEMENT_SIZE, newW + (newX - snappedX));
      newX = snappedX;
    }
    if (handle === "se" || handle === "sw") {
      const bottom = Math.round((newY + newH) / gs) * gs;
      newH = Math.max(MIN_ELEMENT_SIZE, bottom - newY);
    }
    if (handle === "ne" || handle === "nw") {
      const snappedY = Math.round(newY / gs) * gs;
      newH = Math.max(MIN_ELEMENT_SIZE, newH + (newY - snappedY));
      newY = snappedY;
    }
  }
  return { x: newX, y: newY, width: newW, height: newH };
}

/** Compute new shape adjustment value from pointer delta. */
export function computeAdjustmentValue(
  startAdjustment: number,
  dx: number,
  startWidth: number,
): number {
  const range = startWidth || 200;
  const delta = dx / range;
  return Math.max(0, Math.min(1, startAdjustment + delta));
}

// ---------------------------------------------------------------------------
// Main pointer-move processor
// ---------------------------------------------------------------------------

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

  const geo = computeResizeGeometry(
    rs.handle,
    rs.startX,
    rs.startY,
    rs.startWidth,
    rs.startHeight,
    dx,
    dy,
    snapToGrid,
    gridSpacingPx,
  );
  rs.lastX = geo.x;
  rs.lastY = geo.y;
  rs.lastWidth = geo.width;
  rs.lastHeight = geo.height;
  if (rs.domEl) {
    rs.domEl.style.left = `${geo.x}px`;
    rs.domEl.style.top = `${geo.y}px`;
    rs.domEl.style.width = `${Math.max(geo.width, MIN_ELEMENT_SIZE)}px`;
    rs.domEl.style.height = `${Math.max(geo.height, MIN_ELEMENT_SIZE)}px`;
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
  const newValue = computeAdjustmentValue(adj.startAdjustment, dx, adj.startWidth);
  if (!adj.moved && Math.abs(dx) > 2) adj.moved = true;
  if (adj.moved) {
    updateElementById(adj.elementId, {
      shapeAdjustments: { [adj.key]: newValue },
    } as Partial<PptxElement>);
  }
}
