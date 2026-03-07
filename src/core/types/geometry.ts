/**
 * Geometry types: adjustment handles, custom geometry points, segments,
 * paths, and custom path properties.
 *
 * @module pptx-types/geometry
 */

// ==========================================================================
// Geometry types: adjustment handles and custom geometry paths
// ==========================================================================

/**
 * Defines an adjustment handle position for a shape geometry.
 *
 * Adjustment handles allow users to interactively reshape preset shapes
 * (e.g. rounding a rectangle corner or adjusting arrow head width).
 *
 * @example
 * ```ts
 * const handle: GeometryAdjustmentHandle = {
 *   guideName: "adj",
 *   xFraction: 0.25,
 *   minValue: 0,
 *   maxValue: 50000,
 * };
 * // => satisfies GeometryAdjustmentHandle
 * ```
 */
export interface GeometryAdjustmentHandle {
  /** Name of the adjustment guide this handle controls (e.g. "adj", "adj1"). */
  guideName: string;
  /** X position as a fraction of shape width (0..1), or undefined if the handle only moves vertically. */
  xFraction?: number;
  /** Y position as a fraction of shape height (0..1), or undefined if the handle only moves horizontally. */
  yFraction?: number;
  /** Minimum allowed value for the adjustment guide. */
  minValue?: number;
  /** Maximum allowed value for the adjustment guide. */
  maxValue?: number;
}

// ==========================================================================
// Custom geometry (a:custGeom) structured types
// ==========================================================================

/**
 * A single point in a custom geometry path.
 *
 * @example
 * ```ts
 * const pt: CustomGeometryPoint = { x: 100, y: 200 };
 * // => satisfies CustomGeometryPoint
 * ```
 */
export interface CustomGeometryPoint {
  x: number;
  y: number;
}

/**
 * A segment within a custom geometry path.
 *
 * Discriminated union over `type` — can be a moveTo, lineTo,
 * cubic Bézier, quadratic Bézier, or close command.
 *
 * @example
 * ```ts
 * const segments: CustomGeometrySegment[] = [
 *   { type: "moveTo", pt: { x: 0, y: 0 } },
 *   { type: "lineTo", pt: { x: 100, y: 0 } },
 *   { type: "lineTo", pt: { x: 100, y: 100 } },
 *   { type: "close" },
 * ];
 * // => satisfies CustomGeometrySegment[]
 * ```
 */
export type CustomGeometrySegment =
  | { type: "moveTo"; pt: CustomGeometryPoint }
  | { type: "lineTo"; pt: CustomGeometryPoint }
  | {
      type: "cubicBezTo";
      pts: [CustomGeometryPoint, CustomGeometryPoint, CustomGeometryPoint];
    }
  | { type: "quadBezTo"; pts: [CustomGeometryPoint, CustomGeometryPoint] }
  | {
      type: "arcTo";
      /** Horizontal radius of the ellipse. */
      wR: number;
      /** Vertical radius of the ellipse. */
      hR: number;
      /** Start angle in 60000ths of a degree. */
      stAng: number;
      /** Sweep angle in 60000ths of a degree. */
      swAng: number;
    }
  | { type: "close" };

/**
 * A single sub-path in a custom geometry definition (maps to one `a:path`).
 *
 * @example
 * ```ts
 * const path: CustomGeometryPath = {
 *   width: 100,
 *   height: 100,
 *   segments: [
 *     { type: "moveTo", pt: { x: 0, y: 0 } },
 *     { type: "lineTo", pt: { x: 100, y: 100 } },
 *   ],
 * };
 * // => satisfies CustomGeometryPath
 * ```
 */
export interface CustomGeometryPath {
  /** Coordinate-space width for this sub-path. */
  width: number;
  /** Coordinate-space height for this sub-path. */
  height: number;
  /** Ordered list of drawing segments. */
  segments: CustomGeometrySegment[];
}

/**
 * Custom (non-preset) geometry path — only on shapes and pictures.
 *
 * Contains SVG path data and/or structured custom geometry paths
 * parsed from `a:custGeom/a:pathLst`.
 *
 * @example
 * ```ts
 * const custom: PptxCustomPathProperties = {
 *   pathData: "M 0 0 L 100 0 L 100 100 Z",
 *   pathWidth: 100,
 *   pathHeight: 100,
 * };
 * // => satisfies PptxCustomPathProperties
 * ```
 */
export interface PptxCustomPathProperties {
  /** SVG path data for custom shapes. */
  pathData?: string;
  /** Coordinate-space width for the custom path. */
  pathWidth?: number;
  /** Coordinate-space height for the custom path. */
  pathHeight?: number;
  /** Structured custom geometry paths for editing (maps to a:custGeom/a:pathLst). */
  customGeometryPaths?: CustomGeometryPath[];
}
