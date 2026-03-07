/**
 * UI-related and interaction types for the PowerPoint viewer/editor plugin.
 */
import type React from "react";

import type {
  ConnectorArrowType,
  PptxAnimationPreset,
  PptxElementAnimation,
  PptxSlideTransition,
  StrokeDashType,
  XmlObject,
} from "../core";
/**
 * Base handle interface for file viewer components.
 * Defined locally to avoid dependency on @fuzor/file-viewer-plugins.
 */
export interface FileViewerHandle {
  /** Get the current content of the file (for saving) */
  getContent: () => Promise<string | Uint8Array>;
}
import type { ConnectorGeometryType, SupportedShapeType } from "./types-core";

// ---------------------------------------------------------------------------
// Shape presets (UI-only - icons are ReactNode)
// ---------------------------------------------------------------------------

export interface ShapePreset {
  type: SupportedShapeType;
  label: string;
  icon: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------

export interface ElementContextMenuState {
  x: number;
  y: number;
  elementId: string;
}

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

export interface TableCellEditorState {
  rowIndex: number;
  columnIndex: number;
  /** When true the cell has an active text input. */
  isEditing?: boolean;
  /** Optional multi-cell selection (Shift+Click range). Each entry is {row, col}. */
  selectedCells?: Array<{ row: number; col: number }>;
}

export interface ParsedTableCell {
  rowIndex: number;
  columnIndex: number;
  text: string;
  style: React.CSSProperties;
  rawCell: XmlObject;
}

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

export interface PresentationAnimationRuntime {
  elementId: string;
  state: "hidden" | "entering" | "visible";
  animation: PptxElementAnimation;
}

// ---------------------------------------------------------------------------
// Slide navigation
// ---------------------------------------------------------------------------

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

export type SlideAlignment =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom";

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

export type DrawingTool =
  | "select"
  | "pen"
  | "highlighter"
  | "eraser"
  | "freeform";

// ---------------------------------------------------------------------------
// Shortcut / accessibility reference
// ---------------------------------------------------------------------------

export interface ShortcutReferenceItem {
  action: string;
  shortcut: string;
}

export interface AccessibilityIssue {
  slideIndex: number;
  elementId?: string;
  severity: "error" | "warning" | "info";
  message: string;
}

// ---------------------------------------------------------------------------
// Options lists (for dropdowns)
// ---------------------------------------------------------------------------

export interface ConnectorGeometryOption {
  value: ConnectorGeometryType;
  label: string;
}

export interface ConnectorArrowOption {
  value: ConnectorArrowType;
  label: string;
}

export interface StrokeDashOption {
  value: StrokeDashType;
  label: string;
}

export interface SlideTransitionOption {
  value: NonNullable<PptxSlideTransition["type"]>;
  label: string;
}

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
