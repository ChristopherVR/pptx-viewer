/**
 * OOXML DrawingML geometry path evaluation.
 *
 * Evaluates custom geometry definitions (a:custGeom) with formula-resolved
 * coordinates, producing SVG path data strings.
 */

import { angleToRadians } from "./guide-formula-eval";
import { resolveCoordinate } from "./guide-formula-api";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate a complete custom geometry definition (a:custGeom) with
 * formula-resolved coordinates, producing an SVG path data string.
 *
 * This handles the case where path coordinates reference guide names
 * instead of being plain numbers.
 *
 * @param pathNodes - Array of `a:path` XML objects from `a:pathLst`.
 * @param variables - Fully resolved variable context from evaluateGuides.
 * @param ensureArray - Helper to normalize XML nodes to arrays.
 * @returns SVG path data string and coordinate-space dimensions.
 */
export function evaluateGeometryPaths(
  pathNodes: ReadonlyArray<Record<string, unknown>>,
  variables: Map<string, number>,
  ensureArray: (val: unknown) => unknown[],
): { pathData: string; pathWidth: number; pathHeight: number } | null {
  let fullPathData = "";
  // Coordinate-space dimensions (from @_w / @_h on the first path that specifies them)
  let pathWidth = 0;
  let pathHeight = 0;

  for (const path of pathNodes) {
    // Each path element may declare its own coordinate-space dimensions
    const w = Number.parseInt(String(path["@_w"] ?? "0"), 10);
    const h = Number.parseInt(String(path["@_h"] ?? "0"), 10);

    // Use the first non-zero dimensions as the overall coordinate space
    if (pathWidth === 0 && w > 0) pathWidth = w;
    if (pathHeight === 0 && h > 0) pathHeight = h;

    const commands: string[] = [];
    // Track current pen position for arcTo conversion (arcTo needs the
    // current position to derive the implicit ellipse center)
    let penX = 0;
    let penY = 0;
    // Track the most recent moveTo position for close commands
    let moveX = 0;
    let moveY = 0;

    const keys = Object.keys(path);
    for (const key of keys) {
      if (key.startsWith("@_")) continue;

      const val = path[key];
      const items = Array.isArray(val) ? val : [val];

      for (const item of items) {
        if (!item || typeof item !== "object") {
          if (key === "a:close") {
            commands.push("Z");
            penX = moveX;
            penY = moveY;
          }
          continue;
        }

        const record = item as Record<string, unknown>;

        if (key === "a:moveTo") {
          const pt = record["a:pt"] as Record<string, unknown> | undefined;
          if (pt) {
            const x = resolveCoordinate(
              pt["@_x"] as string | number | undefined,
              variables,
            );
            const y = resolveCoordinate(
              pt["@_y"] as string | number | undefined,
              variables,
            );
            commands.push(`M ${x} ${y}`);
            penX = x;
            penY = y;
            moveX = x;
            moveY = y;
          }
        } else if (key === "a:lnTo") {
          const pt = record["a:pt"] as Record<string, unknown> | undefined;
          if (pt) {
            const x = resolveCoordinate(
              pt["@_x"] as string | number | undefined,
              variables,
            );
            const y = resolveCoordinate(
              pt["@_y"] as string | number | undefined,
              variables,
            );
            commands.push(`L ${x} ${y}`);
            penX = x;
            penY = y;
          }
        } else if (key === "a:cubicBezTo") {
          const pts = ensureArray(record["a:pt"]) as Array<
            Record<string, unknown>
          >;
          if (pts.length === 3) {
            const coords = pts.map((pt) => ({
              x: resolveCoordinate(
                pt["@_x"] as string | number | undefined,
                variables,
              ),
              y: resolveCoordinate(
                pt["@_y"] as string | number | undefined,
                variables,
              ),
            }));
            commands.push(
              `C ${coords[0].x} ${coords[0].y} ${coords[1].x} ${coords[1].y} ${coords[2].x} ${coords[2].y}`,
            );
            penX = coords[2].x;
            penY = coords[2].y;
          }
        } else if (key === "a:quadBezTo") {
          const pts = ensureArray(record["a:pt"]) as Array<
            Record<string, unknown>
          >;
          if (pts.length === 2) {
            const coords = pts.map((pt) => ({
              x: resolveCoordinate(
                pt["@_x"] as string | number | undefined,
                variables,
              ),
              y: resolveCoordinate(
                pt["@_y"] as string | number | undefined,
                variables,
              ),
            }));
            commands.push(
              `Q ${coords[0].x} ${coords[0].y} ${coords[1].x} ${coords[1].y}`,
            );
            penX = coords[1].x;
            penY = coords[1].y;
          }
        } else if (key === "a:arcTo") {
          const wR = resolveCoordinate(
            record["@_wR"] as string | number | undefined,
            variables,
          );
          const hR = resolveCoordinate(
            record["@_hR"] as string | number | undefined,
            variables,
          );
          const stAng = resolveCoordinate(
            record["@_stAng"] as string | number | undefined,
            variables,
          );
          const swAng = resolveCoordinate(
            record["@_swAng"] as string | number | undefined,
            variables,
          );

          const result = ooxmlArcToSvg(wR, hR, stAng, swAng, penX, penY);
          if (result) {
            commands.push(result.svg);
            penX = result.endX;
            penY = result.endY;
          }
        } else if (key === "a:close") {
          commands.push("Z");
          penX = moveX;
          penY = moveY;
        }
      }
    }

    if (commands.length > 0) {
      fullPathData += commands.join(" ") + " ";
    }
  }

  const trimmed = fullPathData.trim();
  if (trimmed === "") return null;

  return {
    pathData: trimmed,
    pathWidth: pathWidth || (variables.get("w") ?? 0),
    pathHeight: pathHeight || (variables.get("h") ?? 0),
  };
}

