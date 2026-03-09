import { describe, it, expect } from "vitest";
import {
  getConnectorAdjustment,
  getConnectorPathGeometry,
} from "./connector-geometry";
import type { PptxElementWithShapeStyle } from "../types";

// Helper to create a minimal connector element.
function makeConnector(
  overrides: Partial<{
    width: number;
    height: number;
    shapeType: string;
    shapeAdjustments: Record<string, number>;
  }> = {},
): PptxElementWithShapeStyle {
  return {
    id: "conn-1",
    type: "connector",
    x: 0,
    y: 0,
    width: overrides.width ?? 200,
    height: overrides.height ?? 100,
    shapeType: overrides.shapeType ?? "straightConnector1",
    shapeAdjustments: overrides.shapeAdjustments,
  } as unknown as PptxElementWithShapeStyle;
}

// ---------------------------------------------------------------------------
// getConnectorAdjustment
// ---------------------------------------------------------------------------

describe("getConnectorAdjustment", () => {
  it("returns the fallback when no adjustments exist", () => {
    const el = makeConnector({});
    expect(getConnectorAdjustment(el, "adj1", 0.5)).toBe(0.5);
  });

  it("reads a named adjustment and normalizes to [0, 1]", () => {
    const el = makeConnector({ shapeAdjustments: { adj1: 50000 } });
    expect(getConnectorAdjustment(el, "adj1", 0)).toBe(0.5);
  });

  it("falls back to the generic 'adj' key when named key is missing", () => {
    const el = makeConnector({ shapeAdjustments: { adj: 75000 } });
    expect(getConnectorAdjustment(el, "adj1", 0)).toBe(0.75);
  });

  it("clamps the normalized value to [0, 1]", () => {
    const el = makeConnector({ shapeAdjustments: { adj1: 200000 } });
    expect(getConnectorAdjustment(el, "adj1", 0.5)).toBe(1);

    const el2 = makeConnector({ shapeAdjustments: { adj1: -50000 } });
    expect(getConnectorAdjustment(el2, "adj1", 0.5)).toBe(0);
  });

  it("returns the named key over the generic adj key", () => {
    const el = makeConnector({
      shapeAdjustments: { adj1: 25000, adj: 75000 },
    });
    expect(getConnectorAdjustment(el, "adj1", 0.5)).toBe(0.25);
  });
});

// ---------------------------------------------------------------------------
// getConnectorPathGeometry — straight connector
// ---------------------------------------------------------------------------

describe("getConnectorPathGeometry — straightConnector1", () => {
  it("produces a straight-line path from (0,0) to (width,height)", () => {
    const el = makeConnector({
      shapeType: "straightConnector1",
      width: 200,
      height: 100,
    });
    const result = getConnectorPathGeometry(el);
    expect(result.startX).toBe(0);
    expect(result.startY).toBe(0);
    expect(result.endX).toBe(200);
    expect(result.endY).toBe(100);
    expect(result.pathData).toBe("M 0 0 L 200 100");
  });

  it("defaults to straight connector for unknown types", () => {
    const el = makeConnector({ shapeType: "unknownType", width: 50, height: 50 });
    const result = getConnectorPathGeometry(el);
    expect(result.pathData).toBe("M 0 0 L 50 50");
  });
});

// ---------------------------------------------------------------------------
// getConnectorPathGeometry — bentConnector2
// ---------------------------------------------------------------------------

