import { describe, it, expect } from "vitest";
import { evaluateGeometryPaths, ooxmlArcToSvg } from "./guide-formula-paths";
import { ANGLE_SCALE } from "./guide-formula-eval";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ensureArray = (val: unknown): unknown[] =>
  Array.isArray(val) ? val : val != null ? [val] : [];

function makeVars(
  entries: Record<string, number> = {},
): Map<string, number> {
  const vars = new Map<string, number>();
  for (const [k, v] of Object.entries(entries)) {
    vars.set(k, v);
  }
  return vars;
}

// ---------------------------------------------------------------------------
// ooxmlArcToSvg — additional scenarios
// ---------------------------------------------------------------------------

describe("ooxmlArcToSvg — additional scenarios", () => {
  it("returns null when hR is zero", () => {
    expect(ooxmlArcToSvg(50, 0, 0, 90 * ANGLE_SCALE, 100, 100)).toBeNull();
  });

  it("returns null when both radii are zero", () => {
    expect(ooxmlArcToSvg(0, 0, 0, 90 * ANGLE_SCALE, 100, 100)).toBeNull();
  });

  it("returns null when negative radius", () => {
    expect(ooxmlArcToSvg(-10, 50, 0, 90 * ANGLE_SCALE, 100, 100)).toBeNull();
  });

  it("handles a full 360-degree sweep", () => {
    const result = ooxmlArcToSvg(50, 50, 0, 360 * ANGLE_SCALE, 150, 100);
    expect(result).not.toBeNull();
    // 360 degrees > 180, so large arc flag should be 1
    expect(result!.svg).toContain("1 1");
  });

  it("handles a negative sweep (clockwise direction)", () => {
    const result = ooxmlArcToSvg(50, 50, 0, -90 * ANGLE_SCALE, 150, 100);
    expect(result).not.toBeNull();
    // Negative sweep => sweep flag should be 0
    expect(result!.svg).toMatch(/0 0 0/);
  });

  it("produces correct endpoint for a 90-degree sweep from 0", () => {
    // Pen at (150, 100), wR=hR=50, stAng=0, swAng=90deg
    // Center = (150 - 50*cos(0), 100 - 50*sin(0)) = (100, 100)
    // End = (100 + 50*cos(PI/2), 100 + 50*sin(PI/2)) = (100, 150)
    const result = ooxmlArcToSvg(50, 50, 0, 90 * ANGLE_SCALE, 150, 100);
    expect(result).not.toBeNull();
    expect(result!.endX).toBeCloseTo(100, 1);
    expect(result!.endY).toBeCloseTo(150, 1);
  });

  it("produces correct endpoint for a 180-degree sweep", () => {
    // Pen at (150, 100), wR=hR=50, stAng=0, swAng=180deg
    // Center = (100, 100)
    // End = (100 + 50*cos(PI), 100 + 50*sin(PI)) = (50, 100)
    const result = ooxmlArcToSvg(50, 50, 0, 180 * ANGLE_SCALE, 150, 100);
    expect(result).not.toBeNull();
    expect(result!.endX).toBeCloseTo(50, 1);
    expect(result!.endY).toBeCloseTo(100, 1);
  });

  it("handles elliptical arc with different radii", () => {
    const result = ooxmlArcToSvg(100, 50, 0, 90 * ANGLE_SCALE, 200, 100);
    expect(result).not.toBeNull();
    expect(result!.svg).toMatch(/^A 100 50/);
  });

  it("handles a start angle of 90 degrees", () => {
    // Pen at (100, 150), wR=hR=50, stAng=90deg
    // cos(90deg)=0, sin(90deg)=1
    // Center = (100 - 50*0, 150 - 50*1) = (100, 100)
    const result = ooxmlArcToSvg(50, 50, 90 * ANGLE_SCALE, 90 * ANGLE_SCALE, 100, 150);
    expect(result).not.toBeNull();
    // End angle = 180deg, end = (100+50*cos(PI), 100+50*sin(PI)) = (50, 100)
    expect(result!.endX).toBeCloseTo(50, 1);
    expect(result!.endY).toBeCloseTo(100, 1);
  });

  it("rounds output values to 3 decimal places in SVG string", () => {
    const result = ooxmlArcToSvg(
      33.333,
      66.666,
      0,
      45 * ANGLE_SCALE,
      100,
      100,
    );
    expect(result).not.toBeNull();
    // Radii should be rounded
    expect(result!.svg).toMatch(/^A 33\.333 66\.666/);
  });
});

// ---------------------------------------------------------------------------
// evaluateGeometryPaths — cubicBezTo
// ---------------------------------------------------------------------------

