import { describe, it, expect } from "vitest";
import {
  evaluateFormula,
  parseFormula,
  ANGLE_SCALE,
} from "./guide-formula-eval";
import {
  createBuiltinVariables,
  evaluateGuides,
  parseGuideDefinitions,
  parseAdjustmentValues,
  resolveCoordinate,
} from "./guide-formula-api";
import { evaluateGeometryPaths, ooxmlArcToSvg } from "./guide-formula-paths";

// Shorthand: evaluate a formula string with a given variable context.
function evalFmla(fmla: string, vars?: Map<string, number>): number {
  return evaluateFormula(parseFormula(fmla), vars ?? new Map());
}

// ---------------------------------------------------------------------------
// evaluateFormula — arithmetic operators
// ---------------------------------------------------------------------------

describe("evaluateFormula — arithmetic", () => {
  it("val returns the literal value", () => {
    expect(evalFmla("val 42")).toBe(42);
  });

  it("+- computes x + y - z", () => {
    expect(evalFmla("+- 10 5 3")).toBe(12);
  });

  it("*/ computes (x * y) / z", () => {
    expect(evalFmla("*/ 6 7 2")).toBe(21);
  });

  it("*/ returns 0 when z is 0 (division guard)", () => {
    expect(evalFmla("*/ 100 50 0")).toBe(0);
  });

  it("+/ computes (x + y) / z", () => {
    expect(evalFmla("+/ 8 4 3")).toBe(4);
  });

  it("+/ returns 0 when z is 0", () => {
    expect(evalFmla("+/ 10 20 0")).toBe(0);
  });

  it("abs returns absolute value", () => {
    expect(evalFmla("abs -5")).toBe(5);
    expect(evalFmla("abs 5")).toBe(5);
  });

  it("sqrt returns square root (clamped to 0)", () => {
    expect(evalFmla("sqrt 25")).toBe(5);
    expect(evalFmla("sqrt 0")).toBe(0);
    // Negative input is clamped to 0 before sqrt
    expect(evalFmla("sqrt -4")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateFormula — conditional / clamping
// ---------------------------------------------------------------------------

describe("evaluateFormula — conditional and clamping", () => {
  it("?: returns y when x > 0, else z", () => {
    expect(evalFmla("?: 1 10 20")).toBe(10);
    expect(evalFmla("?: 0 10 20")).toBe(20);
    expect(evalFmla("?: -1 10 20")).toBe(20);
  });

  it("if is an alias for ?:", () => {
    expect(evalFmla("if 5 100 200")).toBe(100);
    expect(evalFmla("if -5 100 200")).toBe(200);
  });

  it("min returns the smaller of two values", () => {
    expect(evalFmla("min 10 20")).toBe(10);
    expect(evalFmla("min 20 10")).toBe(10);
  });

  it("max returns the larger of two values", () => {
    expect(evalFmla("max 10 20")).toBe(20);
    expect(evalFmla("max 20 10")).toBe(20);
  });

  it("pin clamps y between x and z", () => {
    expect(evalFmla("pin 0 50 100")).toBe(50); // in range
    expect(evalFmla("pin 0 -10 100")).toBe(0); // below min
    expect(evalFmla("pin 0 200 100")).toBe(100); // above max
  });

  it("mod computes sqrt(x^2 + y^2 + z^2)", () => {
    expect(evalFmla("mod 3 4 0")).toBe(5); // 3-4-5 triangle
    expect(evalFmla("mod 1 2 2")).toBe(3); // sqrt(1+4+4) = 3
  });
});

// ---------------------------------------------------------------------------
// evaluateFormula — trigonometric operators
// ---------------------------------------------------------------------------

describe("evaluateFormula — trigonometry", () => {
  it("sin computes x * sin(y) where y is OOXML angles", () => {
    // sin(90 degrees) = 1, so result = 100 * 1 = 100
    const result = evalFmla(`sin 100 ${90 * ANGLE_SCALE}`);
    expect(result).toBeCloseTo(100);
  });

  it("cos computes x * cos(y) where y is OOXML angles", () => {
    // cos(0) = 1, so result = 50 * 1 = 50
    expect(evalFmla("cos 50 0")).toBeCloseTo(50);
    // cos(90) = 0
    expect(evalFmla(`cos 50 ${90 * ANGLE_SCALE}`)).toBeCloseTo(0);
  });

  it("tan computes x * tan(y) where y is OOXML angles", () => {
    // tan(45 degrees) = 1, so result = 100
    expect(evalFmla(`tan 100 ${45 * ANGLE_SCALE}`)).toBeCloseTo(100);
  });

  it("atan returns atan(x) in OOXML angle units", () => {
    // atan(1) = 45 degrees = 2700000 OOXML units
    expect(evalFmla("atan 1")).toBeCloseTo(45 * ANGLE_SCALE);
  });

  it("at2 returns atan2(y, x) in OOXML angle units", () => {
    // atan2(1, 0) = 90 degrees
    expect(evalFmla("at2 1 0")).toBeCloseTo(90 * ANGLE_SCALE);
    // atan2(0, 1) = 0 degrees
    expect(evalFmla("at2 0 1")).toBeCloseTo(0);
  });

  it("cat2 computes x * cos(atan2(z, y))", () => {
    // atan2(0, 1) = 0, cos(0) = 1, so result = 100
    expect(evalFmla("cat2 100 1 0")).toBeCloseTo(100);
  });

  it("sat2 computes x * sin(atan2(z, y))", () => {
    // atan2(1, 0) = PI/2, sin(PI/2) = 1, so result = 100
    expect(evalFmla("sat2 100 0 1")).toBeCloseTo(100);
  });

  it("unknown formula returns 0", () => {
    expect(evalFmla("unknownOp 1 2 3")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateFormula — variable resolution
// ---------------------------------------------------------------------------

describe("evaluateFormula — variable resolution", () => {
  it("resolves variable references", () => {
    const vars = new Map<string, number>([
      ["w", 1000],
      ["h", 500],
    ]);
    expect(evaluateFormula(parseFormula("+/ w h 2"), vars)).toBe(750);
  });

  it("resolves missing variables as 0", () => {
    const vars = new Map<string, number>();
    expect(evaluateFormula(parseFormula("val missing"), vars)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// createBuiltinVariables
// ---------------------------------------------------------------------------

describe("createBuiltinVariables", () => {
  it("seeds w and h from context", () => {
    const vars = createBuiltinVariables({ w: 1000, h: 500 });
    expect(vars.get("w")).toBe(1000);
    expect(vars.get("h")).toBe(500);
  });

  it("computes hc and vc as half width/height", () => {
    const vars = createBuiltinVariables({ w: 200, h: 100 });
    expect(vars.get("hc")).toBe(100);
    expect(vars.get("vc")).toBe(50);
  });

  it("sets l=0, t=0, r=w, b=h", () => {
    const vars = createBuiltinVariables({ w: 300, h: 200 });
    expect(vars.get("l")).toBe(0);
    expect(vars.get("t")).toBe(0);
    expect(vars.get("r")).toBe(300);
    expect(vars.get("b")).toBe(200);
  });

  it("computes width-divided-by-N variables", () => {
    const vars = createBuiltinVariables({ w: 120, h: 60 });
    expect(vars.get("wd2")).toBe(60);
    expect(vars.get("wd3")).toBe(40);
    expect(vars.get("wd4")).toBe(30);
  });

  it("computes height-divided-by-N variables", () => {
    const vars = createBuiltinVariables({ w: 120, h: 60 });
    expect(vars.get("hd2")).toBe(30);
    expect(vars.get("hd3")).toBe(20);
  });

  it("computes ss (short side) and ls (long side)", () => {
    const vars = createBuiltinVariables({ w: 200, h: 100 });
    expect(vars.get("ss")).toBe(100);
    expect(vars.get("ls")).toBe(200);
  });

  it("computes ssd2 as half of short side", () => {
    const vars = createBuiltinVariables({ w: 200, h: 100 });
    expect(vars.get("ssd2")).toBe(50);
  });

  it("computes angular constants", () => {
    const vars = createBuiltinVariables({ w: 100, h: 100 });
    expect(vars.get("cd2")).toBe(180 * ANGLE_SCALE);
    expect(vars.get("cd4")).toBe(90 * ANGLE_SCALE);
    expect(vars.get("cd8")).toBe(45 * ANGLE_SCALE);
    expect(vars.get("3cd4")).toBe(270 * ANGLE_SCALE);
  });
});

// ---------------------------------------------------------------------------
// evaluateGuides
// ---------------------------------------------------------------------------

describe("evaluateGuides", () => {
  it("evaluates a single guide with a val formula", () => {
    const vars = evaluateGuides(
      [{ name: "adj", formula: "val 50000" }],
      { w: 100, h: 100 },
    );
    expect(vars.get("adj")).toBe(50000);
  });

  it("supports sequential guide references", () => {
    const vars = evaluateGuides(
      [
        { name: "g0", formula: "val 100" },
        { name: "g1", formula: "+- g0 50 0" },
      ],
      { w: 100, h: 100 },
    );
    expect(vars.get("g0")).toBe(100);
    expect(vars.get("g1")).toBe(150);
  });

  it("seeds adjustment values before evaluating guides", () => {
    const adjustments = new Map<string, number>([["adj", 25000]]);
    const vars = evaluateGuides(
      [{ name: "x1", formula: "*/ w adj 100000" }],
      { w: 200, h: 100 },
      adjustments,
    );
    // (200 * 25000) / 100000 = 50
    expect(vars.get("x1")).toBe(50);
  });

  it("replaces NaN/Infinity results with 0", () => {
    const vars = evaluateGuides(
      [{ name: "bad", formula: "+/ 0 0 0" }],
      { w: 100, h: 100 },
    );
    expect(vars.get("bad")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// parseGuideDefinitions
// ---------------------------------------------------------------------------

describe("parseGuideDefinitions", () => {
  it("parses guide definitions from XML objects", () => {
    const nodes = [
      { "@_name": "adj", "@_fmla": "val 50000" },
      { "@_name": "g0", "@_fmla": "+- w adj 0" },
    ];
    const guides = parseGuideDefinitions(nodes);
    expect(guides).toHaveLength(2);
    expect(guides[0]).toEqual({ name: "adj", formula: "val 50000" });
    expect(guides[1]).toEqual({ name: "g0", formula: "+- w adj 0" });
  });

  it("skips entries without name or formula", () => {
    const nodes = [
      { "@_name": "", "@_fmla": "val 100" },
      { "@_name": "g0", "@_fmla": "" },
      { "@_name": "g1", "@_fmla": "val 200" },
    ];
    const guides = parseGuideDefinitions(nodes);
    expect(guides).toHaveLength(1);
    expect(guides[0].name).toBe("g1");
  });

  it("returns empty array for empty input", () => {
    expect(parseGuideDefinitions([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// parseAdjustmentValues
// ---------------------------------------------------------------------------

describe("parseAdjustmentValues", () => {
  it("parses val formula adjustments", () => {
    const nodes = [{ "@_name": "adj", "@_fmla": "val 50000" }];
    const adj = parseAdjustmentValues(nodes);
    expect(adj.get("adj")).toBe(50000);
  });

  it("prefers @_val attribute over formula", () => {
    const nodes = [{ "@_name": "adj", "@_val": "25000", "@_fmla": "val 50000" }];
    const adj = parseAdjustmentValues(nodes);
    expect(adj.get("adj")).toBe(25000);
  });

  it("handles negative val adjustments", () => {
    const nodes = [{ "@_name": "adj", "@_fmla": "val -10000" }];
    const adj = parseAdjustmentValues(nodes);
    expect(adj.get("adj")).toBe(-10000);
  });

  it("skips entries without a name", () => {
    const nodes = [{ "@_name": "", "@_fmla": "val 100" }];
    const adj = parseAdjustmentValues(nodes);
    expect(adj.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// resolveCoordinate
// ---------------------------------------------------------------------------

describe("resolveCoordinate", () => {
  it("returns 0 for undefined input", () => {
    expect(resolveCoordinate(undefined, new Map())).toBe(0);
  });

  it("returns numeric input as-is", () => {
    expect(resolveCoordinate(42, new Map())).toBe(42);
  });

  it("parses a numeric string", () => {
    expect(resolveCoordinate("100", new Map())).toBe(100);
  });

  it("resolves a variable name from context", () => {
    const vars = new Map<string, number>([["x1", 250]]);
    expect(resolveCoordinate("x1", vars)).toBe(250);
  });

  it("returns 0 for unknown variable", () => {
    expect(resolveCoordinate("nope", new Map())).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ooxmlArcToSvg
// ---------------------------------------------------------------------------

describe("ooxmlArcToSvg", () => {
  it("returns null for zero-radius arc", () => {
    expect(ooxmlArcToSvg(0, 50, 0, 90 * ANGLE_SCALE, 100, 100)).toBeNull();
  });

  it("returns null for zero-sweep arc", () => {
    expect(ooxmlArcToSvg(50, 50, 0, 0, 100, 100)).toBeNull();
  });

  it("produces a valid SVG arc command for a 90-degree sweep", () => {
    const result = ooxmlArcToSvg(50, 50, 0, 90 * ANGLE_SCALE, 150, 100);
    expect(result).not.toBeNull();
    expect(result!.svg).toMatch(/^A /);
    // The endpoint should be a finite number
    expect(Number.isFinite(result!.endX)).toBe(true);
    expect(Number.isFinite(result!.endY)).toBe(true);
  });

  it("sets large-arc flag for sweeps > 180 degrees", () => {
    const result = ooxmlArcToSvg(50, 50, 0, 270 * ANGLE_SCALE, 150, 100);
    expect(result).not.toBeNull();
    // Large arc flag should be 1
    expect(result!.svg).toMatch(/A \d+(\.\d+)? \d+(\.\d+)? 0 1 1/);
  });

  it("sets sweep flag correctly for positive sweep", () => {
    const result = ooxmlArcToSvg(50, 50, 0, 45 * ANGLE_SCALE, 150, 100);
    expect(result).not.toBeNull();
    // Sweep flag should be 1 for positive sweep
    expect(result!.svg).toMatch(/0 0 1/);
  });
});

// ---------------------------------------------------------------------------
// evaluateGeometryPaths
// ---------------------------------------------------------------------------

describe("evaluateGeometryPaths", () => {
  const ensureArray = (val: unknown): unknown[] =>
    Array.isArray(val) ? val : val != null ? [val] : [];

  it("returns null for empty path nodes", () => {
    const result = evaluateGeometryPaths([], new Map(), ensureArray);
    expect(result).toBeNull();
  });

  it("handles a simple moveTo + lineTo path", () => {
    const vars = new Map<string, number>([
      ["w", 100],
      ["h", 100],
    ]);
    const pathNodes = [
      {
        "@_w": "100",
        "@_h": "100",
        "a:moveTo": { "a:pt": { "@_x": "0", "@_y": "0" } },
        "a:lnTo": { "a:pt": { "@_x": "100", "@_y": "100" } },
      },
    ];
    const result = evaluateGeometryPaths(pathNodes, vars, ensureArray);
    expect(result).not.toBeNull();
    expect(result!.pathData).toContain("M 0 0");
    expect(result!.pathData).toContain("L 100 100");
    expect(result!.pathWidth).toBe(100);
    expect(result!.pathHeight).toBe(100);
  });

  it("handles close commands", () => {
    const vars = new Map<string, number>([
      ["w", 100],
      ["h", 100],
    ]);
    const pathNodes = [
      {
        "@_w": "100",
        "@_h": "100",
        "a:moveTo": { "a:pt": { "@_x": "0", "@_y": "0" } },
        "a:lnTo": { "a:pt": { "@_x": "100", "@_y": "100" } },
        "a:close": "",
      },
    ];
    const result = evaluateGeometryPaths(pathNodes, vars, ensureArray);
    expect(result).not.toBeNull();
    expect(result!.pathData).toContain("Z");
  });

  it("resolves variable references in coordinates", () => {
    const vars = new Map<string, number>([
      ["w", 200],
      ["h", 150],
      ["hc", 100],
      ["vc", 75],
    ]);
    const pathNodes = [
      {
        "a:moveTo": { "a:pt": { "@_x": "hc", "@_y": "0" } },
        "a:lnTo": { "a:pt": { "@_x": "w", "@_y": "vc" } },
      },
    ];
    const result = evaluateGeometryPaths(pathNodes, vars, ensureArray);
    expect(result).not.toBeNull();
    expect(result!.pathData).toContain("M 100 0");
    expect(result!.pathData).toContain("L 200 75");
  });

  it("uses w/h from variables when path has no dimensions", () => {
    const vars = new Map<string, number>([
      ["w", 300],
      ["h", 200],
    ]);
    const pathNodes = [
      {
        "a:moveTo": { "a:pt": { "@_x": "0", "@_y": "0" } },
      },
    ];
    const result = evaluateGeometryPaths(pathNodes, vars, ensureArray);
    expect(result).not.toBeNull();
    expect(result!.pathWidth).toBe(300);
    expect(result!.pathHeight).toBe(200);
  });
});
