/**
 * Categorised shape definitions for the UI shape picker.
 *
 * This barrel module merges the primary and extended definition arrays
 * into a single `PRESET_SHAPE_DEFINITIONS` list and provides the
 * human-readable `PRESET_SHAPE_CATEGORY_LABELS` mapping.
 *
 * The definitions are split across two files for maintainability:
 * - **shape-definitions-primary** — Basic shapes, rectangles, stars, math, and other
 * - **shape-definitions-extended** — Arrows, callouts, flowchart, and action buttons
 */
import type {
  PresetShapeCategory,
  PresetShapeDefinition,
} from "./preset-shape-types";
import { PRIMARY_SHAPE_DEFINITIONS } from "./shape-definitions-primary";
import { EXTENDED_SHAPE_DEFINITIONS } from "./shape-definitions-extended";

export { PRIMARY_SHAPE_DEFINITIONS } from "./shape-definitions-primary";
export { EXTENDED_SHAPE_DEFINITIONS } from "./shape-definitions-extended";

/**
 * Complete list of all preset shape definitions, combining primary and extended sets.
 *
 * This merged array contains every shape available in the shape picker UI,
 * ordered by category (basic, rectangles, stars, math, other, arrows,
 * callouts, flowchart, action buttons).
 */
export const PRESET_SHAPE_DEFINITIONS: PresetShapeDefinition[] = [
  ...PRIMARY_SHAPE_DEFINITIONS,
  ...EXTENDED_SHAPE_DEFINITIONS,
];

// ---------------------------------------------------------------------------
// Category labels for the UI picker
// ---------------------------------------------------------------------------

/**
 * Human-readable labels for each shape category, used as section headers
 * in the shape picker UI.
 */
export const PRESET_SHAPE_CATEGORY_LABELS: Record<PresetShapeCategory, string> =
  {
    basic: "Basic Shapes",
    rectangles: "Rectangles",
    arrows: "Arrows",
    stars: "Stars & Banners",
    callouts: "Callouts",
    flowchart: "Flowchart",
    math: "Math",
    action: "Action Buttons",
    other: "Other Shapes",
  };