// ---------------------------------------------------------------------------
// OOXML arcTo → SVG arc conversion (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Result of converting an OOXML `a:arcTo` command to SVG arc notation.
 */
interface ArcToResult {
  /** SVG arc path segment string (e.g. `"A 50 30 0 1 1 100 75"`). */
  svg: string;
  /** X coordinate of the arc endpoint. */
  endX: number;
  /** Y coordinate of the arc endpoint. */
  endY: number;
}

/**
 * Convert an OOXML `a:arcTo` command to an SVG arc path segment.
 *
 * OOXML arcTo: the current pen position lies on an implicit ellipse at
 * angle `stAng`. The arc sweeps `swAng` degrees (in 60000ths). The
 * implicit ellipse center is derived from the current position and stAng.
 *
 * @param wR - Horizontal radius of the ellipse.
 * @param hR - Vertical radius of the ellipse.
 * @param stAng - Start angle in 60000ths of a degree.
 * @param swAng - Sweep angle in 60000ths of a degree.
 * @param penX - Current pen X position.
 * @param penY - Current pen Y position.
 */
export function ooxmlArcToSvg(
  wR: number,
  hR: number,
  stAng: number,
  swAng: number,
  penX: number,
  penY: number,
): ArcToResult | null {
  // Degenerate arcs: zero radius or zero sweep produce no visible arc
  if (wR <= 0 || hR <= 0 || swAng === 0) return null;

  // Convert OOXML angles (60,000ths of a degree) to radians
  const startRad = angleToRadians(stAng);
  const sweepRad = angleToRadians(swAng);
  const endRad = startRad + sweepRad;

  // Derive the implicit ellipse center from the current pen position.
  // The pen sits on the ellipse at the start angle, so:
  //   penX = cx + wR * cos(startRad)  =>  cx = penX - wR * cos(startRad)
  //   penY = cy + hR * sin(startRad)  =>  cy = penY - hR * sin(startRad)
  const cx = penX - wR * Math.cos(startRad);
  const cy = penY - hR * Math.sin(startRad);

  // Compute the absolute endpoint on the ellipse at the end angle
  const endX = cx + wR * Math.cos(endRad);
  const endY = cy + hR * Math.sin(endRad);

  // SVG arc flags:
  // - large-arc-flag: 1 if the arc spans more than 180 degrees
  // - sweep-flag: 1 if the arc is drawn in the positive-angle direction
  const largeArc = Math.abs(sweepRad) > Math.PI ? 1 : 0;
  const sweep = sweepRad > 0 ? 1 : 0;

  // Round to 3 decimal places for clean SVG output
  const rx = Math.round(wR * 1000) / 1000;
  const ry = Math.round(hR * 1000) / 1000;
  const ex = Math.round(endX * 1000) / 1000;
  const ey = Math.round(endY * 1000) / 1000;

  return {
    svg: `A ${rx} ${ry} 0 ${largeArc} ${sweep} ${ex} ${ey}`,
    endX,
    endY,
  };
}
