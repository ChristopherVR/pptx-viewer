import { describe, it, expect } from "vitest";
import {
  getConnectorAdjustment,
  getConnectorPathGeometry,
  getCompoundLineOffsets,
  getCompoundLineWidths,
  getConnectionSites,
} from "./connector-path";
import type { PptxElementWithShapeStyle } from "pptx-viewer-core";

function makeElement(
  overrides: Partial<PptxElementWithShapeStyle> = {},
): PptxElementWithShapeStyle {
  return {
    id: "c1",
    type: "connector",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    shapeType: "straightConnector1",
    shapeAdjustments: {},
    ...overrides,
  } as unknown as PptxElementWithShapeStyle;
}

// ==========================================================================
// getConnectorAdjustment
// ==========================================================================

describe("getConnectorAdjustment", () => {
  it("returns fallback when no adjustments exist", () => {
    const el = makeElement({ shapeAdjustments: {} });
    expect(getConnectorAdjustment(el, "adj1", 0.5)).toBe(0.5);
  });

  it("reads the named key and normalizes from OOXML units (/100000)", () => {
    const el = makeElement({
      shapeAdjustments: { adj1: 50000 },
    });
    // 50000 / 100000 = 0.5
    expect(getConnectorAdjustment(el, "adj1", 0.3)).toBe(0.5);
  });

  it("falls back to adj key when named key is missing", () => {
    const el = makeElement({
      shapeAdjustments: { adj: 25000 },
    });
    // adj = 25000 / 100000 = 0.25
    expect(getConnectorAdjustment(el, "adj1", 0.5)).toBe(0.25);
  });

  it("clamps values above 1 to 1", () => {
    const el = makeElement({
      shapeAdjustments: { adj1: 200000 },
    });
    // 200000 / 100000 = 2.0, clamped to 1
    expect(getConnectorAdjustment(el, "adj1", 0.5)).toBe(1);
  });

  it("clamps negative values to 0", () => {
    const el = makeElement({
      shapeAdjustments: { adj1: -50000 },
    });
    // -50000 / 100000 = -0.5, clamped to 0
    expect(getConnectorAdjustment(el, "adj1", 0.5)).toBe(0);
  });

  it("ignores NaN and non-finite values, returns fallback", () => {
    const el = makeElement({
      shapeAdjustments: { adj1: NaN },
    });
    expect(getConnectorAdjustment(el, "adj1", 0.5)).toBe(0.5);
  });

  it("clamps fallback to unit interval", () => {
    const el = makeElement({ shapeAdjustments: {} });
    expect(getConnectorAdjustment(el, "adj1", 1.5)).toBe(1);
    expect(getConnectorAdjustment(el, "adj1", -0.5)).toBe(0);
  });

  it("returns 0 when value is exactly 0", () => {
    const el = makeElement({
      shapeAdjustments: { adj1: 0 },
    });
    expect(getConnectorAdjustment(el, "adj1", 0.5)).toBe(0);
  });
});

// ==========================================================================
// getConnectorPathGeometry
// ==========================================================================

