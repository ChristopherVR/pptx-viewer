/**
 * Core data-model types for the PowerPoint viewer/editor plugin.
 *
 * Framework-agnostic types (PptxElement, PptxSlide, TextStyle, etc.)
 * live in `@lib/pptx-editor/types`.
 */

import type { PptxElement, PptxSlide, ShapeStyle } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Viewer mode
// ---------------------------------------------------------------------------

export type ViewerMode = "preview" | "edit" | "present" | "master";

// ---------------------------------------------------------------------------
// Shape types
// ---------------------------------------------------------------------------

export type SupportedShapeType =
  | "rect"
  | "roundRect"
  | "ellipse"
  | "triangle"
  | "rtTriangle"
  | "diamond"
  | "cylinder"
  | "parallelogram"
  | "trapezoid"
  | "pentagon"
  | "hexagon"
  | "octagon"
  | "chevron"
  | "star5"
  | "star6"
  | "star8"
  | "plus"
  | "heart"
  | "cloud"
  | "sun"
  | "moon"
  | "pie"
  | "plaque"
  | "teardrop"
  | "line"
  | "rtArrow"
  | "leftArrow"
  | "upArrow"
  | "downArrow"
  | "connector"
  | "freeform";

export type ConnectorGeometryType =
  | "straightConnector1"
  | "bentConnector2"
  | "bentConnector3"
  | "bentConnector4"
  | "bentConnector5"
  | "curvedConnector2"
  | "curvedConnector3"
  | "curvedConnector4"
  | "curvedConnector5";

// ---------------------------------------------------------------------------
// Canvas / layout
// ---------------------------------------------------------------------------

export interface CanvasSize {
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Drag & resize interaction
// ---------------------------------------------------------------------------

export interface DragState {
  elementId: string;
  startClientX: number;
  startClientY: number;
  startPositionsById: Record<string, { x: number; y: number }>;
  /** DOM elements cached at drag-start to avoid per-frame querySelector calls. */
  domEls: Map<string, HTMLElement>;
  moved: boolean;
  /** Accumulated delta — stored during DOM-only drag, committed on pointerup. */
  lastDx: number;
  lastDy: number;
}

export type ResizeHandle = "nw" | "ne" | "sw" | "se";

export interface ResizeState {
  elementId: string;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  handle: ResizeHandle;
  moved: boolean;
  /** DOM element cached at resize-start to avoid per-frame querySelector calls. */
  domEl: HTMLElement | null;
  /** Accumulated final geometry — committed on pointerup. */
  lastX: number;
  lastY: number;
  lastWidth: number;
  lastHeight: number;
}

export interface ShapeAdjustmentHandleDescriptor {
  key: string;
  left: number;
  top: number;
  value: number;
  cursor: string;
}

export interface ShapeAdjustmentDragState {
  elementId: string;
  key: string;
  shapeType: string;
  startClientX: number;
  startClientY: number;
  startAdjustment: number;
  startWidth: number;
  startHeight: number;
  moved: boolean;
}

// ---------------------------------------------------------------------------
// Clipboard / history
// ---------------------------------------------------------------------------

export interface ElementClipboardPayload {
  element: PptxElement;
  isTemplate: boolean;
}

export interface EditorHistorySnapshot {
  width: number;
  height: number;
  activeSlideIndex: number;
  slides: PptxSlide[];
  templateElementsBySlideId: Record<string, PptxElement[]>;
  actionLabel?: string;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export interface ElementBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ConnectorPathGeometry {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  pathData: string;
  d?: string;
  viewBox?: string;
  startMarkerId?: string;
  endMarkerId?: string;
}

// ---------------------------------------------------------------------------
// Shape quick styles
// ---------------------------------------------------------------------------

export interface ShapeQuickStyle {
  name: string;
  style: Partial<ShapeStyle>;
}
