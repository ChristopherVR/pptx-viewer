import { describe, it, expect } from "vitest";
import {
  computeSnakeLayout,
  computeLinearLayout,
  computeHierarchyLayout,
  computeCycleLayout,
  computePyramidLayout,
  computeMatrixLayout,
  computeSmartArtLayout,
  parseLayoutDefinition,
  layoutEngineShapesToDrawingShapes,
  type LayoutConstraints,
  type LayoutEngineShape,
} from "./smartart-layout-engine";
import type {
  PptxSmartArtNode,
  PptxSmartArtData,
} from "../types";
import type { ContainerBounds } from "./smartart-helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const bounds: ContainerBounds = { x: 0, y: 0, width: 400, height: 300 };

function makeNodes(texts: string[]): PptxSmartArtNode[] {
  return texts.map((text, i) => ({
    id: String(i + 1),
    text,
  }));
}

function makeHierarchyNodes(): PptxSmartArtNode[] {
  return [
    { id: "root", text: "CEO" },
    { id: "c1", text: "VP Sales", parentId: "root" },
    { id: "c2", text: "VP Engineering", parentId: "root" },
    { id: "c3", text: "VP Marketing", parentId: "root" },
    { id: "gc1", text: "Dev Lead", parentId: "c2" },
    { id: "gc2", text: "QA Lead", parentId: "c2" },
  ];
}

function assertNonOverlapping(shapes: LayoutEngineShape[]): void {
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i];
      const b = shapes[j];
      const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
      const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
      if (overlapX && overlapY) {
        // Allow minor overlap (rounding errors)
        const overlapAmount = Math.min(
          a.x + a.width - b.x,
          b.x + b.width - a.x,
          a.y + a.height - b.y,
          b.y + b.height - a.y,
        );
        expect(overlapAmount).toBeLessThan(5);
      }
    }
  }
}

function assertWithinBounds(
  shapes: LayoutEngineShape[],
  containerBounds: ContainerBounds,
): void {
  for (const shape of shapes) {
    expect(shape.x).toBeGreaterThanOrEqual(containerBounds.x - 1);
    expect(shape.y).toBeGreaterThanOrEqual(containerBounds.y - 1);
    expect(shape.x + shape.width).toBeLessThanOrEqual(
      containerBounds.x + containerBounds.width + 1,
    );
    expect(shape.y + shape.height).toBeLessThanOrEqual(
      containerBounds.y + containerBounds.height + 1,
    );
  }
}

// ===========================================================================
// computeSnakeLayout
// ===========================================================================

describe("computeSnakeLayout", () => {
  it("returns empty array for no nodes", () => {
    expect(computeSnakeLayout([], {}, bounds)).toEqual([]);
  });

  it("returns empty array for nodes with empty text", () => {
    expect(computeSnakeLayout([{ id: "1", text: "" }], {}, bounds)).toEqual([]);
  });

  it("lays out nodes in a grid pattern", () => {
    const nodes = makeNodes(["A", "B", "C", "D", "E", "F"]);
    const shapes = computeSnakeLayout(nodes, {}, bounds);
    expect(shapes).toHaveLength(6);

    // All shapes should have valid dimensions
    for (const s of shapes) {
      expect(s.width).toBeGreaterThan(0);
      expect(s.height).toBeGreaterThan(0);
    }
  });

  it("applies serpentine pattern on odd rows", () => {
    const nodes = makeNodes(["A", "B", "C", "D", "E", "F", "G", "H"]);
    const shapes = computeSnakeLayout(nodes, { cols: 4 }, bounds);
    expect(shapes).toHaveLength(8);

    // Row 0 (even): left to right — A, B, C, D
    // Row 1 (odd): right to left — E, F, G, H reversed positionally
    const row0 = shapes.slice(0, 4);
    const row1 = shapes.slice(4, 8);

    // Row 0: x positions should be ascending
    for (let i = 0; i < row0.length - 1; i++) {
      expect(row0[i].x).toBeLessThan(row0[i + 1].x);
    }

    // Row 1: x positions should be descending (serpentine)
    for (let i = 0; i < row1.length - 1; i++) {
      expect(row1[i].x).toBeGreaterThan(row1[i + 1].x);
    }
  });

  it("respects column count constraint", () => {
    const nodes = makeNodes(["A", "B", "C", "D", "E"]);
    const shapes = computeSnakeLayout(nodes, { cols: 3 }, bounds);
    expect(shapes).toHaveLength(5);

    // First 3 shapes should be on the same row (same y)
    expect(shapes[0].y).toBe(shapes[1].y);
    expect(shapes[1].y).toBe(shapes[2].y);

    // 4th and 5th on a different row
    expect(shapes[3].y).toBeGreaterThan(shapes[0].y);
    expect(shapes[3].y).toBe(shapes[4].y);
  });

  it("respects spacing constraints", () => {
    const nodes = makeNodes(["A", "B"]);
    const narrowConstraints: LayoutConstraints = {
      sibSp: 0.1,
      begPad: 0.05,
      endPad: 0.05,
    };
    const shapes = computeSnakeLayout(nodes, narrowConstraints, bounds);
    expect(shapes).toHaveLength(2);
    assertWithinBounds(shapes, bounds);
  });

  it("handles single node", () => {
    const shapes = computeSnakeLayout(makeNodes(["Only"]), {}, bounds);
    expect(shapes).toHaveLength(1);
    expect(shapes[0].width).toBeGreaterThan(0);
    expect(shapes[0].height).toBeGreaterThan(0);
  });

  it("wrapping: 10 nodes in 3 columns produces 4 rows", () => {
    const nodes = makeNodes(
      Array.from({ length: 10 }, (_, i) => `N${i + 1}`),
    );
    const shapes = computeSnakeLayout(nodes, { cols: 3 }, bounds);
    expect(shapes).toHaveLength(10);

    // Get unique y values to count rows
    const uniqueYs = new Set(shapes.map((s) => s.y));
    expect(uniqueYs.size).toBe(4);
  });
});

