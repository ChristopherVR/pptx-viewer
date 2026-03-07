/**
 * Merged OOXML preset geometry to CSS clip-path map and lookup function.
 *
 * This module aggregates the core and extended partial clip-path maps
 * into a single master lookup record. The maps are split across two
 * files (`preset-clip-paths-core` and `preset-clip-paths-extended`)
 * to keep individual file sizes manageable.
 */
import { CLIP_PATHS_CORE } from "./preset-clip-paths-core";
import { CLIP_PATHS_EXTENDED } from "./preset-clip-paths-extended";

/**
 * Master lookup: lowercase OOXML preset name → CSS `clip-path` value.
 * Returns `undefined` for shapes that need SVG rendering.
 */
export const PRESET_SHAPE_CLIP_PATHS: Record<string, string | undefined> = {
  ...CLIP_PATHS_CORE,
  ...CLIP_PATHS_EXTENDED,
};

/**
 * Lookup a clip-path for any OOXML preset geometry name.
 * Returns `undefined` when the shape should be rendered as a
 * full rectangle (no clipping) or when a more complex SVG
 * rendering is needed.
 */
export function getPresetShapeClipPath(
  presetName: string | undefined,
): string | undefined {
  if (!presetName) return undefined;
  return PRESET_SHAPE_CLIP_PATHS[presetName.toLowerCase()];
}