describe("evaluateGeometryPaths — cubicBezTo", () => {
  it("generates a cubic bezier command from three control points", () => {
    const vars = makeVars({ w: 100, h: 100 });
    const pathNodes = [
      {
        "@_w": "100",
        "@_h": "100",
        "a:moveTo": { "a:pt": { "@_x": "0", "@_y": "0" } },
        "a:cubicBezTo": {
          "a:pt": [
            { "@_x": "33", "@_y": "0" },
            { "@_x": "67", "@_y": "100" },
            { "@_x": "100", "@_y": "100" },
          ],
        },
      },
    ];
    const result = evaluateGeometryPaths(pathNodes, vars, ensureArray);
    expect(result).not.toBeNull();
    expect(result!.pathData).toContain("M 0 0");
    expect(result!.pathData).toContain("C 33 0 67 100 100 100");
  });

  it("resolves variable references in cubic bezier points", () => {
    const vars = makeVars({ w: 200, h: 100, hc: 100, vc: 50 });
    const pathNodes = [
      {
        "a:moveTo": { "a:pt": { "@_x": "0", "@_y": "0" } },
        "a:cubicBezTo": {
          "a:pt": [
            { "@_x": "hc", "@_y": "0" },
            { "@_x": "hc", "@_y": "h" },
            { "@_x": "w", "@_y": "h" },
          ],
        },
      },
    ];
    const result = evaluateGeometryPaths(pathNodes, vars, ensureArray);
    expect(result).not.toBeNull();
    expect(result!.pathData).toContain("C 100 0 100 100 200 100");
  });
});

// ---------------------------------------------------------------------------
// evaluateGeometryPaths — quadBezTo
// ---------------------------------------------------------------------------

describe("evaluateGeometryPaths — quadBezTo", () => {
  it("generates a quadratic bezier command from two control points", () => {
    const vars = makeVars({ w: 100, h: 100 });
    const pathNodes = [
      {
        "@_w": "100",
        "@_h": "100",
        "a:moveTo": { "a:pt": { "@_x": "0", "@_y": "0" } },
        "a:quadBezTo": {
          "a:pt": [
            { "@_x": "50", "@_y": "100" },
            { "@_x": "100", "@_y": "0" },
          ],
        },
      },
    ];
    const result = evaluateGeometryPaths(pathNodes, vars, ensureArray);
    expect(result).not.toBeNull();
    expect(result!.pathData).toContain("M 0 0");
    expect(result!.pathData).toContain("Q 50 100 100 0");
  });

  it("resolves variable references in quadratic bezier points", () => {
    const vars = makeVars({ w: 200, h: 100, hc: 100 });
    const pathNodes = [
      {
        "a:moveTo": { "a:pt": { "@_x": "0", "@_y": "0" } },
        "a:quadBezTo": {
          "a:pt": [
            { "@_x": "hc", "@_y": "h" },
            { "@_x": "w", "@_y": "0" },
          ],
        },
      },
    ];
    const result = evaluateGeometryPaths(pathNodes, vars, ensureArray);
    expect(result).not.toBeNull();
    expect(result!.pathData).toContain("Q 100 100 200 0");
  });
});

// ---------------------------------------------------------------------------
// evaluateGeometryPaths — arcTo within path
// ---------------------------------------------------------------------------

describe("evaluateGeometryPaths — arcTo", () => {
  it("generates an arc command from a:arcTo", () => {
    const vars = makeVars({ w: 100, h: 100 });
    const pathNodes = [
      {
        "@_w": "100",
        "@_h": "100",
        "a:moveTo": { "a:pt": { "@_x": "100", "@_y": "50" } },
        "a:arcTo": {
          "@_wR": "50",
          "@_hR": "50",
          "@_stAng": "0",
          "@_swAng": String(90 * ANGLE_SCALE),
        },
      },
    ];
    const result = evaluateGeometryPaths(pathNodes, vars, ensureArray);
    expect(result).not.toBeNull();
    expect(result!.pathData).toContain("A ");
  });

  it("handles a:arcTo with variable references", () => {
    const vars = makeVars({ w: 200, h: 100, hc: 100, vc: 50 });
    const pathNodes = [
      {
        "a:moveTo": { "a:pt": { "@_x": "w", "@_y": "vc" } },
        "a:arcTo": {
          "@_wR": "hc",
          "@_hR": "vc",
          "@_stAng": "0",
          "@_swAng": String(90 * ANGLE_SCALE),
        },
      },
    ];
    const result = evaluateGeometryPaths(pathNodes, vars, ensureArray);
    expect(result).not.toBeNull();
    expect(result!.pathData).toContain("A ");
  });
});

// ---------------------------------------------------------------------------
// evaluateGeometryPaths — close and pen tracking
// ---------------------------------------------------------------------------