// ===========================================================================
// computeLinearLayout
// ===========================================================================

describe("computeLinearLayout", () => {
  it("returns empty array for no nodes", () => {
    expect(computeLinearLayout([], {}, bounds)).toEqual([]);
  });

  it("arranges nodes horizontally by default", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const shapes = computeLinearLayout(nodes, {}, bounds);
    expect(shapes).toHaveLength(3);

    // All on same row (approximately same y)
    const baseY = shapes[0].y;
    for (const s of shapes) {
      expect(s.y).toBe(baseY);
    }

    // x positions should be ascending
    for (let i = 0; i < shapes.length - 1; i++) {
      expect(shapes[i].x).toBeLessThan(shapes[i + 1].x);
    }
  });

  it("arranges nodes vertically when aspectRatio < 0.5", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const shapes = computeLinearLayout(nodes, { aspectRatio: 0.3 }, bounds);
    expect(shapes).toHaveLength(3);

    // All on same column (approximately same x)
    const baseX = shapes[0].x;
    for (const s of shapes) {
      expect(s.x).toBe(baseX);
    }

    // y positions should be ascending
    for (let i = 0; i < shapes.length - 1; i++) {
      expect(shapes[i].y).toBeLessThan(shapes[i + 1].y);
    }
  });

  it("respects width constraint", () => {
    const nodes = makeNodes(["A", "B"]);
    const shapes = computeLinearLayout(nodes, { h: 0.3 }, bounds);
    expect(shapes).toHaveLength(2);
    // Height should be 30% of container height
    expect(shapes[0].height).toBe(Math.round(0.3 * bounds.height));
  });

  it("handles single node horizontally", () => {
    const shapes = computeLinearLayout(makeNodes(["Only"]), {}, bounds);
    expect(shapes).toHaveLength(1);
    assertWithinBounds(shapes, bounds);
  });

  it("reverses direction when dir is rev", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const normalShapes = computeLinearLayout(nodes, {}, bounds);
    const revShapes = computeLinearLayout(nodes, { dir: "rev" }, bounds);

    expect(normalShapes).toHaveLength(3);
    expect(revShapes).toHaveLength(3);

    // In reversed layout, node A (nodeId "1") should be on the right
    const normalA = normalShapes.find((s) => s.nodeId === "1")!;
    const revA = revShapes.find((s) => s.nodeId === "1")!;
    expect(revA.x).toBeGreaterThan(normalA.x);
  });

  it("applies sibling spacing", () => {
    const nodes = makeNodes(["A", "B"]);
    const tightShapes = computeLinearLayout(nodes, { sibSp: 0.01 }, bounds);
    const looseShapes = computeLinearLayout(nodes, { sibSp: 0.15 }, bounds);

    // Tighter spacing should result in wider nodes
    expect(tightShapes[0].width).toBeGreaterThan(looseShapes[0].width);
  });
});

// ===========================================================================
// computeHierarchyLayout
// ===========================================================================

