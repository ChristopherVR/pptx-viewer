/**
 * Shared constants for the PPTX editor engine.
 * Framework-agnostic -- safe to use from any UI layer (React, Vue, Angular, etc.).
 */
import type { ConnectorArrowType, StrokeDashType } from "./types";

// Re-export colour maps from dedicated module
export { PRESET_COLOR_MAP, SYSTEM_COLOR_MAP } from "./constants-colors";

// ---------------------------------------------------------------------------
// Unit conversions
// ---------------------------------------------------------------------------

/** EMU (English Metric Units) per pixel -- approximate at 96 DPI. */
export const EMU_PER_PX = 9525;

// ---------------------------------------------------------------------------
// Default styling
// ---------------------------------------------------------------------------

export const DEFAULT_CANVAS_WIDTH = 1280;
export const DEFAULT_CANVAS_HEIGHT = 720;
export const MIN_ELEMENT_SIZE = 12;
export const DEFAULT_TEXT_COLOR = "#111827";
export const DEFAULT_FILL_COLOR = "#3b82f6";
export const DEFAULT_STROKE_COLOR = "#1f2937";
export const DEFAULT_FONT_FAMILY =
  '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
export const DEFAULT_TEXT_FONT_SIZE = 24;

export const POWERPOINT_PRESENCE_KEY = "pptx-presence-v1";

// ---------------------------------------------------------------------------
// Default theme scheme colour map
// ---------------------------------------------------------------------------

export const DEFAULT_SCHEME_COLOR_MAP: Record<string, string> = {
  dk1: "#000000",
  lt1: "#FFFFFF",
  dk2: "#1F497D",
  lt2: "#EEECE1",
  accent1: "#4472C4",
  accent2: "#ED7D31",
  accent3: "#A5A5A5",
  accent4: "#FFC000",
  accent5: "#5B9BD5",
  accent6: "#70AD47",
  hlink: "#0563C1",
  folHlink: "#954F72",
  tx1: "#000000",
  tx2: "#44546A",
  bg1: "#FFFFFF",
  bg2: "#E7E6E6",
  phclr: "#4472C4",
};

// ---------------------------------------------------------------------------
// Shape type constants
// ---------------------------------------------------------------------------

export type SupportedShapeType =
  | "rect"
  | "roundRect"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "cylinder"
  | "line"
  | "rtArrow"
  | "leftArrow"
  | "upArrow"
  | "downArrow"
  | "connector";

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
// Option lists (framework-agnostic data -- icons are added by the UI layer)
// ---------------------------------------------------------------------------

export const CONNECTOR_GEOMETRY_OPTIONS: Array<{
  value: ConnectorGeometryType;
  label: string;
}> = [
  { value: "straightConnector1", label: "Straight" },
  { value: "bentConnector2", label: "Bent" },
  { value: "bentConnector3", label: "Double Bent" },
  { value: "bentConnector4", label: "Triple Bent" },
  { value: "bentConnector5", label: "Quad Bent" },
  { value: "curvedConnector2", label: "Curved" },
  { value: "curvedConnector3", label: "Curved (Cubic)" },
  { value: "curvedConnector4", label: "Curved 4" },
  { value: "curvedConnector5", label: "Curved 5" },
];

export const CONNECTOR_ARROW_OPTIONS: Array<{
  value: ConnectorArrowType;
  label: string;
}> = [
  { value: "none", label: "None" },
  { value: "triangle", label: "Triangle" },
  { value: "stealth", label: "Stealth" },
  { value: "diamond", label: "Diamond" },
  { value: "oval", label: "Oval" },
  { value: "arrow", label: "Open Arrow" },
];

export const STROKE_DASH_OPTIONS: Array<{
  value: StrokeDashType;
  label: string;
}> = [
  { value: "solid", label: "Solid" },
  { value: "dot", label: "Dot" },
  { value: "dash", label: "Dash" },
  { value: "dashDot", label: "Dash Dot" },
  { value: "lgDash", label: "Long Dash" },
  { value: "lgDashDot", label: "Long Dash Dot" },
  { value: "lgDashDotDot", label: "Long Dash Dot Dot" },
  { value: "sysDot", label: "System Dot" },
  { value: "sysDash", label: "System Dash" },
  { value: "sysDashDot", label: "System Dash Dot" },
  { value: "sysDashDotDot", label: "System Dash Dot Dot" },
  { value: "custom", label: "Custom" },
];