describe("getConnectorPathGeometry — bentConnector2", () => {
  it("produces an L-shaped path", () => {
    const el = makeConnector({
      shapeType: "bentConnector2",
      width: 200,
      height: 100,
    });
    const result = getConnectorPathGeometry(el);
    expect(result.pathData).toBe("M 0 0 L 200 0 L 200 100");
    expect(result.startX).toBe(0);
    expect(result.endX).toBe(200);
    expect(result.endY).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// getConnectorPathGeometry — bentConnector3
// ---------------------------------------------------------------------------

describe("getConnectorPathGeometry — bentConnector3", () => {
  it("produces a Z-shaped path with default adjustment", () => {
    const el = makeConnector({
      shapeType: "bentConnector3",
      width: 200,
      height: 100,
    });
    const result = getConnectorPathGeometry(el);
    // Default adj1=0.5, midX = 200*0.5 = 100
    expect(result.pathData).toBe("M 0 0 L 100 0 L 100 100 L 200 100");
  });

  it("respects a custom adj1 adjustment", () => {
    const el = makeConnector({
      shapeType: "bentConnector3",
      width: 200,
      height: 100,
      shapeAdjustments: { adj1: 25000 },
    });
    const result = getConnectorPathGeometry(el);
    // adj1=0.25, midX = 200*0.25 = 50
    expect(result.pathData).toBe("M 0 0 L 50 0 L 50 100 L 200 100");
  });
});

// ---------------------------------------------------------------------------
// getConnectorPathGeometry — bentConnector4
// ---------------------------------------------------------------------------

describe("getConnectorPathGeometry — bentConnector4", () => {
  it("produces a 3-segment elbow path with default adjustments", () => {
    const el = makeConnector({
      shapeType: "bentConnector4",
      width: 200,
      height: 100,
    });
    const result = getConnectorPathGeometry(el);
    // Default adj1=0.5, adj2=0.5, midX=100, midY=50
    expect(result.pathData).toBe(
      "M 0 0 L 100 0 L 100 50 L 200 50 L 200 100",
    );
  });
});

// ---------------------------------------------------------------------------
// getConnectorPathGeometry — bentConnector5
// ---------------------------------------------------------------------------

describe("getConnectorPathGeometry — bentConnector5", () => {
  it("produces a 4-segment elbow path with default adjustments", () => {
    const el = makeConnector({
      shapeType: "bentConnector5",
      width: 200,
      height: 100,
    });
    const result = getConnectorPathGeometry(el);
    // Default all adj = 0.5: x1=100, yMid=50, x2=100
    expect(result.pathData).toBe(
      "M 0 0 L 100 0 L 100 50 L 100 50 L 100 100 L 200 100",
    );
  });
});

// ---------------------------------------------------------------------------
// getConnectorPathGeometry — curvedConnector2
// ---------------------------------------------------------------------------

describe("getConnectorPathGeometry — curvedConnector2", () => {
  it("produces a quadratic Bezier L-curve", () => {
    const el = makeConnector({
      shapeType: "curvedConnector2",
      width: 200,
      height: 100,
    });
    const result = getConnectorPathGeometry(el);
    expect(result.pathData).toBe("M 0 0 Q 200 0 200 100");
  });
});

// ---------------------------------------------------------------------------
// getConnectorPathGeometry — curvedConnector3
// ---------------------------------------------------------------------------

describe("getConnectorPathGeometry — curvedConnector3", () => {
  it("produces a 2-segment cubic Bezier", () => {
    const el = makeConnector({
      shapeType: "curvedConnector3",
      width: 200,
      height: 100,
    });
    const result = getConnectorPathGeometry(el);
    // adj1=0.5 → midX=100, midY=50
    expect(result.pathData).toBe(
      "M 0 0 C 100 0 100 0 100 50 C 100 100 100 100 200 100",
    );
  });
});

// ---------------------------------------------------------------------------
// Minimum dimension clamping
// ---------------------------------------------------------------------------

describe("getConnectorPathGeometry — dimension clamping", () => {
  it("enforces minimum 1px dimensions", () => {
    const el = makeConnector({
      shapeType: "straightConnector1",
      width: 0,
      height: 0,
    });
    const result = getConnectorPathGeometry(el);
    expect(result.endX).toBe(1);
    expect(result.endY).toBe(1);
    expect(result.pathData).toBe("M 0 0 L 1 1");
  });
});
