/**
 * Shape visual styling types: fill, stroke, effects, and connectors.
 *
 * {@link ShapeStyle} is the main type attached to any element that has
 * visible geometry (shapes, connectors, images). It covers:
 * - **Fill**: solid, gradient, pattern, image, and theme fills
 * - **Stroke**: colour, width, dash pattern, line join/cap
 * - **Effects**: shadow, glow, soft-edge, reflection, blur
 * - **Connectors**: arrow-head types and connection points
 * - **3-D**: scene camera and shape extrusion/bevel
 *
 * All spatial values are stored in **pixels** (pre-converted from EMU).
 * Opacity values are normalised to the 0–1 range.
 *
 * @module pptx-types/shape-style
 */

// ==========================================================================
// Shape styling (fill, stroke, effects, connectors)
// ==========================================================================

import type {
  ConnectorArrowType,
  ConnectorConnectionPoint,
  ShadowEffect,
  StrokeDashType,
  XmlObject,
} from "./common";
import type { Pptx3DScene, Pptx3DShape } from "./three-d";

/**
 * Comprehensive visual style for a shape, connector, or image element.
 *
 * All fields are optional. When absent, the element inherits from theme
 * or layout defaults. The interface models both simple styling (solid fill +
 * basic stroke) and advanced effects (multiple shadow layers, gradient
 * fills, 3-D extrusion).
 *
 * @example
 * ```ts
 * // Simple blue filled shape with a thin black outline:
 * const simple: ShapeStyle = {
 *   fillColor: "#0055AA",
 *   fillMode: "solid",
 *   strokeColor: "#000000",
 *   strokeWidth: 1,
 * };
 *
 * // Gradient fill with a soft shadow:
 * const fancy: ShapeStyle = {
 *   fillMode: "gradient",
 *   fillGradientType: "linear",
 *   fillGradientAngle: 135,
 *   fillGradientStops: [
 *     { color: "#FF6B6B", position: 0 },
 *     { color: "#556270", position: 1 },
 *   ],
 *   shadowColor: "#000000",
 *   shadowBlur: 10,
 *   shadowOffsetX: 4,
 *   shadowOffsetY: 4,
 *   shadowOpacity: 0.3,
 * };
 * // => both satisfy the ShapeStyle interface
 * ```
 */
