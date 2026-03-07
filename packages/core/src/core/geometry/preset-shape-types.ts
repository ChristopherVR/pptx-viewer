/**
 * Types for preset shape definitions used in the shape picker UI.
 *
 * These types describe the metadata for each OOXML preset geometry,
 * including its canonical name, display label, optional CSS clip-path,
 * and the category used to organize shapes in the picker UI.
 */

/**
 * Describes a single OOXML preset geometry shape for the shape picker.
 *
 * Each definition maps a canonical OOXML name to a human-readable label
 * and a category. An optional `clipPath` provides a CSS `clip-path` value
 * for simple rendering without full SVG path calculation.
 */
export interface PresetShapeDefinition {
  /** Canonical OOXML preset geometry name (e.g. `"rect"`, `"roundRect"`, `"star5"`). */
  name: string;
  /** Human-readable label shown in the shape picker UI (e.g. `"Rounded Rectangle"`). */
  label: string;
  /** CSS `clip-path` value for quick rendering, or `undefined` when full SVG rendering is required. */
  clipPath?: string;
  /** Category grouping for the shape picker UI. */
  category: PresetShapeCategory;
}

/**
 * Shape categories for organizing preset shapes in the picker UI.
 *
 * Maps to the groupings displayed in the shape selection panel:
 * basic shapes, rectangle variants, arrows, stars/banners, callouts,
 * flowchart symbols, math operators, action buttons, and other.
 */
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
