/**
 * Core data-model types for the PowerPoint viewer/editor plugin.
 *
 * Framework-agnostic types (PptxElement, PptxSlide, TextStyle, etc.)
 * live in `pptx-viewer-core`. This module defines additional types used
 * by the React viewer layer for canvas layout, drag/resize interactions,
 * clipboard operations, undo/redo history, geometry, and shape quick styles.
 */

import type { PptxElement, PptxSlide, ShapeStyle } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Viewer mode
// ---------------------------------------------------------------------------

/**
 * The current operating mode of the PowerPoint viewer.
 *
 * - `"preview"` -- Read-only viewing with no editing controls.
 * - `"edit"` -- Full editing mode with toolbar, inspector, and canvas interaction.
 * - `"present"` -- Fullscreen presentation/slideshow mode with animations.
 * - `"master"` -- Slide master editing mode for template/layout manipulation.
 */
export type ViewerMode = "preview" | "edit" | "present" | "master";

// ---------------------------------------------------------------------------
// Shape types
// ---------------------------------------------------------------------------

/**
 * Union of all shape preset types that the viewer can insert or render.
 * Maps to OOXML `a:prstGeom` preset values (e.g. "rect", "ellipse").
 * Includes basic shapes, arrows, connectors, and freeform paths.
 */
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

/**
 * Connector geometry presets corresponding to OOXML `a:prstGeom` connector types.
 * Determines the routing style (straight, bent with N segments, or curved).
 */
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

/** The pixel dimensions of the slide canvas (presentation slide size). */
export interface CanvasSize {
  /** Width of the canvas in CSS pixels. */
  width: number;
  /** Height of the canvas in CSS pixels. */
  height: number;
}

// ---------------------------------------------------------------------------
// Drag & resize interaction
// ---------------------------------------------------------------------------

/**
 * Tracks the state of an ongoing element drag operation.
 * Created on pointer-down and destroyed on pointer-up.
 * During the drag, position changes are applied directly to DOM elements
 * for performance (bypassing React state) and committed to state on completion.
 */
export interface DragState {
  /** ID of the primary element being dragged. */
  elementId: string;
  /** Client X coordinate at the start of the drag. */
  startClientX: number;
  /** Client Y coordinate at the start of the drag. */
  startClientY: number;
  /** Original positions of all selected elements, keyed by element ID. */
  startPositionsById: Record<string, { x: number; y: number }>;
  /** DOM elements cached at drag-start to avoid per-frame querySelector calls. */
  domEls: Map<string, HTMLElement>;
  /** Whether the pointer has actually moved since the drag started. */
  moved: boolean;
  /** Accumulated delta — stored during DOM-only drag, committed on pointerup. */
  lastDx: number;
  lastDy: number;
}

/** Corner handle used as the resize anchor point. */
export type ResizeHandle = "nw" | "ne" | "sw" | "se";

/**
 * Tracks the state of an ongoing element resize operation.
 * Uses direct DOM manipulation during the resize for performance,
 * then commits the final geometry to React state on pointer-up.
 */
export interface ResizeState {
  /** ID of the element being resized. */
  elementId: string;
  /** Client X coordinate at the start of the resize. */
  startClientX: number;
  /** Client Y coordinate at the start of the resize. */
  startClientY: number;
  /** Original X position of the element. */
  startX: number;
  /** Original Y position of the element. */
  startY: number;
  /** Original width of the element. */
  startWidth: number;
  /** Original height of the element. */
  startHeight: number;
  /** Which corner handle initiated the resize. */
  handle: ResizeHandle;
  /** Whether the pointer has actually moved since the resize started. */
  moved: boolean;
  /** DOM element cached at resize-start to avoid per-frame querySelector calls. */
  domEl: HTMLElement | null;
  /** Accumulated final geometry — committed on pointerup. */
  lastX: number;
  lastY: number;
  lastWidth: number;
  lastHeight: number;
}

/**
 * Describes the position and value of a shape adjustment handle (yellow diamond).
 * Adjustment handles allow users to modify shape parameters like corner radius,
 * arrow width, etc. without a full resize.
 */
export interface ShapeAdjustmentHandleDescriptor {
  key: string;
  left: number;
  top: number;
  value: number;
  cursor: string;
}

/**
 * Tracks the state of an ongoing shape adjustment handle drag.
 * Used when the user drags the yellow diamond handle to alter
 * shape-specific parameters (e.g. corner radius on a rounded rectangle).
 */
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

/** Payload stored when an element is copied/cut to the internal clipboard. */
export interface ElementClipboardPayload {
  element: PptxElement;
  isTemplate: boolean;
}

/**
 * A snapshot of editor state captured for undo/redo history.
 * Contains the full slide deck state at a point in time so that
 * any editing operation can be reverted or replayed.
 */
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

/** Axis-aligned bounding box for an element, used for hit-testing and alignment. */
export interface ElementBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Geometry data for rendering a connector line as an SVG path.
 * Includes start/end coordinates, the SVG path data string,
 * and optional marker (arrowhead) identifiers.
 */
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

/** A named preset shape style used in the Quick Styles gallery. */
export interface ShapeQuickStyle {
  name: string;
  style: Partial<ShapeStyle>;
}