describe("computeHierarchyLayout", () => {
  it("returns empty array for no nodes", () => {
    expect(computeHierarchyLayout([], {}, bounds)).toEqual([]);
  });

  it("lays out a simple parent-child hierarchy", () => {
    const nodes: PptxSmartArtNode[] = [
      { id: "root", text: "Root" },
      { id: "child1", text: "Child 1", parentId: "root" },
      { id: "child2", text: "Child 2", parentId: "root" },
    ];
    const shapes = computeHierarchyLayout(nodes, {}, bounds);
    expect(shapes).toHaveLength(3);

    // Root should be above children
    const root = shapes.find((s) => s.nodeId === "root")!;
    const child1 = shapes.find((s) => s.nodeId === "child1")!;
    const child2 = shapes.find((s) => s.nodeId === "child2")!;

    expect(root.y).toBeLessThan(child1.y);
    expect(root.y).toBeLessThan(child2.y);

    // Children should be at the same level
    expect(child1.y).toBe(child2.y);
  });

  it("handles deep hierarchy (3 levels)", () => {
    const nodes = makeHierarchyNodes();
    const shapes = computeHierarchyLayout(nodes, {}, bounds);
    expect(shapes).toHaveLength(6);

    const root = shapes.find((s) => s.nodeId === "root")!;
    const c2 = shapes.find((s) => s.nodeId === "c2")!;
    const gc1 = shapes.find((s) => s.nodeId === "gc1")!;

    // 3 distinct levels
    expect(root.y).toBeLessThan(c2.y);
    expect(c2.y).toBeLessThan(gc1.y);
  });

  it("handles varying tree widths", () => {
    const nodes: PptxSmartArtNode[] = [
      { id: "r", text: "Root" },
      { id: "a", text: "A", parentId: "r" },
      { id: "b", text: "B", parentId: "r" },
      { id: "b1", text: "B1", parentId: "b" },
      { id: "b2", text: "B2", parentId: "b" },
      { id: "b3", text: "B3", parentId: "b" },
    ];
    const shapes = computeHierarchyLayout(nodes, {}, bounds);
    expect(shapes).toHaveLength(6);

    // B subtree (3 leaves) should be wider than A subtree (1 leaf)
    const a = shapes.find((s) => s.nodeId === "a")!;
    const b = shapes.find((s) => s.nodeId === "b")!;
    const b1 = shapes.find((s) => s.nodeId === "b1")!;
    const b3 = shapes.find((s) => s.nodeId === "b3")!;

    // B's children should span a wider area than A
    const bChildrenWidth = b3.x + b3.width - b1.x;
    expect(bChildrenWidth).toBeGreaterThan(a.width);
  });

  it("falls back to linear for flat nodes without hierarchy", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const shapes = computeHierarchyLayout(nodes, {}, bounds);
    expect(shapes).toHaveLength(3);

    // Should produce a valid layout even without parent-child relationships
    for (const s of shapes) {
      expect(s.width).toBeGreaterThan(0);
      expect(s.height).toBeGreaterThan(0);
    }
  });

  it("handles multiple root nodes (forest)", () => {
    const nodes: PptxSmartArtNode[] = [
      { id: "r1", text: "Root 1" },
      { id: "r1c", text: "R1 Child", parentId: "r1" },
      { id: "r2", text: "Root 2" },
      { id: "r2c", text: "R2 Child", parentId: "r2" },
    ];
    const shapes = computeHierarchyLayout(nodes, {}, bounds);
    expect(shapes).toHaveLength(4);

    // Both roots at same level
    const r1 = shapes.find((s) => s.nodeId === "r1")!;
    const r2 = shapes.find((s) => s.nodeId === "r2")!;
    expect(r1.y).toBe(r2.y);
  });
});

// ===========================================================================
// computeCycleLayout
// ===========================================================================

describe("computeCycleLayout", () => {
  it("returns empty array for no nodes", () => {
    expect(computeCycleLayout([], {}, bounds)).toEqual([]);
  });

  it("arranges nodes in a circle", () => {
    const nodes = makeNodes(["A", "B", "C", "D"]);
    const shapes = computeCycleLayout(nodes, {}, bounds);
    expect(shapes).toHaveLength(4);

    // Compute center of all shapes
    const centerX =
      shapes.reduce((sum, s) => sum + s.x + s.width / 2, 0) / shapes.length;
    const centerY =
      shapes.reduce((sum, s) => sum + s.y + s.height / 2, 0) / shapes.length;

    // All shapes should be roughly equidistant from center
    const distances = shapes.map((s) => {
      const dx = s.x + s.width / 2 - centerX;
      const dy = s.y + s.height / 2 - centerY;
      return Math.sqrt(dx * dx + dy * dy);
    });
    const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
    for (const d of distances) {
      expect(Math.abs(d - avgDist)).toBeLessThan(avgDist * 0.2);
    }
  });

  it("handles different node counts", () => {
    for (const count of [2, 3, 5, 8]) {
      const nodes = makeNodes(
        Array.from({ length: count }, (_, i) => `N${i}`),
      );
      const shapes = computeCycleLayout(nodes, {}, bounds);
      expect(shapes).toHaveLength(count);
    }
  });

  it("respects width constraint", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const shapes = computeCycleLayout(nodes, { w: 0.15 }, bounds);
    expect(shapes).toHaveLength(3);
    expect(shapes[0].width).toBe(Math.round(0.15 * bounds.width));
  });

  it("handles single node", () => {
    const shapes = computeCycleLayout(makeNodes(["Solo"]), {}, bounds);
    expect(shapes).toHaveLength(1);
    // Single node should be at the top of the circle (angle = -PI/2)
  });
});

