/**
 * UI-related and interaction types for the PowerPoint viewer/editor plugin.
 *
 * These types support the interactive UI layer: context menus, marquee selection,
 * table cell editing, presentation animations, toolbar sections, slide navigation,
 * shortcut references, accessibility audits, option lists for dropdowns, and the
 * public component props/handle interfaces.
 */
import type React from "react";

import type {
  ConnectorArrowType,
  PptxAnimationPreset,
  PptxElementAnimation,
  PptxSlideTransition,
  StrokeDashType,
  XmlObject,
} from "pptx-viewer-core";
/**
 * Base handle interface for file viewer components.
 * Defined locally to avoid dependency on external file-viewer plugin packages.
 * Provides a standard `getContent` method used by the host application to
 * retrieve the current file content (e.g. for saving).
 */
export interface FileViewerHandle {
  /** Get the current content of the file (for saving) */
  getContent: () => Promise<string | Uint8Array>;
}
import type { ConnectorGeometryType, SupportedShapeType } from "./types-core";

// ---------------------------------------------------------------------------
// Shape presets (UI-only - icons are ReactNode)
// ---------------------------------------------------------------------------

/** A shape preset entry used in the toolbar shape insertion palette. */
export interface ShapePreset {
  type: SupportedShapeType;
  label: string;
  icon: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------

/** Tracks the position and target element of an open context menu. */
export interface ElementContextMenuState {
  x: number;
  y: number;
  elementId: string;
}

/** Identifies an action triggered from the element right-click context menu. */
export type ElementContextMenuAction =
  | "copy"
  | "cut"
  | "paste"
  | "duplicate"
  | "delete"
  | "bring-forward"
  | "send-backward"
  | "bring-front"
  | "send-back"
  | "bringForward"
  | "sendBackward"
  | "bringToFront"
  | "sendToBack"
  | "comment"
  | "addComment"
  | "group"
  | "ungroup"
  | "editPoints"
  | "editHyperlink";

// ---------------------------------------------------------------------------
// Marquee selection
// ---------------------------------------------------------------------------

/**
 * State of an active marquee (rubber-band) selection rectangle.
 * Created when the user clicks and drags on the canvas background,
 * and used to compute which elements fall within the selection area.
 */
export interface MarqueeSelectionState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
  baseSelectionIds?: string[];
}

// ---------------------------------------------------------------------------
// Table editing
// ---------------------------------------------------------------------------

/** Tracks which table cell is selected and/or actively being edited. */
export interface TableCellEditorState {
  rowIndex: number;
  columnIndex: number;
  /** When true the cell has an active text input. */
  isEditing?: boolean;
  /** Optional multi-cell selection (Shift+Click range). Each entry is {row, col}. */
  selectedCells?: Array<{ row: number; col: number }>;
}

/** A single parsed table cell with its position, text content, and computed CSS style. */
export interface ParsedTableCell {
  rowIndex: number;
  columnIndex: number;
  text: string;
  style: React.CSSProperties;
  rawCell: XmlObject;
}

/** Complete parsed table data including row/column structure and all cells. */
export interface ParsedTableData {
  rowCount: number;
  columnCount: number;
  rows: XmlObject[];
  columnPercentages: number[];
  cells: ParsedTableCell[];
}

// ---------------------------------------------------------------------------
// Presentation & animation
// ---------------------------------------------------------------------------

/** Runtime state for a single element's animation during presentation mode. */
export interface PresentationAnimationRuntime {
  elementId: string;
  state: "hidden" | "entering" | "visible";
  animation: PptxElementAnimation;
}

// ---------------------------------------------------------------------------
// Slide navigation
// ---------------------------------------------------------------------------

/**
 * Groups slides into named sections for the slides pane sidebar.
 * Corresponds to OOXML `p15:section` elements in `presentation.xml`.
 */
export interface SlideSectionGroup {
  id: string;
  label: string;
  slideIndexes: number[];
  /** Section highlight color from p15:sectionPr. */
  color?: string;
  /** Whether the section should start collapsed (from p15:sectionPr). */
  defaultCollapsed?: boolean;
}

// ---------------------------------------------------------------------------
// Toolbar / inspector
// ---------------------------------------------------------------------------

/** Alignment direction for distributing/aligning multiple selected elements on the slide. */
export type SlideAlignment =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom";

/** Identifies one of the ribbon-style toolbar tabs (home, insert, text, etc.). */
export type ToolbarSection =
  | "home"
  | "insert"
  | "text"
  | "arrange"
  | "draw"
  | "design"
  | "transitions"
  | "review"
  | "view";

/** The active drawing/inking tool selected in the Draw toolbar tab. */
export type DrawingTool =
  | "select"
  | "pen"
  | "highlighter"
  | "eraser"
  | "freeform";

// ---------------------------------------------------------------------------
// Shortcut / accessibility reference
// ---------------------------------------------------------------------------

/** A single entry in the keyboard shortcuts help panel. */
export interface ShortcutReferenceItem {
  action: string;
  shortcut: string;
}

/** An accessibility audit finding (missing alt text, reading order issues, etc.). */
export interface AccessibilityIssue {
  slideIndex: number;
  elementId?: string;
  severity: "error" | "warning" | "info";
  message: string;
}

// ---------------------------------------------------------------------------
// Options lists (for dropdowns)
// ---------------------------------------------------------------------------

/** Dropdown option for selecting a connector geometry type. */
export interface ConnectorGeometryOption {
  value: ConnectorGeometryType;
  label: string;
}

/** Dropdown option for selecting a connector arrowhead style. */
export interface ConnectorArrowOption {
  value: ConnectorArrowType;
  label: string;
}

/** Dropdown option for selecting a stroke dash pattern. */
export interface StrokeDashOption {
  value: StrokeDashType;
  label: string;
}

/** Dropdown option for selecting a slide transition type. */
export interface SlideTransitionOption {
  value: NonNullable<PptxSlideTransition["type"]>;
  label: string;
}

/** Dropdown option for selecting an animation effect preset. */
export interface AnimationPresetOption {
  value: Exclude<PptxAnimationPreset, "none">;
  label: string;
}

// ---------------------------------------------------------------------------
// Public component props & handle
// ---------------------------------------------------------------------------

export interface PowerPointViewerProps {
  /** PowerPoint content as Uint8Array */
  content: Uint8Array;
  /** Original file path — used for autosave recovery */
  filePath?: string;
  /** Callback when content has unsaved changes */
  onDirtyChange?: (isDirty: boolean) => void;
  onContentChange?: (content: Uint8Array) => void;
  /** Callback when active slide changes */
  onActiveSlideChange?: (slideIndex: number) => void;

  /** Whether editing actions are enabled */
  canEdit?: boolean;
  /** Optional class name */
  className?: string;
}

export interface PowerPointViewerHandle extends FileViewerHandle {
  getContent: () => Promise<Uint8Array>;
}
