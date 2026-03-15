/**
 * CSS approximation of OOXML 3D material presets.
 *
 * Since we can't use Three.js in a DOM-based renderer, we approximate
 * material properties (roughness, metalness, transparency) using CSS
 * filters and box-shadow variations.
 *
 * Each material maps to:
 * - `filter`: brightness, contrast, saturate, sepia adjustments
 * - `boxShadow`: inset specular highlight simulation
 * - `opacity`: transparency for translucent materials
 * - `backgroundImage`: gradient overlay for specular/environment reflections
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
  /** Gradient overlay for specular/environment simulation. */
  backgroundImage?: string;
}

const MATERIAL_MAP: Record<MaterialPresetType, MaterialCssOverrides> = {
  matte: {
    filter: "brightness(0.95) saturate(0.9)",
    // Matte: very subtle top-to-bottom gradient for diffuse light falloff
    backgroundImage:
      "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 40%, rgba(0,0,0,0.03) 100%)",
  },
  warmMatte: {
    filter: "brightness(1.0) saturate(0.85) sepia(0.08)",
    // Warm matte: slight warm-toned gradient falloff
    backgroundImage:
      "linear-gradient(180deg, rgba(255,240,220,0.06) 0%, transparent 50%, rgba(0,0,0,0.03) 100%)",
  },
  plastic: {
    filter: "brightness(1.05) contrast(1.05)",
    // Plastic: bright specular highlight spot on upper-left, subtle rim
    boxShadow:
      "inset -2px -2px 6px rgba(255,255,255,0.35), inset 1px 1px 3px rgba(255,255,255,0.15)",
    backgroundImage:
      "radial-gradient(ellipse 40% 30% at 25% 20%, rgba(255,255,255,0.18) 0%, transparent 70%)",
  },
  metal: {
    filter: "brightness(1.1) contrast(1.15) saturate(1.2)",
    // Metal: strong directional specular band, edge-lit contour
    boxShadow:
      "inset -3px -3px 8px rgba(255,255,255,0.45), inset 2px 2px 4px rgba(255,255,255,0.2), inset 0 0 2px rgba(0,0,0,0.15)",
    backgroundImage:
      "linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 20%, transparent 45%, rgba(0,0,0,0.06) 75%, rgba(255,255,255,0.1) 100%)",
  },
  dkEdge: {
    filter: "brightness(0.85) contrast(1.2)",
    // Dark edge: darkened perimeter with subtle interior light
    boxShadow:
      "inset 0 0 8px rgba(0,0,0,0.2), inset 0 0 2px rgba(0,0,0,0.1)",
    backgroundImage:
      "radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)",
  },
  softEdge: {
    filter: "brightness(1.05) contrast(0.9)",
    // Soft edge: gentle highlight falloff from center
    backgroundImage:
      "radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 60%)",
  },
  flat: {},
  softmetal: {
    filter: "brightness(1.05) contrast(1.08) saturate(1.1)",
    // Soft metal: softer version of metal with broader specular
    boxShadow:
      "inset -2px -2px 6px rgba(255,255,255,0.3), inset 1px 1px 3px rgba(255,255,255,0.12)",
    backgroundImage:
      "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.04) 25%, transparent 50%, rgba(0,0,0,0.04) 85%, rgba(255,255,255,0.06) 100%)",
  },
  clear: {
    opacity: 0.7,
    filter: "brightness(1.15)",
    // Clear: glass-like specular highlight with transparency
    boxShadow:
      "inset -1px -1px 4px rgba(255,255,255,0.3), inset 1px 1px 2px rgba(255,255,255,0.2)",
    backgroundImage:
      "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 40%, rgba(255,255,255,0.08) 100%)",
  },
  powder: {
    filter: "brightness(1.1) contrast(0.85) saturate(0.8)",
    // Powder: very diffuse, almost no specular
    backgroundImage:
      "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 50%)",
  },
  translucentPowder: {
    opacity: 0.75,
    filter: "brightness(1.1) contrast(0.85)",
    // Translucent powder: slight translucent glow
    backgroundImage:
      "radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.1) 0%, transparent 60%)",
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