describe("evaluateGeometryPaths — close and pen tracking", () => {
  it("close resets pen position to the last moveTo", () => {
    const vars = makeVars({ w: 100, h: 100 });
    const pathNodes = [
      {
        "@_w": "100",
        "@_h": "100",
        "a:moveTo": { "a:pt": { "@_x": "10", "@_y": "20" } },
        "a:lnTo": [
          { "a:pt": { "@_x": "90", "@_y": "20" } },
          { "a:pt": { "@_x": "90", "@_y": "80" } },
        ],
        "a:close": "",
      },
    ];
    const result = evaluateGeometryPaths(pathNodes, vars, ensureArray);
    expect(result).not.toBeNull();
    expect(result!.pathData).toContain("M 10 20");
    expect(result!.pathData).toContain("Z");
  });

  it("handles multiple moveTo+close sequences", () => {
    const vars = makeVars({ w: 100, h: 100 });
    const pathNodes = [
      {
        "@_w": "100",
        "@_h": "100",
        "a:moveTo": [
          { "a:pt": { "@_x": "0", "@_y": "0" } },
        ],
        "a:lnTo": [{ "a:pt": { "@_x": "50", "@_y": "50" } }],
        "a:close": "",
      },
    ];
    const result = evaluateGeometryPaths(pathNodes, vars, ensureArray);
    expect(result).not.toBeNull();
    expect(result!.pathData).toContain("M 0 0");
    expect(result!.pathData).toContain("L 50 50");
    expect(result!.pathData).toContain("Z");
  });
});

// ---------------------------------------------------------------------------
// evaluateGeometryPaths — multiple paths
// ---------------------------------------------------------------------------

describe("evaluateGeometryPaths — multiple paths", () => {
  it("concatenates multiple path nodes", () => {
    const vars = makeVars({ w: 200, h: 100 });
    const pathNodes = [
      {
        "@_w": "200",
        "@_h": "100",
        "a:moveTo": { "a:pt": { "@_x": "0", "@_y": "0" } },
        "a:lnTo": { "a:pt": { "@_x": "100", "@_y": "0" } },
      },
      {
        "a:moveTo": { "a:pt": { "@_x": "100", "@_y": "0" } },
        "a:lnTo": { "a:pt": { "@_x": "200", "@_y": "100" } },
      },
    ];
    const result = evaluateGeometryPaths(pathNodes, vars, ensureArray);
    expect(result).not.toBeNull();
    expect(result!.pathData).toContain("M 0 0");
    expect(result!.pathData).toContain("L 100 0");
    expect(result!.pathData).toContain("M 100 0");
    expect(result!.pathData).toContain("L 200 100");
  });

  it("uses the first non-zero path dimensions", () => {
    const vars = makeVars({ w: 500, h: 300 });
    const pathNodes = [
      {
        "@_w": "0",
        "@_h": "0",
        "a:moveTo": { "a:pt": { "@_x": "0", "@_y": "0" } },
      },
      {
        "@_w": "200",
        "@_h": "150",
        "a:moveTo": { "a:pt": { "@_x": "10", "@_y": "10" } },
      },
    ];
    const result = evaluateGeometryPaths(pathNodes, vars, ensureArray);
    expect(result).not.toBeNull();
    expect(result!.pathWidth).toBe(200);
    expect(result!.pathHeight).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// evaluateGeometryPaths — edge cases
// ---------------------------------------------------------------------------

describe("evaluateGeometryPaths — edge cases", () => {
  it("returns null for path nodes that produce no commands", () => {
    const vars = makeVars({ w: 100, h: 100 });
    const pathNodes = [{ "@_w": "100", "@_h": "100" }];
    const result = evaluateGeometryPaths(pathNodes, vars, ensureArray);
    expect(result).toBeNull();
  });

  it("skips non-object items in path entries", () => {
    const vars = makeVars({ w: 100, h: 100 });
    const pathNodes = [
      {
        "a:moveTo": "invalid-string-not-object",
        "a:lnTo": { "a:pt": { "@_x": "50", "@_y": "50" } },
      },
    ];
    // moveTo has a non-object value, should be skipped
    const result = evaluateGeometryPaths(
      pathNodes as any,
      vars,
      ensureArray,
    );
    expect(result).not.toBeNull();
    expect(result!.pathData).toContain("L 50 50");
    expect(result!.pathData).not.toContain("M ");
  });

  it("ignores unknown element keys starting with a:", () => {
    const vars = makeVars({ w: 100, h: 100 });
    const pathNodes = [
      {
        "a:moveTo": { "a:pt": { "@_x": "0", "@_y": "0" } },
        "a:unknownCommand": { "a:pt": { "@_x": "50", "@_y": "50" } },
        "a:lnTo": { "a:pt": { "@_x": "100", "@_y": "100" } },
      },
    ];
    const result = evaluateGeometryPaths(pathNodes, vars, ensureArray);
    expect(result).not.toBeNull();
    expect(result!.pathData).toContain("M 0 0");
    expect(result!.pathData).toContain("L 100 100");
  });
});
