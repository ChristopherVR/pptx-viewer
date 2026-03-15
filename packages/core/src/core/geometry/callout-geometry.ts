/**
 * Callout shape leader line geometry computation.
 *
 * Computes the line segments that form the "leader line" (callout line)
 * connecting a callout shape body to a callout point. OOXML defines
 * 12 callout shape variants across three line-complexity tiers and
 * four style variants:
 *
 *   - **callout1 / bordercallout1 / accentcallout1 / accentbordercallout1**
 *     Single straight line from shape edge to callout point (2 adjustment pairs).
 *   - **callout2 / bordercallout2 / accentcallout2 / accentbordercallout2**
 *     Two-segment line with one bend (3 adjustment pairs).
 *   - **callout3 / bordercallout3 / accentcallout3 / accentbordercallout3**
 *     Three-segment line with two bends (4 adjustment pairs).
 *
 * Style variants affect visual rendering but not the line geometry:
 *   - **callout** (no border): no shape border, has accent bar
 *   - **bordercallout**: shape border, no accent bar
 *   - **accentcallout**: accent bar at the top, no shape border
 *   - **accentbordercallout**: accent bar at the top + shape border
 *
 * Adjustment values are stored in OOXML as 1/100000ths of width (x) or
 * height (y). They can be negative (callout point outside the shape).
 *
 * @module geometry/callout-geometry
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** A 2D point in pixel coordinates relative to the shape's top-left origin. */
export interface CalloutPoint {
  x: number;
  y: number;
}