// ===========================================================================
// computePyramidLayout
// ===========================================================================

describe("computePyramidLayout", () => {
  it("returns empty array for no nodes", () => {
    expect(computePyramidLayout([], {}, bounds)).toEqual([]);
  });

  it("arranges nodes from narrow (top) to wide (bottom)", () => {
    const nodes = makeNodes(["Top", "Middle", "Bottom"]);
    const shapes = computePyramidLayout(nodes, {}, bounds);
    expect(shapes).toHaveLength(3);

    // Width should increase from top to bottom
    expect(shapes[0].width).toBeLessThan(shapes[1].width);
    expect(shapes[1].width).toBeLessThan(shapes[2].width);

    // Y should increase (top to bottom)
    expect(shapes[0].y).toBeLessThan(shapes[1].y);
    expect(shapes[1].y).toBeLessThan(shapes[2].y);
  });

  it("centers nodes horizontally", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const shapes = computePyramidLayout(nodes, {}, bounds);

    for (const s of shapes) {
      const center = s.x + s.width / 2;
      expect(Math.abs(center - bounds.width / 2)).toBeLessThan(2);
    }
  });

  it("handles single node as full width", () => {
    const shapes = computePyramidLayout(makeNodes(["Only"]), {}, bounds);
    expect(shapes).toHaveLength(1);
    // Single node should span most of the container width
    expect(shapes[0].width).toBeGreaterThan(bounds.width * 0.2);
  });

  it("applies spacing constraint", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const tight = computePyramidLayout(nodes, { sibSp: 0.01 }, bounds);
    const loose = computePyramidLayout(nodes, { sibSp: 0.1 }, bounds);

    // With tighter spacing, bands should be taller
    expect(tight[0].height).toBeGreaterThan(loose[0].height);
  });
});

// ===========================================================================
// computeMatrixLayout
// ===========================================================================

describe("computeMatrixLayout", () => {
  it("returns empty array for no nodes", () => {
    expect(computeMatrixLayout([], {}, bounds)).toEqual([]);
  });

  it("arranges 4 nodes in a 2x2 grid", () => {
    const nodes = makeNodes(["A", "B", "C", "D"]);
    const shapes = computeMatrixLayout(nodes, {}, bounds);
    expect(shapes).toHaveLength(4);

    // A and B should be on the same row
    expect(shapes[0].y).toBe(shapes[1].y);
    // C and D on the next row
    expect(shapes[2].y).toBe(shapes[3].y);
    // A and C in the same column
    expect(shapes[0].x).toBe(shapes[2].x);

    // All cells should be roughly the same size
    const widths = shapes.map((s) => s.width);
    const heights = shapes.map((s) => s.height);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(2);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(2);
  });

  it("respects cols constraint for non-square grids", () => {
    const nodes = makeNodes(["A", "B", "C", "D", "E", "F"]);
    const shapes = computeMatrixLayout(nodes, { cols: 3 }, bounds);
    expect(shapes).toHaveLength(6);

    // First 3 on row 0, next 3 on row 1
    expect(shapes[0].y).toBe(shapes[1].y);
    expect(shapes[1].y).toBe(shapes[2].y);
    expect(shapes[3].y).toBe(shapes[4].y);
    expect(shapes[4].y).toBe(shapes[5].y);
    expect(shapes[0].y).toBeLessThan(shapes[3].y);
  });

  it("handles 9 nodes in 3x3 grid", () => {
    const nodes = makeNodes(
      Array.from({ length: 9 }, (_, i) => `Item ${i + 1}`),
    );
    const shapes = computeMatrixLayout(nodes, {}, bounds);
    expect(shapes).toHaveLength(9);

    // Should auto-compute 3 columns
    const uniqueXs = new Set(shapes.map((s) => s.x));
    expect(uniqueXs.size).toBe(3);
  });

  it("handles odd number of nodes", () => {
    const nodes = makeNodes(["A", "B", "C", "D", "E"]);
    const shapes = computeMatrixLayout(nodes, {}, bounds);
    expect(shapes).toHaveLength(5);
    assertWithinBounds(shapes, bounds);
  });
});

