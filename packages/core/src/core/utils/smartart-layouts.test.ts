import { describe, it, expect, beforeEach } from "vitest";
import {
  layoutList,
  layoutProcess,
  layoutCycle,
  layoutMatrix,
  layoutPyramid,
} from "./smartart-layouts";
import { layoutHierarchy, layoutRelationship } from "./smartart-layouts-tree";
import { resetDecomposeCounter } from "./smartart-helpers";
import {
  switchSmartArtLayout,
  isSwitchableLayoutType,
  SWITCHABLE_LAYOUT_TYPES,
} from "./smartart-layout-switch";
import type { PptxSmartArtNode, PptxSmartArtData } from "../types";
import type { ContainerBounds } from "./smartart-helpers";

// Reset shape counter to keep test IDs deterministic.
beforeEach(() => {
  resetDecomposeCounter();
});

const bounds: ContainerBounds = { x: 0, y: 0, width: 400, height: 300 };

function makeNodes(texts: string[]): PptxSmartArtNode[] {
  return texts.map((text, i) => ({
    id: String(i + 1),
    text,
  }));
}

// ---------------------------------------------------------------------------
// layoutList
// ---------------------------------------------------------------------------

describe("layoutList", () => {
  it("returns empty array for empty nodes", () => {
    expect(layoutList([], bounds)).toEqual([]);
  });

  it("returns empty array when all nodes have empty text", () => {
    const nodes: PptxSmartArtNode[] = [{ id: "1", text: "" }];
    expect(layoutList(nodes, bounds)).toEqual([]);
  });

  it("creates one shape per content node", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const elements = layoutList(nodes, bounds);
    expect(elements).toHaveLength(3);
  });

  it("assigns each shape the correct text", () => {
    const nodes = makeNodes(["Alpha", "Beta"]);
    const elements = layoutList(nodes, bounds);
    expect(elements[0].type).toBe("shape");
    expect((elements[0] as any).text).toBe("Alpha");
    expect((elements[1] as any).text).toBe("Beta");
  });

  it("uses roundRect shape type", () => {
    const nodes = makeNodes(["X"]);
    const elements = layoutList(nodes, bounds);
    expect((elements[0] as any).shapeType).toBe("roundRect");
  });

  it("stacks shapes vertically within bounds", () => {
    const nodes = makeNodes(["A", "B"]);
    const elements = layoutList(nodes, bounds);
    // Second element should be below the first
    expect(elements[1].y).toBeGreaterThan(elements[0].y);
  });

  it("applies theme colours when provided", () => {
    const nodes = makeNodes(["A"]);
    const theme = { accent1: "#FF0000" };
    const elements = layoutList(nodes, bounds, theme);
    expect((elements[0] as any).shapeStyle.fillColor).toBe("#FF0000");
  });

  it("positions shapes within the bounding area", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const elements = layoutList(nodes, bounds);
    for (const el of elements) {
      expect(el.x).toBeGreaterThanOrEqual(bounds.x);
      expect(el.y).toBeGreaterThanOrEqual(bounds.y);
    }
  });
});

// ---------------------------------------------------------------------------
// layoutProcess
// ---------------------------------------------------------------------------

describe("layoutProcess", () => {
  it("returns empty array for empty nodes", () => {
    expect(layoutProcess([], bounds)).toEqual([]);
  });

  it("creates shapes plus arrow connectors between them", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const elements = layoutProcess(nodes, bounds);
    // 3 shapes + 2 connectors = 5 elements
    expect(elements).toHaveLength(5);
    const shapes = elements.filter((e) => e.type === "shape");
    const connectors = elements.filter((e) => e.type === "connector");
    expect(shapes).toHaveLength(3);
    expect(connectors).toHaveLength(2);
  });

  it("creates no connectors for a single node", () => {
    const nodes = makeNodes(["Solo"]);
    const elements = layoutProcess(nodes, bounds);
    expect(elements).toHaveLength(1);
    expect(elements[0].type).toBe("shape");
  });

  it("arranges shapes horizontally (left to right)", () => {
    const nodes = makeNodes(["A", "B"]);
    const elements = layoutProcess(nodes, bounds);
    const shapes = elements.filter((e) => e.type === "shape");
    expect(shapes[1].x).toBeGreaterThan(shapes[0].x);
  });

  it("keeps all shapes within bounds", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const elements = layoutProcess(nodes, bounds);
    for (const el of elements) {
      expect(el.x).toBeGreaterThanOrEqual(bounds.x);
      expect(el.y).toBeGreaterThanOrEqual(bounds.y);
    }
  });
});