describe("getConnectorPathGeometry", () => {
  it("returns a straight line for default/unknown connector type", () => {
    const el = makeElement({ width: 200, height: 100 });
    const geom = getConnectorPathGeometry(el);
    expect(geom.pathData).toBe("M 0 0 L 200 100");
    expect(geom.startX).toBe(0);
    expect(geom.startY).toBe(0);
    expect(geom.endX).toBe(200);
    expect(geom.endY).toBe(100);
  });

  it("clamps minimum width and height to 1", () => {
    const el = makeElement({ width: 0, height: 0 });
    const geom = getConnectorPathGeometry(el);
    expect(geom.endX).toBe(1);
    expect(geom.endY).toBe(1);
  });

  // ── Bent connector (generic) ──────────────────────────────────────────

  it("generates bent connector path (horizontal dominant)", () => {
    const el = makeElement({
      width: 200,
      height: 100,
      shapeType: "bentConnector2",
    });
    const geom = getConnectorPathGeometry(el);
    expect(geom.pathData).toContain("M 0 0");
    expect(geom.pathData).toContain("L 200 100");
    // Bent connector should have intermediate points
    const segments = geom.pathData.split("L");
    expect(segments.length).toBeGreaterThanOrEqual(3);
  });

  it("generates bent connector path (vertical dominant)", () => {
    const el = makeElement({
      width: 50,
      height: 200,
      shapeType: "bentConnector2",
    });
    const geom = getConnectorPathGeometry(el);
    expect(geom.pathData).toContain("M 0 0");
    expect(geom.pathData).toContain("L 50 200");
  });

  // ── Bent connector 3 ──────────────────────────────────────────────────

  it("generates bentconnector3 path (horizontal dominant)", () => {
    const el = makeElement({
      width: 300,
      height: 100,
      shapeType: "bentConnector3",
    });
    const geom = getConnectorPathGeometry(el);
    expect(geom.pathData).toContain("M 0 0");
    expect(geom.pathData).toContain("L 300 100");
    // bentconnector3 has more intermediate points than simple bent
    const segments = geom.pathData.split("L");
    expect(segments.length).toBeGreaterThanOrEqual(5);
  });

  it("generates bentconnector3 path (vertical dominant)", () => {
    const el = makeElement({
      width: 100,
      height: 300,
      shapeType: "bentConnector3",
    });
    const geom = getConnectorPathGeometry(el);
    expect(geom.pathData).toContain("M 0 0");
  });

  // ── Curved connector ──────────────────────────────────────────────────

  it("generates curved connector with Q command", () => {
    const el = makeElement({
      width: 200,
      height: 100,
      shapeType: "curvedConnector2",
    });
    const geom = getConnectorPathGeometry(el);
    expect(geom.pathData).toContain("Q");
    expect(geom.pathData).toContain("M 0 0");
  });

  // ── Curved connector 3 ────────────────────────────────────────────────

  it("generates curvedconnector3 with C (cubic bezier) command", () => {
    const el = makeElement({
      width: 200,
      height: 100,
      shapeType: "curvedConnector3",
    });
    const geom = getConnectorPathGeometry(el);
    expect(geom.pathData).toContain("C");
    expect(geom.pathData).toContain("M 0 0");
  });

  // ── Case-insensitive shape type matching ──────────────────────────────

  it("handles mixed-case shape type matching", () => {
    const el = makeElement({
      width: 200,
      height: 100,
      shapeType: "BentConnector3",
    });
    const geom = getConnectorPathGeometry(el);
    // Should match bentconnector3 case-insensitively
    const segments = geom.pathData.split("L");
    expect(segments.length).toBeGreaterThanOrEqual(5);
  });

  // ── Empty shape type ──────────────────────────────────────────────────

  it("falls back to straight line for empty shapeType", () => {
    const el = makeElement({
      width: 100,
      height: 50,
      shapeType: "",
    });
    const geom = getConnectorPathGeometry(el);
    expect(geom.pathData).toBe("M 0 0 L 100 50");
  });
});

// ==========================================================================
// getCompoundLineOffsets
// ==========================================================================

describe("getCompoundLineOffsets", () => {
  it("returns [0] for single line (sng)", () => {
    expect(getCompoundLineOffsets("sng", 2)).toEqual([0]);
  });

  it("returns [0] for undefined compound line", () => {
    expect(getCompoundLineOffsets(undefined, 2)).toEqual([0]);
  });

  it("returns two offsets for double line (dbl)", () => {
    const offsets = getCompoundLineOffsets("dbl", 4);
    expect(offsets).toHaveLength(2);
    expect(offsets[0]).toBeLessThan(0); // negative offset
    expect(offsets[1]).toBeGreaterThan(0); // positive offset
  });

  it("returns two asymmetric offsets for thickThin", () => {
    const offsets = getCompoundLineOffsets("thickThin", 4);
    expect(offsets).toHaveLength(2);
    // thickThin: first offset is smaller magnitude (thick line closer to center)
    expect(Math.abs(offsets[0])).toBeLessThan(Math.abs(offsets[1]));
  });

  it("returns two asymmetric offsets for thinThick", () => {
    const offsets = getCompoundLineOffsets("thinThick", 4);
    expect(offsets).toHaveLength(2);
    // thinThick: first offset is larger magnitude
    expect(Math.abs(offsets[0])).toBeGreaterThan(Math.abs(offsets[1]));
  });

  it("returns three offsets for triple line (tri)", () => {
    const offsets = getCompoundLineOffsets("tri", 4);
    expect(offsets).toHaveLength(3);
    expect(offsets[0]).toBeLessThan(0);
    expect(offsets[1]).toBe(0);
    expect(offsets[2]).toBeGreaterThan(0);
  });

  it("returns [0] for unknown compound line type", () => {
    expect(getCompoundLineOffsets("unknown", 4)).toEqual([0]);
  });

  it("enforces minimum gap of 1.5 for very thin strokes", () => {
    const offsets = getCompoundLineOffsets("dbl", 0.5);
    // gap = max(0.5 * 0.6, 1.5) = 1.5
    expect(Math.abs(offsets[0])).toBeCloseTo(1.5, 1);
    expect(Math.abs(offsets[1])).toBeCloseTo(1.5, 1);
  });
});