// ===========================================================================
// computeSmartArtLayout (high-level engine)
// ===========================================================================

describe("computeSmartArtLayout", () => {
  it("returns undefined for empty nodes", () => {
    const data: PptxSmartArtData = { nodes: [] };
    expect(computeSmartArtLayout(data, bounds)).toBeUndefined();
  });

  it("returns undefined when all nodes have empty text", () => {
    const data: PptxSmartArtData = {
      nodes: [{ id: "1", text: "" }],
    };
    expect(computeSmartArtLayout(data, bounds)).toBeUndefined();
  });

  it("selects snake layout from parsed layout definition", () => {
    const data: PptxSmartArtData = {
      nodes: makeNodes(["A", "B", "C", "D"]),
    };
    const layoutDef = {
      algorithmType: "snake" as const,
      constraints: { cols: 2 },
      rules: [],
    };
    const shapes = computeSmartArtLayout(data, bounds, layoutDef);
    expect(shapes).toBeDefined();
    expect(shapes!.length).toBe(4);
  });

  it("selects hierarchy layout from parsed layout definition", () => {
    const data: PptxSmartArtData = {
      nodes: makeHierarchyNodes(),
    };
    const layoutDef = {
      algorithmType: "hierChild" as const,
      constraints: {},
      rules: [],
    };
    const shapes = computeSmartArtLayout(data, bounds, layoutDef);
    expect(shapes).toBeDefined();
    expect(shapes!.length).toBe(6);
  });

  it("uses resolvedLayoutType when no layoutDef", () => {
    const data: PptxSmartArtData = {
      resolvedLayoutType: "cycle",
      nodes: makeNodes(["A", "B", "C"]),
    };
    const shapes = computeSmartArtLayout(data, bounds);
    expect(shapes).toBeDefined();
    expect(shapes!.length).toBe(3);
  });

  it("resolves layout from raw layoutType string", () => {
    const data: PptxSmartArtData = {
      layoutType: "basicPyramid",
      nodes: makeNodes(["A", "B", "C"]),
    };
    const shapes = computeSmartArtLayout(data, bounds);
    expect(shapes).toBeDefined();
    expect(shapes!.length).toBe(3);
  });

  it("defaults to linear for unknown layout type", () => {
    const data: PptxSmartArtData = {
      layoutType: "somethingUnknown",
      nodes: makeNodes(["A", "B"]),
    };
    const shapes = computeSmartArtLayout(data, bounds);
    expect(shapes).toBeDefined();
    expect(shapes!.length).toBe(2);
  });

  it("applies constraints from layout definition", () => {
    const data: PptxSmartArtData = {
      nodes: makeNodes(["A", "B"]),
    };
    const layoutDef = {
      algorithmType: "lin" as const,
      constraints: { h: 0.4 } as LayoutConstraints,
      rules: [],
    };
    const shapes = computeSmartArtLayout(data, bounds, layoutDef);
    expect(shapes).toBeDefined();
    expect(shapes![0].height).toBe(Math.round(0.4 * bounds.height));
  });

  it("handles all SmartArt layout types", () => {
    const layoutTypes = [
      "list",
      "process",
      "cycle",
      "hierarchy",
      "relationship",
      "matrix",
      "pyramid",
      "funnel",
      "target",
      "gear",
      "timeline",
      "chevron",
      "bending",
      "venn",
    ];

    for (const lt of layoutTypes) {
      const data: PptxSmartArtData = {
        resolvedLayoutType: lt as any,
        nodes: makeNodes(["A", "B", "C"]),
      };
      const shapes = computeSmartArtLayout(data, bounds);
      expect(shapes).toBeDefined();
      expect(shapes!.length).toBeGreaterThan(0);
    }
  });
});

// ===========================================================================
// parseLayoutDefinition
// ===========================================================================

