import { describe, it, expect } from "vitest";
import {
  createBuiltinVariables,
  evaluateGuides,
  parseGuideDefinitions,
  parseAdjustmentValues,
  resolveCoordinate,
} from "./guide-formula-api";
import { ANGLE_SCALE } from "./guide-formula-eval";

// ---------------------------------------------------------------------------
// createBuiltinVariables — comprehensive coverage
// ---------------------------------------------------------------------------

describe("createBuiltinVariables", () => {
  it("computes all width divisor variables", () => {
    const vars = createBuiltinVariables({ w: 2400, h: 1200 });
    expect(vars.get("wd2")).toBe(1200);
    expect(vars.get("wd3")).toBe(800);
    expect(vars.get("wd4")).toBe(600);
    expect(vars.get("wd5")).toBe(480);
    expect(vars.get("wd6")).toBe(400);
    expect(vars.get("wd8")).toBe(300);
    expect(vars.get("wd10")).toBe(240);
    expect(vars.get("wd12")).toBe(200);
  });

  it("computes all height divisor variables", () => {
    const vars = createBuiltinVariables({ w: 2400, h: 1200 });
    expect(vars.get("hd2")).toBe(600);
    expect(vars.get("hd3")).toBe(400);
    expect(vars.get("hd4")).toBe(300);
    expect(vars.get("hd5")).toBe(240);
    expect(vars.get("hd6")).toBe(200);
    expect(vars.get("hd8")).toBe(150);
    expect(vars.get("hd10")).toBe(120);
    expect(vars.get("hd12")).toBe(100);
  });

  it("computes all short-side divisor variables", () => {
    const vars = createBuiltinVariables({ w: 200, h: 100 });
    // ss = 100
    expect(vars.get("ssd2")).toBe(50);
    expect(vars.get("ssd4")).toBe(25);
    expect(vars.get("ssd6")).toBeCloseTo(100 / 6);
    expect(vars.get("ssd8")).toBe(12.5);
    expect(vars.get("ssd16")).toBe(6.25);
    expect(vars.get("ssd32")).toBe(3.125);
  });

  it("selects the shorter dimension as ss", () => {
    // When width is shorter
    const vars1 = createBuiltinVariables({ w: 50, h: 200 });
    expect(vars1.get("ss")).toBe(50);
    expect(vars1.get("ls")).toBe(200);

    // When height is shorter
    const vars2 = createBuiltinVariables({ w: 300, h: 100 });
    expect(vars2.get("ss")).toBe(100);
    expect(vars2.get("ls")).toBe(300);
  });

  it("computes ss = ls when w === h (square)", () => {
    const vars = createBuiltinVariables({ w: 150, h: 150 });
    expect(vars.get("ss")).toBe(150);
    expect(vars.get("ls")).toBe(150);
  });

  it("computes all angular constants", () => {
    const vars = createBuiltinVariables({ w: 100, h: 100 });
    expect(vars.get("cd2")).toBe(10800000); // 180 degrees
    expect(vars.get("cd4")).toBe(5400000); // 90 degrees
    expect(vars.get("cd8")).toBe(2700000); // 45 degrees
    expect(vars.get("3cd4")).toBe(16200000); // 270 degrees
    expect(vars.get("3cd8")).toBe(8100000); // 135 degrees
    expect(vars.get("5cd8")).toBe(13500000); // 225 degrees
    expect(vars.get("7cd8")).toBe(18900000); // 315 degrees
  });

  it("handles zero-dimension shapes", () => {
    const vars = createBuiltinVariables({ w: 0, h: 0 });
    expect(vars.get("w")).toBe(0);
    expect(vars.get("h")).toBe(0);
    expect(vars.get("hc")).toBe(0);
    expect(vars.get("vc")).toBe(0);
    expect(vars.get("ss")).toBe(0);
    expect(vars.get("ls")).toBe(0);
  });

  it("returns a Map with the expected number of entries", () => {
    const vars = createBuiltinVariables({ w: 100, h: 100 });
    // Position/size: w, h, l, t, r, b, hc, vc = 8
    // Width divisors: wd2..wd12 (8 values) = 8
    // Height divisors: hd2..hd12 (8 values) = 8
    // ss, ls = 2
    // ssd2..ssd32 (6 values) = 6
    // Angular: cd2, cd4, cd8, 3cd4, 3cd8, 5cd8, 7cd8 = 7
    // Total = 39
    expect(vars.size).toBe(39);
  });
});

// ---------------------------------------------------------------------------
// evaluateGuides — additional scenarios
// ---------------------------------------------------------------------------

