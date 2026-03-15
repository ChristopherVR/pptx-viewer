import { describe, it, expect } from "vitest";
import {
  isCalloutShape,
  getCalloutTier,
  getCalloutLeaderLineGeometry,
  buildCalloutLeaderLineSvgPath,
  getCalloutViewBoxBounds,
} from "./callout-geometry";

describe("isCalloutShape", () => {
  it("returns true for all 12 callout shape variants", () => {
    const names = [
      "callout1",
      "callout2",
      "callout3",
      "borderCallout1",
      "borderCallout2",
      "borderCallout3",
      "accentCallout1",
      "accentCallout2",
      "accentCallout3",
      "accentBorderCallout1",
      "accentBorderCallout2",
      "accentBorderCallout3",
    ];
    for (const name of names) {
      expect(isCalloutShape(name)).toBe(true);
    }
  });

  it("returns false for non-callout shapes", () => {
    expect(isCalloutShape("rect")).toBe(false);
    expect(isCalloutShape("wedgeRectCallout")).toBe(false);
    expect(isCalloutShape("cloudCallout")).toBe(false);
    expect(isCalloutShape(undefined)).toBe(false);
    expect(isCalloutShape("")).toBe(false);
  });
});

describe("getCalloutTier", () => {
  it("returns 1 for callout1 variants", () => {
    expect(getCalloutTier("callout1")).toBe(1);
    expect(getCalloutTier("borderCallout1")).toBe(1);
    expect(getCalloutTier("accentCallout1")).toBe(1);
    expect(getCalloutTier("accentBorderCallout1")).toBe(1);
  });

  it("returns 2 for callout2 variants", () => {
    expect(getCalloutTier("callout2")).toBe(2);
    expect(getCalloutTier("borderCallout2")).toBe(2);
  });

  it("returns 3 for callout3 variants", () => {
    expect(getCalloutTier("callout3")).toBe(3);
    expect(getCalloutTier("accentBorderCallout3")).toBe(3);
  });
});

describe("getCalloutLeaderLineGeometry", () => {
  const width = 400;
  const height = 200;

  it("returns null for non-callout shapes", () => {
    expect(getCalloutLeaderLineGeometry("rect", width, height)).toBeNull();
    expect(
      getCalloutLeaderLineGeometry("wedgeRectCallout", width, height),
    ).toBeNull();
  });

  it("computes callout1 geometry with defaults", () => {
    const geo = getCalloutLeaderLineGeometry("callout1", width, height);
    expect(geo).not.toBeNull();
    expect(geo!.points).toHaveLength(2);
    expect(geo!.hasBorder).toBe(false);
    expect(geo!.hasAccent).toBe(false);
    // adj1=18750 (y start) => 18750/100000 * 200 = 37.5
    // adj2=-8333 (x start) => -8333/100000 * 400 = -33.332
    expect(geo!.points[0].y).toBeCloseTo(37.5, 1);
    expect(geo!.points[0].x).toBeCloseTo(-33.332, 1);
    // adj3=112500 (y end) => 112500/100000 * 200 = 225
    // adj4=-38333 (x end) => -38333/100000 * 400 = -153.332
    expect(geo!.points[1].y).toBeCloseTo(225, 1);
    expect(geo!.points[1].x).toBeCloseTo(-153.332, 1);
  });

  it("computes callout1 geometry with custom adjustments", () => {
    const adjustments = {
      adj1: 50000, // y start = 50% of height = 100
      adj2: 0, // x start = 0% of width = 0
      adj3: 100000, // y end = 100% of height = 200
      adj4: 50000, // x end = 50% of width = 200
    };
    const geo = getCalloutLeaderLineGeometry(
      "callout1",
      width,
      height,
      adjustments,
    );
    expect(geo).not.toBeNull();
    expect(geo!.points[0]).toEqual({ x: 0, y: 100 });
    expect(geo!.points[1]).toEqual({ x: 200, y: 200 });
  });

  it("computes callout2 geometry with defaults (3 points)", () => {
    const geo = getCalloutLeaderLineGeometry("callout2", width, height);
    expect(geo).not.toBeNull();
    expect(geo!.points).toHaveLength(3);
  });

  it("computes callout3 geometry with defaults (4 points)", () => {
    const geo = getCalloutLeaderLineGeometry("callout3", width, height);
    expect(geo).not.toBeNull();
    expect(geo!.points).toHaveLength(4);
  });

  it("detects border flag for borderCallout variants", () => {
    const geo = getCalloutLeaderLineGeometry("borderCallout1", width, height);
    expect(geo!.hasBorder).toBe(true);
    expect(geo!.hasAccent).toBe(false);
  });

  it("detects accent flag for accentCallout variants", () => {
    const geo = getCalloutLeaderLineGeometry("accentCallout2", width, height);
    expect(geo!.hasBorder).toBe(false);
    expect(geo!.hasAccent).toBe(true);
  });

  it("detects both flags for accentBorderCallout variants", () => {
    const geo = getCalloutLeaderLineGeometry(
      "accentBorderCallout3",
      width,
      height,
    );
    expect(geo!.hasBorder).toBe(true);
    expect(geo!.hasAccent).toBe(true);
  });

  it("computes callout2 with custom adjustments (3 points)", () => {
    const adjustments = {
      adj1: 0,
      adj2: 0,
      adj3: 50000,
      adj4: 50000,
      adj5: 100000,
      adj6: 100000,
    };
    const geo = getCalloutLeaderLineGeometry(
      "callout2",
      width,
      height,
      adjustments,
    );
    expect(geo!.points).toEqual([
      { x: 0, y: 0 },
      { x: 200, y: 100 },
      { x: 400, y: 200 },
    ]);
  });

  it("computes callout3 with custom adjustments (4 points)", () => {
    const adjustments = {
      adj1: 0,
      adj2: 0,
      adj3: 25000,
      adj4: 25000,
      adj5: 50000,
      adj6: 75000,
      adj7: 100000,
      adj8: 100000,
    };
    const geo = getCalloutLeaderLineGeometry(
      "borderCallout3",
      400,
      200,
      adjustments,
    );
    expect(geo!.points).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 50 },
      { x: 300, y: 100 },
      { x: 400, y: 200 },
    ]);
  });
});

