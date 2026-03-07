/**
 * CSS approximation of OOXML 3D material presets.
 *
 * Since we can't use Three.js in a DOM-based renderer, we approximate
 * material properties (roughness, metalness, transparency) using CSS
 * filters and box-shadow variations.
 */

import type React from "react";

import type { MaterialPresetType } from "pptx-viewer-core";

export interface MaterialCssOverrides {
  /** Extra CSS filter chain to append (e.g. "brightness(1.1) saturate(1.2)"). */
  filter?: string;
  /** Opacity override (0–1). */
  opacity?: number;
  /** Extra box-shadow to layer for specular highlight simulation. */
  boxShadow?: string;
  /** Blend mode for fill overlay. */
  mixBlendMode?: React.CSSProperties["mixBlendMode"];
}

const MATERIAL_MAP: Record<MaterialPresetType, MaterialCssOverrides> = {
  matte: {
    filter: "brightness(0.95) saturate(0.9)",
  },
  warmMatte: {
    filter: "brightness(1.0) saturate(0.85) sepia(0.08)",
  },
  plastic: {
    filter: "brightness(1.05) contrast(1.05)",
    boxShadow: "inset -2px -2px 6px rgba(255,255,255,0.35)",
  },
  metal: {
    filter: "brightness(1.1) contrast(1.15) saturate(1.2)",
    boxShadow: "inset -3px -3px 8px rgba(255,255,255,0.45)",
  },
  dkEdge: {
    filter: "brightness(0.85) contrast(1.2)",
  },
  softEdge: {
    filter: "brightness(1.05) contrast(0.9)",
  },
  flat: {},
  softmetal: {
    filter: "brightness(1.05) contrast(1.08) saturate(1.1)",
    boxShadow: "inset -2px -2px 6px rgba(255,255,255,0.3)",
  },
  clear: {
    opacity: 0.7,
    filter: "brightness(1.15)",
  },
  powder: {
    filter: "brightness(1.1) contrast(0.85) saturate(0.8)",
  },
  translucentPowder: {
    opacity: 0.75,
    filter: "brightness(1.1) contrast(0.85)",
  },
};

/**
 * Returns CSS overrides that approximate the given OOXML 3D material preset.
 * Returns an empty object for `undefined` or unrecognised values.
 */
export function getMaterialCssOverrides(
  material: MaterialPresetType | undefined,
): MaterialCssOverrides {
  if (!material) {
    return {};
  }
  return MATERIAL_MAP[material] ?? {};
}
