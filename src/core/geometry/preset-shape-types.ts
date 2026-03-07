/**
 * Types for preset shape definitions used in the shape picker UI.
 */

export interface PresetShapeDefinition {
  /** Canonical OOXML name (lowercase). */
  name: string;
  /** Human-readable label. */
  label: string;
  /** CSS clip-path value, or undefined when only SVG path rendering works. */
  clipPath?: string;
  /** Category for the shape picker. */
  category: PresetShapeCategory;
}

export type PresetShapeCategory =
  | "basic"
  | "rectangles"
  | "arrows"
  | "stars"
  | "callouts"
  | "flowchart"
  | "math"
  | "action"
  | "other";
