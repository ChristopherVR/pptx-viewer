/**
 * Categorised shape definitions for the UI shape picker.
 * Barrel module — re-exports from split definition files.
 */
import type {
  PresetShapeCategory,
  PresetShapeDefinition,
} from "./preset-shape-types";
import { PRIMARY_SHAPE_DEFINITIONS } from "./shape-definitions-primary";
import { EXTENDED_SHAPE_DEFINITIONS } from "./shape-definitions-extended";

export { PRIMARY_SHAPE_DEFINITIONS } from "./shape-definitions-primary";
export { EXTENDED_SHAPE_DEFINITIONS } from "./shape-definitions-extended";

export const PRESET_SHAPE_DEFINITIONS: PresetShapeDefinition[] = [
  ...PRIMARY_SHAPE_DEFINITIONS,
  ...EXTENDED_SHAPE_DEFINITIONS,
];

// ---------------------------------------------------------------------------
// Category labels for the UI picker
// ---------------------------------------------------------------------------

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