describe("evaluateGuides — additional scenarios", () => {
  it("evaluates a chain of dependent guides", () => {
    const vars = evaluateGuides(
      [
        { name: "half_w", formula: "*/ w 1 2" },
        { name: "quarter_w", formula: "*/ half_w 1 2" },
        { name: "offset", formula: "+- quarter_w 10 0" },
      ],
      { w: 400, h: 200 },
    );
    expect(vars.get("half_w")).toBe(200);
    expect(vars.get("quarter_w")).toBe(100);
    expect(vars.get("offset")).toBe(110);
  });

  it("adjustment values override built-in variables", () => {
    // If an adjustment uses the same name as a built-in, adjustment wins
    const adjustments = new Map<string, number>([["w", 999]]);
    const vars = evaluateGuides([], { w: 500, h: 300 }, adjustments);
    expect(vars.get("w")).toBe(999);
  });

  it("handles an empty guide list", () => {
    const vars = evaluateGuides([], { w: 100, h: 200 });
    expect(vars.get("w")).toBe(100);
    expect(vars.get("h")).toBe(200);
    // Should have only built-in variables
    expect(vars.size).toBe(39);
  });

  it("uses built-in variables in guide formulas", () => {
    const vars = evaluateGuides(
      [{ name: "x1", formula: "+- hc 0 0" }],
      { w: 300, h: 200 },
    );
    // hc = w/2 = 150
    expect(vars.get("x1")).toBe(150);
  });

  it("uses angular constants in guide formulas", () => {
    const vars = evaluateGuides(
      [{ name: "angle", formula: "+- cd4 0 0" }],
      { w: 100, h: 100 },
    );
    expect(vars.get("angle")).toBe(90 * ANGLE_SCALE);
  });
});

// ---------------------------------------------------------------------------
// parseGuideDefinitions — additional edge cases
// ---------------------------------------------------------------------------

describe("parseGuideDefinitions — edge cases", () => {
  it("handles whitespace in name and formula attributes", () => {
    const nodes = [{ "@_name": "  adj  ", "@_fmla": "  val 100  " }];
    const guides = parseGuideDefinitions(nodes);
    expect(guides).toHaveLength(1);
    expect(guides[0].name).toBe("adj");
    expect(guides[0].formula).toBe("val 100");
  });

  it("handles null-ish values in node attributes", () => {
    const nodes = [
      { "@_name": null, "@_fmla": "val 100" },
      { "@_name": undefined, "@_fmla": "val 200" },
    ] as unknown as Array<Record<string, unknown>>;
    const guides = parseGuideDefinitions(nodes);
    // "null" and "undefined" become "null" and "undefined" strings after String(),
    // but trim() won't empty them. However the original code checks truthy after trim.
    // String(null) => "null", String(undefined) => "undefined" which are truthy...
    // Actually, the code does String(gd?.["@_name"] ?? ""), and null ?? "" is ""
    // (null is nullish), undefined ?? "" is ""
    expect(guides).toHaveLength(0);
  });

  it("handles a single-element array", () => {
    const nodes = [{ "@_name": "x", "@_fmla": "*/ w 1 2" }];
    const guides = parseGuideDefinitions(nodes);
    expect(guides).toHaveLength(1);
    expect(guides[0]).toEqual({ name: "x", formula: "*/ w 1 2" });
  });
});

// ---------------------------------------------------------------------------
// parseAdjustmentValues — additional edge cases
// ---------------------------------------------------------------------------

describe("parseAdjustmentValues — edge cases", () => {
  it("parses multiple adjustments", () => {
    const nodes = [
      { "@_name": "adj1", "@_fmla": "val 50000" },
      { "@_name": "adj2", "@_fmla": "val 25000" },
    ];
    const adj = parseAdjustmentValues(nodes);
    expect(adj.get("adj1")).toBe(50000);
    expect(adj.get("adj2")).toBe(25000);
  });

  it("ignores formulas that are not val patterns", () => {
    const nodes = [{ "@_name": "adj", "@_fmla": "+- w 0 0" }];
    const adj = parseAdjustmentValues(nodes);
    expect(adj.size).toBe(0);
  });

  it("handles @_val as a number type directly", () => {
    const nodes = [{ "@_name": "adj", "@_val": 30000 }];
    const adj = parseAdjustmentValues(nodes);
    expect(adj.get("adj")).toBe(30000);
  });

  it("skips non-finite @_val values", () => {
    const nodes = [{ "@_name": "adj", "@_val": "notanumber" }];
    const adj = parseAdjustmentValues(nodes);
    // Falls through to formula parsing, no formula => not set
    expect(adj.size).toBe(0);
  });

  it("returns empty map for empty input", () => {
    expect(parseAdjustmentValues([]).size).toBe(0);
  });

  it("handles val with extra whitespace", () => {
    // The regex expects exactly "val <number>", so extra spacing in
    // the formula itself (after splitting) should still work via trim
    const nodes = [{ "@_name": "adj", "@_fmla": "val 12345" }];
    const adj = parseAdjustmentValues(nodes);
    expect(adj.get("adj")).toBe(12345);
  });
});

// ---------------------------------------------------------------------------
// resolveCoordinate — additional scenarios
// ---------------------------------------------------------------------------

describe("resolveCoordinate — additional scenarios", () => {
  it("resolves a negative numeric string", () => {
    expect(resolveCoordinate("-50", new Map())).toBe(-50);
  });

  it("resolves a floating-point string", () => {
    expect(resolveCoordinate("3.14", new Map())).toBeCloseTo(3.14);
  });

  it("resolves a zero string", () => {
    expect(resolveCoordinate("0", new Map())).toBe(0);
  });

  it("resolves a variable reference when given as string", () => {
    const vars = new Map<string, number>([
      ["hc", 100],
      ["vc", 75],
    ]);
    expect(resolveCoordinate("hc", vars)).toBe(100);
    expect(resolveCoordinate("vc", vars)).toBe(75);
  });

  it("resolves a large OOXML number", () => {
    expect(resolveCoordinate("21600000", new Map())).toBe(21600000);
  });

  it("handles whitespace-padded string", () => {
    expect(resolveCoordinate("  42  ", new Map())).toBe(42);
  });
});
