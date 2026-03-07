/**
 * OOXML DrawingML guide formula evaluator — core types and evaluation.
 *
 * Implements the formula system defined in ISO/IEC 29500-1 §20.1.9.11 (fmla)
 * for `a:gd` guide definitions used in preset and custom geometries.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single guide definition parsed from `a:gd`. */
export interface GeometryGuide {
  /** Guide variable name (e.g. "adj", "g0", "x1"). */
  name: string;
  // Raw formula string (e.g. "*/  w adj 100000").
  formula: string;
}

/** Shape dimensions used as built-in variables for formula evaluation. */
export interface GeometryContext {
  /** Shape width in EMU. */
  w: number;
  /** Shape height in EMU. */
  h: number;
}

/** Parsed formula token: operator + operands. */
interface ParsedFormula {
  op: string;
  args: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** OOXML angle unit = 60 000ths of a degree. */
export const ANGLE_SCALE = 60000;

/** Convert an OOXML angle value (60 000ths of a degree) to radians. */
export function angleToRadians(ooxmlAngle: number): number {
  return (ooxmlAngle / ANGLE_SCALE) * (Math.PI / 180);
}

// ---------------------------------------------------------------------------
// Formula parser
// ---------------------------------------------------------------------------

/** Parse a raw formula string into operator + arguments. */
export function parseFormula(fmla: string): ParsedFormula {
  const parts = fmla.trim().split(/\s+/);
  const op = parts[0] ?? "";
  const args = parts.slice(1);
  return { op, args };
}

// ---------------------------------------------------------------------------
// Resolve a single operand (may be a number literal or a variable name)
// ---------------------------------------------------------------------------

export function resolveOperand(
  token: string,
  variables: Map<string, number>,
): number {
  // Numeric literal
  const num = Number(token);
  if (Number.isFinite(num)) return num;

  // Variable lookup (case-sensitive per spec)
  const value = variables.get(token);
  if (value !== undefined) return value;

  // Unknown variable — treat as 0 (defensive)
  return 0;
}

// ---------------------------------------------------------------------------
// Evaluate a single formula
// ---------------------------------------------------------------------------

export function evaluateFormula(
  parsed: ParsedFormula,
  vars: Map<string, number>,
): number {
  const r = (idx: number): number =>
    resolveOperand(parsed.args[idx] ?? "0", vars);

  switch (parsed.op) {
    // val x — literal value
    case "val":
      return r(0);

    // abs x — absolute value
    case "abs":
      return Math.abs(r(0));

    // sqrt x — square root
    case "sqrt":
      return Math.sqrt(Math.max(r(0), 0));

    // +- x y z — x + y - z
    case "+-":
      return r(0) + r(1) - r(2);

    // */ x y z — (x * y) / z
    case "*/": {
      const z = r(2);
      if (z === 0) return 0;
      return (r(0) * r(1)) / z;
    }

    // +/ x y z — (x + y) / z
    case "+/": {
      const z = r(2);
      if (z === 0) return 0;
      return (r(0) + r(1)) / z;
    }

    // ?: x y z — if x > 0 then y else z
    case "?:":
    case "if":
      return r(0) > 0 ? r(1) : r(2);

    // min x y — minimum
    case "min":
      return Math.min(r(0), r(1));

    // max x y — maximum
    case "max":
      return Math.max(r(0), r(1));

    // mod x y z — sqrt(x² + y² + z²)
    case "mod": {
      const a = r(0);
      const b = r(1);
      const c = r(2);
      return Math.sqrt(a * a + b * b + c * c);
    }

    // pin x y z — clamp y between x and z
    case "pin": {
      const lo = r(0);
      const val = r(1);
      const hi = r(2);
      return Math.max(lo, Math.min(val, hi));
    }

    // sin x y — x * sin(y) where y is in OOXML angle units
    case "sin": {
      const sinVal = Math.sin(angleToRadians(r(1)));
      if (!Number.isFinite(sinVal)) return 0;
      return r(0) * sinVal;
    }

    // cos x y — x * cos(y) where y is in OOXML angle units
    case "cos": {
      const cosVal = Math.cos(angleToRadians(r(1)));
      if (!Number.isFinite(cosVal)) return 0;
      return r(0) * cosVal;
    }

    // tan x y — x * tan(y) where y is in OOXML angle units
    case "tan": {
      const angle = angleToRadians(r(1));
      const tanVal = Math.tan(angle);
      if (!Number.isFinite(tanVal)) return 0;
      return r(0) * tanVal;
    }

    // atan x — atan(x) result in OOXML angle units
    // x is a ratio scaled by the shape coordinate space
    case "atan": {
      const radians = Math.atan(r(0));
      return (radians * 180 * ANGLE_SCALE) / Math.PI;
    }

    // at2 y x — atan2(y, x) result in OOXML angle units (OOXML spec name)
    case "at2":
    case "atan2": {
      const radians = Math.atan2(r(0), r(1));
      return (radians * 180 * ANGLE_SCALE) / Math.PI;
    }

    // cat2 x y z — x * cos(atan2(z, y))
    case "cat2": {
      const angle = Math.atan2(r(2), r(1));
      return r(0) * Math.cos(angle);
    }

    // sat2 x y z — x * sin(atan2(z, y))
    case "sat2": {
      const angle = Math.atan2(r(2), r(1));
      return r(0) * Math.sin(angle);
    }

    default:
      // Unknown formula — try to interpret as a numeric literal
      return Number(parsed.op) || 0;
  }
}