export interface ShapeStyle {
  fillColor?: string;
  fillGradient?: string;
  fillMode?:
    | "solid"
    | "gradient"
    | "pattern"
    | "none"
    | "image"
    | "theme"
    | "group";
  fillPatternPreset?: string;
  fillPatternBackgroundColor?: string;
  /** Raw XML node for pattern fill foreground colour (preserves color transforms). */
  fillPatternFgClrXml?: XmlObject;
  /** Raw XML node for pattern fill background colour (preserves color transforms). */
  fillPatternBgClrXml?: XmlObject;
  /** Data-URI or URL for image fill (when fillMode === "image"). */
  fillImageUrl?: string;
  /** How the image is sized within the shape: stretch to fill, or tile/repeat. */
  fillImageMode?: "stretch" | "tile";
  fillGradientStops?: Array<{
    color: string;
    position: number;
    opacity?: number;
    /** Raw XML colour node preserved for round-trip (e.g. a:schemeClr with transforms). */
    originalColorXml?: XmlObject;
  }>;
  fillGradientAngle?: number;
  fillGradientType?: "linear" | "radial";
  /** Path gradient sub-type from `a:path/@path` (e.g. "circle", "rect", "shape"). */
  fillGradientPathType?: "circle" | "rect" | "shape";
  /** Focal point for path (radial) gradients, derived from `a:fillToRect`.
   *  Values are 0..1 fractions relative to shape bounds. */
  fillGradientFocalPoint?: { x: number; y: number };
  fillOpacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  strokeDash?: StrokeDashType;
  /** Line join style (`a:ln/@join`): round, bevel, or miter. */
  lineJoin?: "round" | "bevel" | "miter";
  /** Line cap style (`a:ln/@cap`): flat, rnd, or sq. */
  lineCap?: "flat" | "rnd" | "sq";
  /** Compound line type (`a:ln/@cmpd`). */
  compoundLine?: "sng" | "dbl" | "thickThin" | "thinThick" | "tri";
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  /** Preset shadow name from `a:prstShdw/@prst` (e.g. "shdw1"..."shdw20"). */
  presetShadowName?: string;
  /** Shadow angle in degrees (0-360). Parsed from `@_dir` (60000ths of a degree). */
  shadowAngle?: number;
  /** Shadow distance in pixels. Parsed from `@_dist` (EMUs). */
  shadowDistance?: number;
  /** Whether shadow rotates with shape. Parsed from `@_rotWithShape`. */
  shadowRotateWithShape?: boolean;
  /** Multiple shadow layers (for advanced effects). */
  shadows?: ShadowEffect[];
  glowColor?: string;
  glowRadius?: number;
  glowOpacity?: number;
  softEdgeRadius?: number;
  /** Inner shadow colour (`a:innerShdw`). */
  innerShadowColor?: string;
  /** Inner shadow opacity (0-1). */
  innerShadowOpacity?: number;
  /** Inner shadow blur radius in px. */
  innerShadowBlur?: number;
  /** Inner shadow horizontal offset in px. */
  innerShadowOffsetX?: number;
  /** Inner shadow vertical offset in px. */
  innerShadowOffsetY?: number;
  /** Reflection effect — distance from shape bottom in px. */
  reflectionBlurRadius?: number;
  /** Reflection start opacity (0-1). */
  reflectionStartOpacity?: number;
  /** Reflection end opacity (0-1). */
  reflectionEndOpacity?: number;
  /** Reflection end position (0-1 fraction of shape height). */
  reflectionEndPosition?: number;
  /** Reflection direction in degrees. */
  reflectionDirection?: number;
  /** Reflection rotation in degrees (`a:reflection/@rot` in 60000ths). */
  reflectionRotation?: number;
  /** Reflection distance in px. */
  reflectionDistance?: number;
  /** Standalone blur effect radius in px (`a:effectLst > a:blur`). */
  blurRadius?: number;
  /** Whether the blur effect grows the bounds of the shape (`a:blur/@grow`). */
  blurGrow?: boolean;
  connectorStartArrow?: ConnectorArrowType;
  /** Start arrow width size ('sm' | 'med' | 'lg'). */
  connectorStartArrowWidth?: "sm" | "med" | "lg";
  /** Start arrow length size ('sm' | 'med' | 'lg'). */
  connectorStartArrowLength?: "sm" | "med" | "lg";
  connectorEndArrow?: ConnectorArrowType;
  /** End arrow width size ('sm' | 'med' | 'lg'). */
  connectorEndArrowWidth?: "sm" | "med" | "lg";
  /** End arrow length size ('sm' | 'med' | 'lg'). */
  connectorEndArrowLength?: "sm" | "med" | "lg";
  /** Connection point for the start of a connector. */
  connectorStartConnection?: ConnectorConnectionPoint;
  /** Connection point for the end of a connector. */
  connectorEndConnection?: ConnectorConnectionPoint;
  /** Custom dash segments array (`a:custDash/a:ds`). Each entry has dash length and space length in EMU. */
  customDashSegments?: Array<{ dash: number; space: number }>;
  /** 3D scene/camera settings from `a:scene3d`. */
  scene3d?: Pptx3DScene;
  /** 3D shape extrusion/bevel from `a:sp3d`. */
  shape3d?: Pptx3DShape;
  /** Line-level shadow colour from `a:ln/a:effectLst/a:outerShdw`. */
  lineShadowColor?: string;
  /** Line-level shadow opacity (0-1). */
  lineShadowOpacity?: number;
  /** Line-level shadow blur radius in px. */
  lineShadowBlur?: number;
  /** Line-level shadow horizontal offset in px. */
  lineShadowOffsetX?: number;
  /** Line-level shadow vertical offset in px. */
  lineShadowOffsetY?: number;
  /** Line-level glow colour from `a:ln/a:effectLst/a:glow`. */
  lineGlowColor?: string;
  /** Line-level glow radius in px. */
  lineGlowRadius?: number;
  /** Line-level glow opacity (0-1). */
  lineGlowOpacity?: number;

  // ── Effect DAG properties (from `a:effectDag`) ──

  /** Raw `a:effectDag` XML node preserved for round-trip serialisation. */
  effectDagXml?: XmlObject;
  /** Grayscale flag from effectDag `a:grayscl`. */
  dagGrayscale?: boolean;
  /** Bi-level threshold (0-100) from effectDag `a:biLevel`. */
  dagBiLevel?: number;
  /** Brightness adjustment (-100 to 100) from effectDag `a:lum/@bright`. */
  dagLumBrightness?: number;
  /** Contrast adjustment (-100 to 100) from effectDag `a:lum/@contrast`. */
  dagLumContrast?: number;
  /** Hue rotation in degrees (0-360) from effectDag `a:hsl/@hue`. */
  dagHslHue?: number;
  /** Saturation adjustment from effectDag `a:hsl/@sat`. */
  dagHslSaturation?: number;
  /** Luminance adjustment from effectDag `a:hsl/@lum`. */
  dagHslLuminance?: number;
  /** Alpha modulation fixed (0-100) from effectDag `a:alphaModFix`. */
  dagAlphaModFix?: number;
  /** Tint hue in degrees from effectDag `a:tint/@hue`. */
  dagTintHue?: number;
  /** Tint amount (0-100) from effectDag `a:tint/@amt`. */
  dagTintAmount?: number;
  /** Duotone colour pair from effectDag `a:duotone`. */
  dagDuotone?: { color1: string; color2: string };
  /** Fill overlay blend mode from effectDag `a:fillOverlay/@blend`. */
  dagFillOverlayBlend?: "over" | "mult" | "screen" | "darken" | "lighten";
}