describe("parseLayoutDefinition", () => {
  it("returns undefined for undefined input", () => {
    expect(parseLayoutDefinition(undefined)).toBeUndefined();
  });

  it("extracts algorithm type from root alg element", () => {
    const xml = {
      "dgm:layoutDef": {
        "@_name": "Snake Layout",
        "dgm:alg": { "@_type": "snake" },
      },
    };
    const result = parseLayoutDefinition(xml);
    expect(result).toBeDefined();
    expect(result!.algorithmType).toBe("snake");
    expect(result!.name).toBe("Snake Layout");
  });

  it("extracts algorithm type from nested layoutNode", () => {
    const xml = {
      "dgm:layoutDef": {
        "dgm:layoutNode": {
          "dgm:alg": { "@_type": "cycle" },
        },
      },
    };
    const result = parseLayoutDefinition(xml);
    expect(result).toBeDefined();
    expect(result!.algorithmType).toBe("cycle");
  });

  it("extracts algorithm from deeply nested layoutNode", () => {
    const xml = {
      "dgm:layoutDef": {
        "dgm:layoutNode": {
          "dgm:alg": { "@_type": "tx" },
          "dgm:layoutNode": {
            "dgm:alg": { "@_type": "lin" },
          },
        },
      },
    };
    const result = parseLayoutDefinition(xml);
    expect(result).toBeDefined();
    // Should prefer the non-text algorithm found in nested nodes
    expect(result!.algorithmType).toBe("lin");
  });

  it("extracts constraints from constrLst", () => {
    const xml = {
      "dgm:layoutDef": {
        "dgm:alg": { "@_type": "lin" },
        "dgm:constrLst": {
          "dgm:constr": [
            { "@_type": "w", "@_val": "0.8" },
            { "@_type": "h", "@_val": "0.5" },
            { "@_type": "sibSp", "@_val": "0.03" },
            { "@_type": "primFontSz", "@_val": "12" },
          ],
        },
      },
    };
    const result = parseLayoutDefinition(xml);
    expect(result).toBeDefined();
    expect(result!.constraints.w).toBe(0.8);
    expect(result!.constraints.h).toBe(0.5);
    expect(result!.constraints.sibSp).toBe(0.03);
    expect(result!.constraints.primFontSz).toBe(12);
  });

  it("extracts constraints from constrLst within layoutNode", () => {
    const xml = {
      "dgm:layoutDef": {
        "dgm:layoutNode": {
          "dgm:alg": { "@_type": "snake" },
          "dgm:constrLst": {
            "dgm:constr": { "@_type": "begPad", "@_val": "0.05" },
          },
        },
      },
    };
    const result = parseLayoutDefinition(xml);
    expect(result).toBeDefined();
    expect(result!.constraints.begPad).toBe(0.05);
  });

  it("extracts rules from ruleLst", () => {
    const xml = {
      "dgm:layoutDef": {
        "dgm:alg": { "@_type": "lin" },
        "dgm:ruleLst": {
          "dgm:rule": [
            { "@_type": "primFontSz", "@_val": "8", "@_fact": "0.5", "@_max": "20" },
            { "@_type": "w", "@_for": "ch", "@_forName": "node" },
          ],
        },
      },
    };
    const result = parseLayoutDefinition(xml);
    expect(result).toBeDefined();
    expect(result!.rules).toHaveLength(2);
    expect(result!.rules[0].type).toBe("primFontSz");
    expect(result!.rules[0].val).toBe(8);
    expect(result!.rules[0].fact).toBe(0.5);
    expect(result!.rules[0].max).toBe(20);
    expect(result!.rules[1].for).toBe("ch");
    expect(result!.rules[1].forName).toBe("node");
  });

  it("extracts direction from algorithm params", () => {
    const xml = {
      "dgm:layoutDef": {
        "dgm:alg": {
          "@_type": "lin",
          "dgm:param": { "@_type": "linDir", "@_val": "fromR" },
        },
      },
    };
    const result = parseLayoutDefinition(xml);
    expect(result).toBeDefined();
    expect(result!.direction).toBe("rev");
    expect(result!.constraints.dir).toBe("rev");
  });

  it("handles all algorithm types", () => {
    const algTypes = [
      "snake",
      "pyra",
      "hierChild",
      "hierRoot",
      "cycle",
      "lin",
      "sp",
      "tx",
      "composite",
      "conn",
    ];
    for (const algType of algTypes) {
      const xml = {
        "dgm:layoutDef": {
          "dgm:alg": { "@_type": algType },
        },
      };
      const result = parseLayoutDefinition(xml);
      expect(result).toBeDefined();
      expect(result!.algorithmType).not.toBe("unknown");
    }
  });

  it("returns unknown for unrecognised algorithm type", () => {
    const xml = {
      "dgm:layoutDef": {
        "dgm:alg": { "@_type": "customFoo" },
      },
    };
    const result = parseLayoutDefinition(xml);
    expect(result).toBeDefined();
    expect(result!.algorithmType).toBe("unknown");
  });

  it("handles missing constrLst and ruleLst gracefully", () => {
    const xml = {
      "dgm:layoutDef": {
        "dgm:alg": { "@_type": "lin" },
      },
    };
    const result = parseLayoutDefinition(xml);
    expect(result).toBeDefined();
    expect(result!.constraints).toEqual({});
    expect(result!.rules).toEqual([]);
  });

  it("handles XML with namespace prefixes in keys", () => {
    const xml = {
      "dgm:layoutDef": {
        "@_name": "Process",
        "dgm:alg": { "@_type": "lin" },
        "dgm:constrLst": {
          "dgm:constr": { "@_type": "sp", "@_val": "0.05" },
        },
      },
    };
    const result = parseLayoutDefinition(xml);
    expect(result).toBeDefined();
    expect(result!.constraints.sp).toBe(0.05);
  });

  it("uses uniqueId when name is not available", () => {
    const xml = {
      "dgm:layoutDef": {
        "@_uniqueId": "urn:some-unique-id",
        "dgm:alg": { "@_type": "lin" },
      },
    };
    const result = parseLayoutDefinition(xml);
    expect(result).toBeDefined();
    expect(result!.name).toBe("urn:some-unique-id");
  });

  it("works with custom xmlLookup service", () => {
    const xml = {
      "dgm:layoutDef": {
        "dgm:alg": { "@_type": "pyra" },
      },
    };
    const customLookup = {
      getChildByLocalName(
        obj: Record<string, unknown> | undefined,
        name: string,
      ) {
        if (!obj) return undefined;
        for (const [key, value] of Object.entries(obj)) {
          const localName = key.includes(":") ? key.split(":").pop()! : key;
          if (localName === name && value && typeof value === "object" && !Array.isArray(value)) {
            return value as Record<string, unknown>;
          }
        }
        return undefined;
      },
      getChildrenArrayByLocalName(
        obj: Record<string, unknown> | undefined,
        name: string,
      ) {
        if (!obj) return [];
        for (const [key, value] of Object.entries(obj)) {
          const localName = key.includes(":") ? key.split(":").pop()! : key;
          if (localName === name) {
            if (Array.isArray(value))
              return value.filter(
                (v): v is Record<string, unknown> =>
                  v !== null && typeof v === "object",
              );
            if (value && typeof value === "object")
              return [value as Record<string, unknown>];
          }
        }
        return [];
      },
    };

    const result = parseLayoutDefinition(xml, customLookup);
    expect(result).toBeDefined();
    expect(result!.algorithmType).toBe("pyra");
  });
});

