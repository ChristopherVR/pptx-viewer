/**
 * Comprehensive OOXML preset geometry -- CSS clip-path mapping.
 *
 * This barrel module re-exports all types, clip-path lookups, and shape
 * definitions from their dedicated sub-modules, providing a single
 * import point for consumers that need preset shape data.
 *
 * @module preset-shape-paths
 */
export {
  type PresetShapeDefinition,
  type PresetShapeCategory,
} from "./preset-shape-types";
export {
  PRESET_SHAPE_CLIP_PATHS,
  getPresetShapeClipPath,
} from "./preset-shape-clip-paths";
export {
  PRESET_SHAPE_DEFINITIONS,
  PRESET_SHAPE_CATEGORY_LABELS,
} from "./preset-shape-definitions";