/** The result of computing callout leader line geometry. */
export interface CalloutLeaderLineGeometry {
  /**
   * Ordered list of points forming the callout leader line.
   * For callout1: 2 points (start, end).
   * For callout2: 3 points (start, bend, end).
   * For callout3: 4 points (start, bend1, bend2, end).
   */
  points: CalloutPoint[];
  /** Whether the shape variant has a visible border (bordercallout, accentbordercallout). */
  hasBorder: boolean;
  /** Whether the shape variant has an accent bar (accentcallout, accentbordercallout). */
  hasAccent: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants — OOXML default adjustment values (in 1/100000ths)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default adjustment values for callout1 shapes.
 *
 * adj1 = y of line start on shape edge (as fraction of height)
 * adj2 = x of line start on shape edge (as fraction of width)
 * adj3 = y of callout point (can be > 100000 or < 0)
 * adj4 = x of callout point (can be > 100000 or < 0)
 */
const CALLOUT1_DEFAULTS = {
  adj1: 18750,
  adj2: -8333,
  adj3: 112500,
  adj4: -38333,
};

/**
 * Default adjustment values for callout2 shapes (one bend point).
 * adj1/adj2 = line start, adj3/adj4 = bend point, adj5/adj6 = callout point.
 */
const CALLOUT2_DEFAULTS = {
  adj1: 18750,
  adj2: -8333,
  adj3: 18750,
  adj4: -16667,
  adj5: 112500,
  adj6: -46667,
};

/**
 * Default adjustment values for callout3 shapes (two bend points).
 * adj1/adj2 = line start, adj3/adj4 = bend1, adj5/adj6 = bend2, adj7/adj8 = callout point.
 */
const CALLOUT3_DEFAULTS = {
  adj1: 18750,
  adj2: -8333,
  adj3: 18750,
  adj4: -16667,
  adj5: 100000,
  adj6: -16667,
  adj7: 112963,
  adj8: -8333,
};

// ─────────────────────────────────────────────────────────────────────────────
// Shape name classification
// ─────────────────────────────────────────────────────────────────────────────

/** All callout shape names that have leader lines. */
const CALLOUT_SHAPE_NAMES = new Set([
  "callout1",
  "callout2",
  "callout3",
  "bordercallout1",
  "bordercallout2",
  "bordercallout3",
  "accentcallout1",
  "accentcallout2",
  "accentcallout3",
  "accentbordercallout1",
  "accentbordercallout2",
  "accentbordercallout3",
]);

/**
 * Returns true if the given shape type name is a callout shape with a leader line.
 *
 * @param shapeType - The OOXML preset geometry name (case-insensitive).
 */
export function isCalloutShape(shapeType: string | undefined): boolean {
  if (!shapeType) return false;
  return CALLOUT_SHAPE_NAMES.has(shapeType.toLowerCase());
}

/**
 * Returns the tier (1, 2, or 3) for the callout shape, indicating the number
 * of line segments. Returns 0 if the shape type is not a callout.
 */
export function getCalloutTier(shapeType: string): 0 | 1 | 2 | 3 {
  const lower = shapeType.toLowerCase();
  if (lower.endsWith("1")) return 1;
  if (lower.endsWith("2")) return 2;
  if (lower.endsWith("3")) return 3;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Geometry computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads a callout adjustment value from the shape's adjustment record.
 * Falls back to the appropriate default if the named key is absent.
 *
 * @param adjustments - The shape's adjustment values record.
 * @param key - The adjustment key (e.g. "adj1").
 * @param defaultValue - The default value to use if the key is missing.
 * @returns The adjustment value in OOXML 1/100000ths units.
 */
function getAdj(
  adjustments: Record<string, number> | undefined,
  key: string,
  defaultValue: number,
): number {
  if (adjustments && key in adjustments) {
    const v = adjustments[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return defaultValue;
}

/**
 * Converts an OOXML adjustment coordinate to pixels.
 *
 * @param adjValue - The adjustment value in 1/100000ths units.
 * @param dimension - The reference dimension in pixels (width for x, height for y).
 * @returns The coordinate in pixels.
 */
function adjToPixels(adjValue: number, dimension: number): number {
  return (adjValue / 100000) * dimension;
}

/**
 * Computes the callout leader line geometry for a given callout shape element.
 *
 * @param shapeType - The OOXML preset geometry name.
 * @param width - Shape width in pixels.
 * @param height - Shape height in pixels.
 * @param adjustments - Shape adjustment values record (from `shapeAdjustments`).
 * @returns The computed leader line geometry, or `null` if not a callout shape.
 */
export function getCalloutLeaderLineGeometry(
  shapeType: string,
  width: number,
  height: number,
  adjustments?: Record<string, number>,
): CalloutLeaderLineGeometry | null {
  if (!isCalloutShape(shapeType)) return null;

  const lower = shapeType.toLowerCase();
  const tier = getCalloutTier(lower);
  if (tier === 0) return null;

  const hasBorder =
    lower.startsWith("bordercallout") ||
    lower.startsWith("accentbordercallout");
  const hasAccent =
    lower.startsWith("accentcallout") ||
    lower.startsWith("accentbordercallout");

  const points: CalloutPoint[] = [];

  if (tier === 1) {
    // Callout1: 2 points (start on shape edge, end at callout point)
    const y1 = adjToPixels(
      getAdj(adjustments, "adj1", CALLOUT1_DEFAULTS.adj1),
      height,
    );
    const x1 = adjToPixels(
      getAdj(adjustments, "adj2", CALLOUT1_DEFAULTS.adj2),
      width,
    );
    const y2 = adjToPixels(
      getAdj(adjustments, "adj3", CALLOUT1_DEFAULTS.adj3),
      height,
    );
    const x2 = adjToPixels(
      getAdj(adjustments, "adj4", CALLOUT1_DEFAULTS.adj4),
      width,
    );
    points.push({ x: x1, y: y1 }, { x: x2, y: y2 });
  } else if (tier === 2) {
    // Callout2: 3 points (start, one bend, end)
    const y1 = adjToPixels(
      getAdj(adjustments, "adj1", CALLOUT2_DEFAULTS.adj1),
      height,
    );
    const x1 = adjToPixels(
      getAdj(adjustments, "adj2", CALLOUT2_DEFAULTS.adj2),
      width,
    );
    const y2 = adjToPixels(
      getAdj(adjustments, "adj3", CALLOUT2_DEFAULTS.adj3),
      height,
    );
    const x2 = adjToPixels(
      getAdj(adjustments, "adj4", CALLOUT2_DEFAULTS.adj4),
      width,
    );
    const y3 = adjToPixels(
      getAdj(adjustments, "adj5", CALLOUT2_DEFAULTS.adj5),
      height,
    );
    const x3 = adjToPixels(
      getAdj(adjustments, "adj6", CALLOUT2_DEFAULTS.adj6),
      width,
    );
    points.push({ x: x1, y: y1 }, { x: x2, y: y2 }, { x: x3, y: y3 });
  } else {
    // Callout3: 4 points (start, two bends, end)
    const y1 = adjToPixels(
      getAdj(adjustments, "adj1", CALLOUT3_DEFAULTS.adj1),
      height,
    );
    const x1 = adjToPixels(
      getAdj(adjustments, "adj2", CALLOUT3_DEFAULTS.adj2),
      width,
    );
    const y2 = adjToPixels(
      getAdj(adjustments, "adj3", CALLOUT3_DEFAULTS.adj3),
      height,
    );
    const x2 = adjToPixels(
      getAdj(adjustments, "adj4", CALLOUT3_DEFAULTS.adj4),
      width,
    );
    const y3 = adjToPixels(
      getAdj(adjustments, "adj5", CALLOUT3_DEFAULTS.adj5),
      height,
    );
    const x3 = adjToPixels(
      getAdj(adjustments, "adj6", CALLOUT3_DEFAULTS.adj6),
      width,
    );
    const y4 = adjToPixels(
      getAdj(adjustments, "adj7", CALLOUT3_DEFAULTS.adj7),
      height,
    );
    const x4 = adjToPixels(
      getAdj(adjustments, "adj8", CALLOUT3_DEFAULTS.adj8),
      width,
    );
    points.push(
      { x: x1, y: y1 },
      { x: x2, y: y2 },
      { x: x3, y: y3 },
      { x: x4, y: y4 },
    );
  }

  return { points, hasBorder, hasAccent };
}

/**
 * Builds an SVG path `d` attribute string for the callout leader line.
 *
 * @param geometry - The computed callout leader line geometry.
 * @returns An SVG path data string (e.g. "M 10 20 L 30 40 L 50 60").
 */
export function buildCalloutLeaderLineSvgPath(
  geometry: CalloutLeaderLineGeometry,
): string {
  if (geometry.points.length < 2) return "";
  const [first, ...rest] = geometry.points;
  const parts = [`M ${first.x} ${first.y}`];
  for (const pt of rest) {
    parts.push(`L ${pt.x} ${pt.y}`);
  }
  return parts.join(" ");
}

/**
 * Computes the SVG viewBox bounds for a callout shape including the leader line.
 * The leader line can extend beyond the shape boundary (negative coordinates
 * or coordinates > width/height), so the viewBox must be expanded.
 *
 * @param width - Shape width in pixels.
 * @param height - Shape height in pixels.
 * @param geometry - The callout leader line geometry.
 * @param padding - Extra padding in pixels around the bounds (default 2).
 * @returns The viewBox bounds as `{ minX, minY, viewWidth, viewHeight }`.
 */
export function getCalloutViewBoxBounds(
  width: number,
  height: number,
  geometry: CalloutLeaderLineGeometry,
  padding = 2,
): { minX: number; minY: number; viewWidth: number; viewHeight: number } {
  let minX = 0;
  let minY = 0;
  let maxX = width;
  let maxY = height;

  for (const pt of geometry.points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }

  return {
    minX: minX - padding,
    minY: minY - padding,
    viewWidth: maxX - minX + padding * 2,
    viewHeight: maxY - minY + padding * 2,
  };
}