// ===========================================================================
// layoutEngineShapesToDrawingShapes
// ===========================================================================

describe("layoutEngineShapesToDrawingShapes", () => {
  it("converts engine shapes to drawing shapes", () => {
    const nodes = makeNodes(["A", "B"]);
    const engineShapes: LayoutEngineShape[] = [
      { nodeId: "1", x: 10, y: 20, width: 100, height: 50 },
      { nodeId: "2", x: 120, y: 20, width: 100, height: 50 },
    ];
    const drawingShapes = layoutEngineShapesToDrawingShapes(
      engineShapes,
      nodes,
      "process",
    );

    expect(drawingShapes).toHaveLength(2);
    expect(drawingShapes[0].id).toBe("engine-1");
    expect(drawingShapes[0].text).toBe("A");
    expect(drawingShapes[0].shapeType).toBe("roundRect");
    expect(drawingShapes[0].x).toBe(10);
    expect(drawingShapes[0].y).toBe(20);
    expect(drawingShapes[0].width).toBe(100);
    expect(drawingShapes[0].height).toBe(50);

    expect(drawingShapes[1].id).toBe("engine-2");
    expect(drawingShapes[1].text).toBe("B");
  });

  it("uses ellipse shape type for cycle layouts", () => {
    const nodes = makeNodes(["A"]);
    const engineShapes: LayoutEngineShape[] = [
      { nodeId: "1", x: 0, y: 0, width: 50, height: 50 },
    ];
    const drawingShapes = layoutEngineShapesToDrawingShapes(
      engineShapes,
      nodes,
      "cycle",
    );
    expect(drawingShapes[0].shapeType).toBe("ellipse");
  });

  it("uses rect shape type for pyramid layouts", () => {
    const nodes = makeNodes(["A"]);
    const engineShapes: LayoutEngineShape[] = [
      { nodeId: "1", x: 0, y: 0, width: 100, height: 30 },
    ];
    const drawingShapes = layoutEngineShapesToDrawingShapes(
      engineShapes,
      nodes,
      "pyramid",
    );
    expect(drawingShapes[0].shapeType).toBe("rect");
  });

  it("handles missing node text gracefully", () => {
    const engineShapes: LayoutEngineShape[] = [
      { nodeId: "missing", x: 0, y: 0, width: 50, height: 50 },
    ];
    const drawingShapes = layoutEngineShapesToDrawingShapes(
      engineShapes,
      [],
      "list",
    );
    expect(drawingShapes).toHaveLength(1);
    expect(drawingShapes[0].text).toBeUndefined();
  });
});

