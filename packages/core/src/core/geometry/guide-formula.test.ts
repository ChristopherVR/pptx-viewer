import { describe, it, expect } from "vitest";
import {
  parseFormula,
  resolveOperand,
  ANGLE_SCALE,
  angleToRadians,
} from "./guide-formula-eval";

// ---------------------------------------------------------------------------
// parseFormula
// ---------------------------------------------------------------------------

describe("parseFormula", () => {
  it("parses a simple single-operand formula", () => {
    const result = parseFormula("val 100");
    expect(result.op).toBe("val");
    expect(result.args).toEqual(["100"]);
  });

  it("parses a three-operand formula", () => {
    const result = parseFormula("*/ w adj 100000");
    expect(result.op).toBe("*/");
    expect(result.args).toEqual(["w", "adj", "100000"]);
  });

  it("handles leading and trailing whitespace", () => {
    const result = parseFormula("  +- x y z  ");
    expect(result.op).toBe("+-");
    expect(result.args).toEqual(["x", "y", "z"]);
  });

  it("handles multiple whitespace between tokens", () => {
    const result = parseFormula("sin   x   y");
    expect(result.op).toBe("sin");
    expect(result.args).toEqual(["x", "y"]);
  });

  it("returns empty op for empty string", () => {
    const result = parseFormula("");
    expect(result.op).toBe("");
    expect(result.args).toEqual([]);
  });

  it("parses a formula with negative numbers", () => {
    const result = parseFormula("val -5400000");
    expect(result.op).toBe("val");
    expect(result.args).toEqual(["-5400000"]);
  });

  it("parses an operator with no operands", () => {
    const result = parseFormula("abs");
    expect(result.op).toBe("abs");
    expect(result.args).toEqual([]);
  });

  it("preserves mixed-case variable names", () => {
    const result = parseFormula("+- hc wd2 0");
    expect(result.args).toEqual(["hc", "wd2", "0"]);
  });
});

// ---------------------------------------------------------------------------
// resolveOperand
// ---------------------------------------------------------------------------

describe("resolveOperand", () => {
  it("resolves a numeric literal", () => {
    const vars = new Map<string, number>();
    expect(resolveOperand("42", vars)).toBe(42);
  });

  it("resolves a negative numeric literal", () => {
    const vars = new Map<string, number>();
    expect(resolveOperand("-100", vars)).toBe(-100);
  });

  it("resolves a floating-point literal", () => {
    const vars = new Map<string, number>();
    expect(resolveOperand("3.14", vars)).toBe(3.14);
  });

  it("resolves a variable name from context", () => {
    const vars = new Map<string, number>([["w", 1000]]);
    expect(resolveOperand("w", vars)).toBe(1000);
  });

  it("returns 0 for unknown variable names", () => {
    const vars = new Map<string, number>();
    expect(resolveOperand("unknown", vars)).toBe(0);
  });

  it("prefers numeric parse over variable lookup", () => {
    // A token that looks numeric should parse as a number even if
    // there is a variable with that name.
    const vars = new Map<string, number>([["0", 999]]);
    expect(resolveOperand("0", vars)).toBe(0);
  });

  it("resolves zero correctly", () => {
    const vars = new Map<string, number>();
    expect(resolveOperand("0", vars)).toBe(0);
  });

  it("handles large OOXML values", () => {
    const vars = new Map<string, number>();
    expect(resolveOperand("21600000", vars)).toBe(21600000);
  });
});

// ---------------------------------------------------------------------------
// angleToRadians
// ---------------------------------------------------------------------------

describe("angleToRadians", () => {
  it("converts 0 to 0 radians", () => {
    expect(angleToRadians(0)).toBe(0);
  });

  it("converts 90 degrees (5400000) to PI/2", () => {
    expect(angleToRadians(90 * ANGLE_SCALE)).toBeCloseTo(Math.PI / 2);
  });

  it("converts 180 degrees (10800000) to PI", () => {
    expect(angleToRadians(180 * ANGLE_SCALE)).toBeCloseTo(Math.PI);
  });

  it("converts 360 degrees (21600000) to 2*PI", () => {
    expect(angleToRadians(360 * ANGLE_SCALE)).toBeCloseTo(2 * Math.PI);
  });

  it("converts negative angles correctly", () => {
    expect(angleToRadians(-90 * ANGLE_SCALE)).toBeCloseTo(-Math.PI / 2);
  });
});

// ---------------------------------------------------------------------------
// ANGLE_SCALE constant
// ---------------------------------------------------------------------------

describe("ANGLE_SCALE", () => {
  it("equals 60000", () => {
    expect(ANGLE_SCALE).toBe(60000);
  });
});