// ---------------------------------------------------------------------------
// layoutCycle
// ---------------------------------------------------------------------------

describe("layoutCycle", () => {
  it("returns empty array for empty nodes", () => {
    expect(layoutCycle([], bounds)).toEqual([]);
  });

  it("creates shapes plus connectors for cycle nodes", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const elements = layoutCycle(nodes, bounds);
    const shapes = elements.filter((e) => e.type === "shape");
    const connectors = elements.filter((e) => e.type === "connector");
    expect(shapes).toHaveLength(3);
    // Each node has a connector to the next (including wrap-around)
    expect(connectors).toHaveLength(3);
  });

  it("creates no connectors for a single node", () => {
    const nodes = makeNodes(["Solo"]);
    const elements = layoutCycle(nodes, bounds);
    expect(elements).toHaveLength(1);
    expect(elements[0].type).toBe("shape");
  });

  it("places nodes radially around a center", () => {
    const nodes = makeNodes(["A", "B", "C", "D"]);
    const elements = layoutCycle(nodes, bounds);
    const shapes = elements.filter((e) => e.type === "shape");
    // All shapes should be within the bounding area
    for (const el of shapes) {
      expect(el.x).toBeDefined();
      expect(el.y).toBeDefined();
    }
    // Shapes should not all be at the same position
    const uniqueX = new Set(shapes.map((s) => s.x));
    expect(uniqueX.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// layoutMatrix
// ---------------------------------------------------------------------------

describe("layoutMatrix", () => {
  it("returns empty array for empty nodes", () => {
    expect(layoutMatrix([], bounds)).toEqual([]);
  });

  it("creates one shape per content node in a grid", () => {
    const nodes = makeNodes(["A", "B", "C", "D"]);
    const elements = layoutMatrix(nodes, bounds);
    expect(elements).toHaveLength(4);
  });

  it("arranges 4 items in a 2x2 grid", () => {
    const nodes = makeNodes(["A", "B", "C", "D"]);
    const elements = layoutMatrix(nodes, bounds);
    // Items 0 and 1 should be on the first row (same y)
    expect(elements[0].y).toBe(elements[1].y);
    // Items 0 and 2 should be in the first column (same x)
    expect(elements[0].x).toBe(elements[2].x);
  });

  it("uses roundRect shapes", () => {
    const nodes = makeNodes(["A"]);
    const elements = layoutMatrix(nodes, bounds);
    expect((elements[0] as any).shapeType).toBe("roundRect");
  });
});

// ---------------------------------------------------------------------------
// layoutPyramid
// ---------------------------------------------------------------------------

describe("layoutPyramid", () => {
  it("returns empty array for empty nodes", () => {
    expect(layoutPyramid([], bounds)).toEqual([]);
  });

  it("creates one shape per content node", () => {
    const nodes = makeNodes(["Top", "Middle", "Bottom"]);
    const elements = layoutPyramid(nodes, bounds);
    expect(elements).toHaveLength(3);
  });

  it("makes bottom band wider than top band", () => {
    const nodes = makeNodes(["Top", "Bottom"]);
    const elements = layoutPyramid(nodes, bounds);
    // Bottom item (index 1) should be wider
    expect(elements[1].width).toBeGreaterThan(elements[0].width);
  });

  it("stacks bands vertically", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const elements = layoutPyramid(nodes, bounds);
    for (let i = 1; i < elements.length; i++) {
      expect(elements[i].y).toBeGreaterThan(elements[i - 1].y);
    }
  });

  it("centers bands horizontally", () => {
    const nodes = makeNodes(["A", "B"]);
    const elements = layoutPyramid(nodes, bounds);
    // Top band (narrower) should have a larger x offset
    expect(elements[0].x).toBeGreaterThan(elements[1].x);
  });
});

// ---------------------------------------------------------------------------
// layoutHierarchy
// ---------------------------------------------------------------------------

describe("layoutHierarchy", () => {
  it("returns elements for a flat list (falls back to list)", () => {
    // Nodes without parent-child relationships
    const nodes = makeNodes(["A", "B"]);
    const elements = layoutHierarchy(nodes, bounds);
    expect(elements.length).toBeGreaterThan(0);
  });

  it("renders hierarchical tree with connectors", () => {
    const nodes: PptxSmartArtNode[] = [
      { id: "1", text: "Root" },
      { id: "2", text: "Child A", parentId: "1" },
      { id: "3", text: "Child B", parentId: "1" },
    ];
    const elements = layoutHierarchy(nodes, bounds);
    const shapes = elements.filter((e) => e.type === "shape");
    const connectors = elements.filter((e) => e.type === "connector");
    expect(shapes).toHaveLength(3);
    expect(connectors).toHaveLength(2);
  });

  it("handles empty node list", () => {
    const elements = layoutHierarchy([], bounds);
    expect(elements).toEqual([]);
  });

  it("places parent above children", () => {
    const nodes: PptxSmartArtNode[] = [
      { id: "1", text: "Root" },
      { id: "2", text: "Child", parentId: "1" },
    ];
    const elements = layoutHierarchy(nodes, bounds);
    const shapes = elements.filter((e) => e.type === "shape");
    // Root should have a lower y than child (higher on screen)
    expect(shapes[0].y).toBeLessThan(shapes[1].y);
  });
});

// ---------------------------------------------------------------------------
// layoutRelationship (Venn)
// ---------------------------------------------------------------------------

describe("layoutRelationship", () => {
  it("returns empty array for empty nodes", () => {
    expect(layoutRelationship([], bounds)).toEqual([]);
  });

  it("creates ellipse shapes for Venn layout", () => {
    const nodes = makeNodes(["A", "B"]);
    const elements = layoutRelationship(nodes, bounds);
    expect(elements).toHaveLength(2);
    expect((elements[0] as any).shapeType).toBe("ellipse");
  });

  it("uses overlapping circles for 2-4 items", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const elements = layoutRelationship(nodes, bounds);
    expect(elements).toHaveLength(3);
    // All should be ellipses
    for (const el of elements) {
      expect((el as any).shapeType).toBe("ellipse");
    }
  });

  it("uses horizontal row for 5+ items", () => {
    const nodes = makeNodes(["A", "B", "C", "D", "E"]);
    const elements = layoutRelationship(nodes, bounds);
    expect(elements).toHaveLength(5);
    // Should be arranged horizontally (increasing x)
    const xs = elements.map((e) => e.x);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// switchSmartArtLayout
// ---------------------------------------------------------------------------

describe("switchSmartArtLayout", () => {
  const baseData: PptxSmartArtData = {
    layoutType: "process",
    resolvedLayoutType: "process",
    layout: "basicChevronProcess",
    nodes: [{ id: "1", text: "A" }],
  };

  it("returns same object when layout type is unchanged", () => {
    const result = switchSmartArtLayout(baseData, "process");
    expect(result).toBe(baseData);
  });

  it("changes resolvedLayoutType to the new type", () => {
    const result = switchSmartArtLayout(baseData, "cycle");
    expect(result.resolvedLayoutType).toBe("cycle");
    expect(result.layoutType).toBe("cycle");
  });

  it("clears the named layout preset", () => {
    const result = switchSmartArtLayout(baseData, "hierarchy");
    expect(result.layout).toBeUndefined();
  });

  it("preserves nodes and other data", () => {
    const result = switchSmartArtLayout(baseData, "list");
    expect(result.nodes).toBe(baseData.nodes);
  });
});

// ---------------------------------------------------------------------------
// isSwitchableLayoutType
// ---------------------------------------------------------------------------

describe("isSwitchableLayoutType", () => {
  it("returns true for all SWITCHABLE_LAYOUT_TYPES", () => {
    for (const t of SWITCHABLE_LAYOUT_TYPES) {
      expect(isSwitchableLayoutType(t)).toBe(true);
    }
  });

  it("returns false for unsupported layout types", () => {
    expect(isSwitchableLayoutType("unknown")).toBe(false);
    expect(isSwitchableLayoutType("funnel")).toBe(false);
    expect(isSwitchableLayoutType("gear")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SWITCHABLE_LAYOUT_TYPES
// ---------------------------------------------------------------------------

describe("SWITCHABLE_LAYOUT_TYPES", () => {
  it("contains the expected layout types", () => {
    expect(SWITCHABLE_LAYOUT_TYPES).toContain("process");
    expect(SWITCHABLE_LAYOUT_TYPES).toContain("hierarchy");
    expect(SWITCHABLE_LAYOUT_TYPES).toContain("cycle");
    expect(SWITCHABLE_LAYOUT_TYPES).toContain("matrix");
    expect(SWITCHABLE_LAYOUT_TYPES).toContain("pyramid");
    expect(SWITCHABLE_LAYOUT_TYPES).toContain("list");
  });

  it("has exactly 6 entries", () => {
    expect(SWITCHABLE_LAYOUT_TYPES).toHaveLength(6);
  });
});