// ===========================================================================
// Integration: constraint application across algorithms
// ===========================================================================

describe("constraint application", () => {
  it("begPad and endPad affect usable area", () => {
    const nodes = makeNodes(["A", "B"]);
    const noPadShapes = computeLinearLayout(
      nodes,
      { begPad: 0, endPad: 0 },
      bounds,
    );
    const paddedShapes = computeLinearLayout(
      nodes,
      { begPad: 0.1, endPad: 0.1 },
      bounds,
    );

    // With more padding, nodes should be narrower
    expect(paddedShapes[0].width).toBeLessThan(noPadShapes[0].width);
  });

  it("sibSp affects gap between nodes in snake layout", () => {
    const nodes = makeNodes(["A", "B", "C", "D"]);
    const tight = computeSnakeLayout(nodes, { sibSp: 0.01 }, bounds);
    const loose = computeSnakeLayout(nodes, { sibSp: 0.1 }, bounds);

    // With tighter spacing, nodes should be wider
    expect(tight[0].width).toBeGreaterThan(loose[0].width);
  });

  it("secSibSp affects vertical spacing in snake layout", () => {
    const nodes = makeNodes(["A", "B", "C", "D", "E", "F", "G", "H"]);
    const tight = computeSnakeLayout(
      nodes,
      { cols: 4, secSibSp: 0.01 },
      bounds,
    );
    const loose = computeSnakeLayout(
      nodes,
      { cols: 4, secSibSp: 0.15 },
      bounds,
    );

    // With tighter vertical spacing, nodes should be taller
    expect(tight[0].height).toBeGreaterThan(loose[0].height);
  });

  it("explicit width/height constraints override auto-sizing", () => {
    const nodes = makeNodes(["A", "B"]);
    const shapes = computeSnakeLayout(
      nodes,
      { w: 0.3, h: 0.2 },
      bounds,
    );

    expect(shapes[0].width).toBe(Math.round(0.3 * bounds.width));
    expect(shapes[0].height).toBe(Math.round(0.2 * bounds.height));
  });
});

// ===========================================================================
// Edge cases
// ===========================================================================

describe("edge cases", () => {
  it("handles very large node counts", () => {
    const nodes = makeNodes(
      Array.from({ length: 50 }, (_, i) => `Node ${i + 1}`),
    );
    const shapes = computeSnakeLayout(nodes, {}, bounds);
    expect(shapes).toHaveLength(50);

    // All shapes should have positive dimensions
    for (const s of shapes) {
      expect(s.width).toBeGreaterThan(0);
      expect(s.height).toBeGreaterThan(0);
    }
  });

  it("handles very small container bounds", () => {
    const smallBounds: ContainerBounds = { x: 0, y: 0, width: 20, height: 20 };
    const nodes = makeNodes(["A", "B"]);
    const shapes = computeLinearLayout(nodes, {}, smallBounds);
    expect(shapes).toHaveLength(2);
  });

  it("handles non-zero container origin", () => {
    const offsetBounds: ContainerBounds = {
      x: 100,
      y: 200,
      width: 400,
      height: 300,
    };
    const nodes = makeNodes(["A", "B", "C"]);
    const shapes = computeLinearLayout(nodes, {}, offsetBounds);
    expect(shapes).toHaveLength(3);

    // All shapes should be within the offset bounds
    for (const s of shapes) {
      expect(s.x).toBeGreaterThanOrEqual(offsetBounds.x);
      expect(s.y).toBeGreaterThanOrEqual(offsetBounds.y);
    }
  });

  it("nodes with empty text are filtered out", () => {
    const nodes: PptxSmartArtNode[] = [
      { id: "1", text: "A" },
      { id: "2", text: "" },
      { id: "3", text: "C" },
    ];
    const shapes = computeLinearLayout(nodes, {}, bounds);
    expect(shapes).toHaveLength(2);
  });

  it("all algorithms produce integer coordinates", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const algorithms = [
      () => computeSnakeLayout(nodes, {}, bounds),
      () => computeLinearLayout(nodes, {}, bounds),
      () => computeCycleLayout(nodes, {}, bounds),
      () => computePyramidLayout(nodes, {}, bounds),
      () => computeMatrixLayout(nodes, {}, bounds),
    ];

    for (const alg of algorithms) {
      const shapes = alg();
      for (const s of shapes) {
        expect(Number.isInteger(s.x)).toBe(true);
        expect(Number.isInteger(s.y)).toBe(true);
        expect(Number.isInteger(s.width)).toBe(true);
        expect(Number.isInteger(s.height)).toBe(true);
      }
    }
  });
});