// ==========================================================================
// getCompoundLineWidths
// ==========================================================================

describe("getCompoundLineWidths", () => {
  it("returns [base] for single line (sng)", () => {
    expect(getCompoundLineWidths("sng", 4)).toEqual([4]);
  });

  it("returns [base] for undefined compound line", () => {
    expect(getCompoundLineWidths(undefined, 4)).toEqual([4]);
  });

  it("returns equal widths for double line (dbl)", () => {
    const widths = getCompoundLineWidths("dbl", 4);
    expect(widths).toHaveLength(2);
    expect(widths[0]).toBe(2); // 4 * 0.5
    expect(widths[1]).toBe(2); // 4 * 0.5
  });

  it("returns thick-then-thin widths for thickThin", () => {
    const widths = getCompoundLineWidths("thickThin", 10);
    expect(widths).toHaveLength(2);
    expect(widths[0]).toBe(7); // 10 * 0.7
    expect(widths[1]).toBe(3); // 10 * 0.3
  });

  it("returns thin-then-thick widths for thinThick", () => {
    const widths = getCompoundLineWidths("thinThick", 10);
    expect(widths).toHaveLength(2);
    expect(widths[0]).toBe(3); // 10 * 0.3
    expect(widths[1]).toBe(7); // 10 * 0.7
  });

  it("returns three widths for triple line (tri)", () => {
    const widths = getCompoundLineWidths("tri", 10);
    expect(widths).toHaveLength(3);
    expect(widths[0]).toBe(3); // 10 * 0.3
    expect(widths[1]).toBe(4); // 10 * 0.4
    expect(widths[2]).toBe(3); // 10 * 0.3
  });

  it("enforces minimum width of 1", () => {
    const widths = getCompoundLineWidths("sng", 0.5);
    expect(widths[0]).toBe(1);
  });

  it("returns [base] for unknown compound line type", () => {
    expect(getCompoundLineWidths("unknown", 4)).toEqual([4]);
  });
});

// ==========================================================================
// getConnectionSites
// ==========================================================================

describe("getConnectionSites", () => {
  it("returns four connection sites for a rectangle", () => {
    const sites = getConnectionSites(200, 100);
    expect(sites).toHaveLength(4);
  });

  it("top center site is at (width/2, 0)", () => {
    const sites = getConnectionSites(200, 100);
    const top = sites.find((s) => s.index === 0)!;
    expect(top.x).toBe(100);
    expect(top.y).toBe(0);
  });

  it("right center site is at (width, height/2)", () => {
    const sites = getConnectionSites(200, 100);
    const right = sites.find((s) => s.index === 1)!;
    expect(right.x).toBe(200);
    expect(right.y).toBe(50);
  });

  it("bottom center site is at (width/2, height)", () => {
    const sites = getConnectionSites(200, 100);
    const bottom = sites.find((s) => s.index === 2)!;
    expect(bottom.x).toBe(100);
    expect(bottom.y).toBe(100);
  });

  it("left center site is at (0, height/2)", () => {
    const sites = getConnectionSites(200, 100);
    const left = sites.find((s) => s.index === 3)!;
    expect(left.x).toBe(0);
    expect(left.y).toBe(50);
  });

  it("handles square dimensions", () => {
    const sites = getConnectionSites(100, 100);
    expect(sites[0]).toEqual({ x: 50, y: 0, index: 0 });
    expect(sites[1]).toEqual({ x: 100, y: 50, index: 1 });
    expect(sites[2]).toEqual({ x: 50, y: 100, index: 2 });
    expect(sites[3]).toEqual({ x: 0, y: 50, index: 3 });
  });

  it("indices are sequential 0-3", () => {
    const sites = getConnectionSites(200, 100);
    expect(sites.map((s) => s.index)).toEqual([0, 1, 2, 3]);
  });
});