describe("buildCalloutLeaderLineSvgPath", () => {
  it("builds SVG path for 2-point leader line", () => {
    const path = buildCalloutLeaderLineSvgPath({
      points: [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ],
      hasBorder: false,
      hasAccent: false,
    });
    expect(path).toBe("M 10 20 L 30 40");
  });

  it("builds SVG path for 3-point leader line", () => {
    const path = buildCalloutLeaderLineSvgPath({
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 200 },
      ],
      hasBorder: false,
      hasAccent: false,
    });
    expect(path).toBe("M 0 0 L 50 100 L 100 200");
  });

  it("builds SVG path for 4-point leader line", () => {
    const path = buildCalloutLeaderLineSvgPath({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 20 },
        { x: 30, y: 40 },
        { x: 50, y: 60 },
      ],
      hasBorder: false,
      hasAccent: false,
    });
    expect(path).toBe("M 0 0 L 10 20 L 30 40 L 50 60");
  });

  it("returns empty string for geometry with fewer than 2 points", () => {
    const path = buildCalloutLeaderLineSvgPath({
      points: [{ x: 0, y: 0 }],
      hasBorder: false,
      hasAccent: false,
    });
    expect(path).toBe("");
  });
});

describe("getCalloutViewBoxBounds", () => {
  it("returns shape bounds when all points are inside", () => {
    const bounds = getCalloutViewBoxBounds(400, 200, {
      points: [
        { x: 10, y: 10 },
        { x: 200, y: 100 },
      ],
      hasBorder: false,
      hasAccent: false,
    });
    expect(bounds.minX).toBe(-2);
    expect(bounds.minY).toBe(-2);
    expect(bounds.viewWidth).toBe(404);
    expect(bounds.viewHeight).toBe(204);
  });

  it("expands bounds when callout point is outside shape", () => {
    const bounds = getCalloutViewBoxBounds(400, 200, {
      points: [
        { x: 0, y: 0 },
        { x: -100, y: 300 },
      ],
      hasBorder: false,
      hasAccent: false,
    });
    expect(bounds.minX).toBe(-102);
    expect(bounds.minY).toBe(-2);
    expect(bounds.viewWidth).toBe(504);
    expect(bounds.viewHeight).toBe(304);
  });

  it("uses custom padding", () => {
    const bounds = getCalloutViewBoxBounds(
      100,
      100,
      {
        points: [
          { x: 50, y: 50 },
          { x: 50, y: 50 },
        ],
        hasBorder: false,
        hasAccent: false,
      },
      5,
    );
    expect(bounds.minX).toBe(-5);
    expect(bounds.minY).toBe(-5);
    expect(bounds.viewWidth).toBe(110);
    expect(bounds.viewHeight).toBe(110);
  });
});
