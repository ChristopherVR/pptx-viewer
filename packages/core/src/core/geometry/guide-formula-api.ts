/**
 * OOXML DrawingML guide formula evaluator — public API.
 *
 * Built-in variable seeding, guide evaluation, adjustment parsing,
 * and coordinate resolution.
 */

import type { GeometryGuide, GeometryContext } from "./guide-formula-eval";
import {
  ANGLE_SCALE,
  parseFormula,
  evaluateFormula,
  resolveOperand,
} from "./guide-formula-eval";

// ---------------------------------------------------------------------------
// Built-in variables
// ---------------------------------------------------------------------------

/**
 * Seed the built-in variables for a shape of the given dimensions.
 *
 * Built-in variables are defined by the OOXML spec (ISO/IEC 29500-1 section 20.1.9):
 * - **Position/size:** `w`, `h`, `l`, `t`, `r`, `b`, `hc` (horizontal center), `vc` (vertical center)
 * - **Width fractions:** `wd2` through `wd12` (width divided by N)
 * - **Height fractions:** `hd2` through `hd12` (height divided by N)
 * - **Short/long side:** `ss`, `ls`, `ssd2` through `ssd32`
 * - **Angular constants:** `cd2` (180 degrees), `cd4` (90 degrees), `cd8` (45 degrees), etc.
 *
 * All angular values are in OOXML angle units (60,000ths of a degree).
 *
 * @param ctx - Shape dimensions (width and height).
 * @returns A Map of built-in variable names to their computed values.
 */
export function createBuiltinVariables(
  ctx: GeometryContext,
): Map<string, number> {
  const { w, h } = ctx;
  const vars = new Map<string, number>();

  // Position & size
  vars.set("w", w);
  vars.set("h", h);
  vars.set("l", 0);
  vars.set("t", 0);
  vars.set("r", w);
  vars.set("b", h);
  vars.set("hc", w / 2);
  vars.set("vc", h / 2);

  // Width divided by N
  const widthDivisors = [2, 3, 4, 5, 6, 8, 10, 12] as const;
  for (const d of widthDivisors) {
    vars.set(`wd${d}`, w / d);
  }

  // Height divided by N
  const heightDivisors = [2, 3, 4, 5, 6, 8, 10, 12] as const;
  for (const d of heightDivisors) {
    vars.set(`hd${d}`, h / d);
  }

  // Short side / long side
  const ss = Math.min(w, h);
  const ls = Math.max(w, h);
  vars.set("ss", ss);
  vars.set("ls", ls);

  // Short side divided by N
  const ssDivisors = [2, 4, 6, 8, 16, 32] as const;
  for (const d of ssDivisors) {
    vars.set(`ssd${d}`, ss / d);
  }

  // Angular constants in OOXML units (60,000ths of a degree):
  // cd2 = 180 degrees (half circle), cd4 = 90 degrees (quarter circle), etc.
  // Fractional constants: 3cd4 = 270 degrees, 3cd8 = 135 degrees, etc.
  vars.set("cd2", 180 * ANGLE_SCALE); // 10,800,000 = 180 degrees
  vars.set("cd4", 90 * ANGLE_SCALE); //  5,400,000 =  90 degrees
  vars.set("cd8", 45 * ANGLE_SCALE); //  2,700,000 =  45 degrees
  vars.set("3cd4", 270 * ANGLE_SCALE); // 16,200,000 = 270 degrees
  vars.set("3cd8", 135 * ANGLE_SCALE); //  8,100,000 = 135 degrees
  vars.set("5cd8", 225 * ANGLE_SCALE); // 13,500,000 = 225 degrees
  vars.set("7cd8", 315 * ANGLE_SCALE); // 18,900,000 = 315 degrees

  return vars;
}

// ---------------------------------------------------------------------------
// Evaluate guides
// ---------------------------------------------------------------------------

/**
 * Evaluate a list of geometry guides in order, resolving each guide's
 * formula against the accumulated variable context.
 *
 * @param guides - Ordered list of guide definitions from `a:gdLst` or `a:avLst`.
 * @param ctx - Shape dimensions for built-in variables.
 * @param adjustments - Optional adjustment values (from `a:avLst`), pre-seeded.
 * @returns A Map of all resolved variable names → numeric values.
 */
export function evaluateGuides(
  guides: GeometryGuide[],
  ctx: GeometryContext,
  adjustments?: Map<string, number>,
): Map<string, number> {
  const vars = createBuiltinVariables(ctx);

  // Seed adjustment values first (they may be referenced by guide formulas)
  if (adjustments) {
    for (const [name, value] of adjustments) {
      vars.set(name, value);
    }
  }

  // Evaluate guides in order (each may reference previously-defined guides)
  for (const guide of guides) {
    const parsed = parseFormula(guide.formula);
    const value = evaluateFormula(parsed, vars);
    vars.set(guide.name, Number.isFinite(value) ? value : 0);
  }

  return vars;
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse `a:gd` XML elements into GeometryGuide array.
 *
 * @param gdNodes - Array of guide definition XML objects with `@_name` and `@_fmla` attributes.
 * @returns Ordered list of parsed guide definitions.
 */
export function parseGuideDefinitions(
  gdNodes: ReadonlyArray<Record<string, unknown>>,
): GeometryGuide[] {
  const guides: GeometryGuide[] = [];
  for (const gd of gdNodes) {
    const name = String(gd?.["@_name"] ?? "").trim();
    const fmla = String(gd?.["@_fmla"] ?? "").trim();
    if (name && fmla) {
      guides.push({ name, formula: fmla });
    }
  }
  return guides;
}

/**
 * Parse adjustment values from `a:avLst/a:gd` into a Map.
 *
 * Each adjustment guide has a formula typically of the form `val <number>`.
 * This extracts the adjustment name and its numeric value.
 */
export function parseAdjustmentValues(
  gdNodes: ReadonlyArray<Record<string, unknown>>,
): Map<string, number> {
  const adjustments = new Map<string, number>();
  for (const gd of gdNodes) {
    const name = String(gd?.["@_name"] ?? "").trim();
    if (!name) continue;

    // Try @_val attribute first
    const valAttr = gd?.["@_val"];
    if (valAttr !== undefined) {
      const parsed = Number.parseInt(String(valAttr), 10);
      if (Number.isFinite(parsed)) {
        adjustments.set(name, parsed);
        continue;
      }
    }

    // Fall back to formula parsing
    const fmla = String(gd?.["@_fmla"] ?? "").trim();
    if (fmla) {
      const valMatch = fmla.match(/^val\s+(-?\d+)$/i);
      if (valMatch) {
        const parsed = Number.parseInt(valMatch[1], 10);
        if (Number.isFinite(parsed)) {
          adjustments.set(name, parsed);
        }
      }
    }
  }
  return adjustments;
}

// ---------------------------------------------------------------------------
// Coordinate resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a coordinate value that may be a guide name or a numeric literal.
 *
 * In OOXML geometry paths, coordinates like `x` and `y` in `a:pt` can be
 * either numeric literals or references to guide variable names.
 */
export function resolveCoordinate(
  value: string | number | undefined,
  variables: Map<string, number>,
): number {
  if (value === undefined) return 0;
  if (typeof value === "number") return value;

  const trimmed = String(value).trim();
  // Try numeric parse first
  const num = Number(trimmed);
  if (Number.isFinite(num)) return num;

  // Variable lookup
  return resolveOperand(trimmed, variables);
}
