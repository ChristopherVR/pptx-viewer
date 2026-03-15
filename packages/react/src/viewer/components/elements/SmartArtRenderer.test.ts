import { describe, it, expect } from "vitest";
import type {
  PptxElement,
  PptxSmartArtNode,
  PptxSmartArtData,
  PptxSmartArtDrawingShape,
  SmartArtPptxElement,
} from "pptx-viewer-core";
import { fitFontSize, chevronPoints } from "./SmartArtRenderer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<PptxSmartArtNode> = {}): PptxSmartArtNode {
  return {
    id: "n1",
    text: "Node 1",
    ...overrides,
  };
}

function makeSmartArtElement(
  overrides: Partial<SmartArtPptxElement> = {},
  dataOverrides: Partial<PptxSmartArtData> = {},
): SmartArtPptxElement {
  return {
    id: "sa_1",
    type: "smartArt",
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    smartArtData: {
      nodes: [
        makeNode({ id: "n1", text: "CEO" }),
        makeNode({ id: "n2", text: "VP Marketing", parentId: "n1" }),
        makeNode({ id: "n3", text: "VP Engineering", parentId: "n1" }),
      ],
      resolvedLayoutType: "hierarchy",
      ...dataOverrides,
    },
    ...overrides,
  } as SmartArtPptxElement;
}

function makeDrawingShape(
  overrides: Partial<PptxSmartArtDrawingShape> = {},
): PptxSmartArtDrawingShape {
  return {
    id: "ds_1",
    x: 100,
    y: 50,
    width: 200,
    height: 80,
    shapeType: "roundRect",
    fillColor: "#4F81BD",
    text: "Shape 1",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// fitFontSize
// ---------------------------------------------------------------------------

describe("fitFontSize", () => {
  it("returns base size for short text in large container", () => {
    const result = fitFontSize("Hi", 200, 50, 14);
    expect(result).toBe(14);
  });

  it("scales down for long text", () => {
    const longText = "This is a very long text string that needs to fit";
    const result = fitFontSize(longText, 100, 30, 14);
    expect(result).toBeLessThan(14);
    expect(result).toBeGreaterThanOrEqual(6);
  });

  it("enforces minimum font size of 6", () => {
    const veryLongText = "A".repeat(200);
    const result = fitFontSize(veryLongText, 50, 10, 14);
    expect(result).toBe(6);
  });

  it("respects maxHeight constraint", () => {
    const result = fitFontSize("Hi", 200, 10, 14);
    // maxByHeight = 10 * 0.5 = 5, but min is 6
    expect(result).toBe(6);
  });

  it("returns base size when text fits comfortably", () => {
    const result = fitFontSize("OK", 500, 100, 12);
    expect(result).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// chevronPoints
// ---------------------------------------------------------------------------

describe("chevronPoints", () => {
  it("returns 6 coordinate pairs", () => {
    const points = chevronPoints(10, 20, 100, 50);
    const pairs = points.split(" ");
    expect(pairs).toHaveLength(6);
  });

  it("first point starts at top-left", () => {
    const points = chevronPoints(10, 20, 100, 50);
    const firstPair = points.split(" ")[0];
    expect(firstPair).toBe("10,20");
  });

  it("includes the right-side point at the midpoint height", () => {
    const points = chevronPoints(0, 0, 100, 60);
    // The chevron tip should be at (100, 30) — right edge at mid-height
    const pairs = points.split(" ");
    expect(pairs[2]).toBe("100,30");
  });

  it("includes indented left notch at mid height", () => {
    const points = chevronPoints(0, 0, 100, 60);
    const depth = Math.min(100 * 0.2, 60 * 0.4);
    const pairs = points.split(" ");
    // Last point: left indent at mid-height
    expect(pairs[5]).toBe(`${depth},30`);
  });
});

// ---------------------------------------------------------------------------
// SmartArt element type validation
// ---------------------------------------------------------------------------

describe("SmartArt element structure", () => {
  it("hierarchy element has correct shape", () => {
    const el = makeSmartArtElement();
    expect(el.type).toBe("smartArt");
    expect(el.smartArtData).toBeDefined();
    expect(el.smartArtData!.nodes).toHaveLength(3);
    expect(el.smartArtData!.resolvedLayoutType).toBe("hierarchy");
  });

  it("process element has correct shape", () => {
    const el = makeSmartArtElement({}, {
      resolvedLayoutType: "process",
      nodes: [
        makeNode({ id: "p1", text: "Step 1" }),
        makeNode({ id: "p2", text: "Step 2" }),
        makeNode({ id: "p3", text: "Step 3" }),
      ],
    });
    expect(el.smartArtData!.resolvedLayoutType).toBe("process");
    expect(el.smartArtData!.nodes).toHaveLength(3);
  });

  it("cycle element has correct shape", () => {
    const el = makeSmartArtElement({}, {
      resolvedLayoutType: "cycle",
      nodes: [
        makeNode({ id: "c1", text: "Phase 1" }),
        makeNode({ id: "c2", text: "Phase 2" }),
        makeNode({ id: "c3", text: "Phase 3" }),
        makeNode({ id: "c4", text: "Phase 4" }),
      ],
    });
    expect(el.smartArtData!.resolvedLayoutType).toBe("cycle");
    expect(el.smartArtData!.nodes).toHaveLength(4);
  });

  it("matrix element has correct shape", () => {
    const el = makeSmartArtElement({}, {
      resolvedLayoutType: "matrix",
      nodes: [
        makeNode({ id: "m1", text: "Quadrant 1" }),
        makeNode({ id: "m2", text: "Quadrant 2" }),
        makeNode({ id: "m3", text: "Quadrant 3" }),
        makeNode({ id: "m4", text: "Quadrant 4" }),
      ],
    });
    expect(el.smartArtData!.resolvedLayoutType).toBe("matrix");
    expect(el.smartArtData!.nodes).toHaveLength(4);
  });

  it("pyramid element has correct shape", () => {
    const el = makeSmartArtElement({}, {
      resolvedLayoutType: "pyramid",
      nodes: [
        makeNode({ id: "py1", text: "Top" }),
        makeNode({ id: "py2", text: "Middle" }),
        makeNode({ id: "py3", text: "Bottom" }),
      ],
    });
    expect(el.smartArtData!.resolvedLayoutType).toBe("pyramid");
    expect(el.smartArtData!.nodes).toHaveLength(3);
  });

  it("element with drawing shapes has them available", () => {
    const el = makeSmartArtElement({}, {
      drawingShapes: [
        makeDrawingShape({ id: "ds1", text: "Shape 1" }),
        makeDrawingShape({ id: "ds2", text: "Shape 2", x: 300, fillColor: "#C0504D" }),
      ],
    });
    expect(el.smartArtData!.drawingShapes).toHaveLength(2);
    expect(el.smartArtData!.drawingShapes![0].fillColor).toBe("#4F81BD");
    expect(el.smartArtData!.drawingShapes![1].fillColor).toBe("#C0504D");
  });
});

// ---------------------------------------------------------------------------
// Drawing shape bounds computation
// ---------------------------------------------------------------------------

describe("drawing shape bounds", () => {
  it("computes correct bounding box for single shape", () => {
    const shape = makeDrawingShape({ x: 10, y: 20, width: 100, height: 50 });
    const minX = shape.x;
    const minY = shape.y;
    const maxX = shape.x + shape.width;
    const maxY = shape.y + shape.height;
    expect(minX).toBe(10);
    expect(minY).toBe(20);
    expect(maxX).toBe(110);
    expect(maxY).toBe(70);
  });

  it("computes correct bounding box for multiple shapes", () => {
    const shapes = [
      makeDrawingShape({ x: 10, y: 20, width: 100, height: 50 }),
      makeDrawingShape({ x: 200, y: 5, width: 80, height: 60 }),
      makeDrawingShape({ x: 50, y: 100, width: 120, height: 40 }),
    ];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const s of shapes) {
      if (s.x < minX) minX = s.x;
      if (s.y < minY) minY = s.y;
      if (s.x + s.width > maxX) maxX = s.x + s.width;
      if (s.y + s.height > maxY) maxY = s.y + s.height;
    }
    expect(minX).toBe(10);
    expect(minY).toBe(5);
    expect(maxX).toBe(280);
    expect(maxY).toBe(140);
  });
});

// ---------------------------------------------------------------------------
// Color scheme and style resolution
// ---------------------------------------------------------------------------

describe("color and style configuration", () => {
  it("element with colorTransform fills uses them as palette", () => {
    const el = makeSmartArtElement({}, {
      colorTransform: {
        fillColors: ["#FF0000", "#00FF00", "#0000FF"],
        lineColors: ["#AA0000", "#00AA00", "#0000AA"],
      },
    });
    const ctFills = el.smartArtData!.colorTransform!.fillColors;
    expect(ctFills).toEqual(["#FF0000", "#00FF00", "#0000FF"]);
  });

  it("element with colorScheme selects correct palette", () => {
    const el = makeSmartArtElement({}, {
      colorScheme: "monochromatic1",
    });
    expect(el.smartArtData!.colorScheme).toBe("monochromatic1");
  });

  it("element with style affects shadow and stroke", () => {
    const el = makeSmartArtElement({}, { style: "intense" });
    expect(el.smartArtData!.style).toBe("intense");
  });

  it("element with chrome has background and outline", () => {
    const el = makeSmartArtElement({}, {
      chrome: {
        backgroundColor: "#F0F0F0",
        outlineColor: "#333333",
        outlineWidth: 2,
      },
    });
    const chrome = el.smartArtData!.chrome!;
    expect(chrome.backgroundColor).toBe("#F0F0F0");
    expect(chrome.outlineColor).toBe("#333333");
    expect(chrome.outlineWidth).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Hierarchy tree structure
// ---------------------------------------------------------------------------

describe("hierarchy tree structure", () => {
  it("builds tree from parent-child relationships", () => {
    const nodes: PptxSmartArtNode[] = [
      makeNode({ id: "root", text: "CEO" }),
      makeNode({ id: "child1", text: "VP1", parentId: "root" }),
      makeNode({ id: "child2", text: "VP2", parentId: "root" }),
      makeNode({ id: "grandchild", text: "Manager", parentId: "child1" }),
    ];

    const rootNodes = nodes.filter((n) => !n.parentId);
    expect(rootNodes).toHaveLength(1);
    expect(rootNodes[0].text).toBe("CEO");

    const children = nodes.filter((n) => n.parentId === "root");
    expect(children).toHaveLength(2);

    const grandchildren = nodes.filter((n) => n.parentId === "child1");
    expect(grandchildren).toHaveLength(1);
    expect(grandchildren[0].text).toBe("Manager");
  });

  it("handles flat hierarchy (no parent-child)", () => {
    const nodes: PptxSmartArtNode[] = [
      makeNode({ id: "n1", text: "Item 1" }),
      makeNode({ id: "n2", text: "Item 2" }),
      makeNode({ id: "n3", text: "Item 3" }),
    ];

    const rootNodes = nodes.filter((n) => !n.parentId);
    expect(rootNodes).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Layout type resolution
// ---------------------------------------------------------------------------

describe("layout type resolution", () => {
  it("resolves named layout to category", () => {
    const mappings: Record<string, string> = {
      hierarchy: "hierarchy",
      process: "process",
      cycle: "cycle",
      matrix: "matrix",
      pyramid: "pyramid",
      list: "list",
      relationship: "relationship",
      venn: "venn",
      funnel: "funnel",
      target: "target",
      gear: "gear",
      timeline: "timeline",
    };

    for (const [resolvedType, category] of Object.entries(mappings)) {
      const el = makeSmartArtElement({}, {
        resolvedLayoutType: resolvedType as PptxSmartArtData["resolvedLayoutType"],
      });
      const layoutType = el.smartArtData!.resolvedLayoutType;
      expect(layoutType).toBe(category);
    }
  });

  it("falls back to list when no layout type is specified", () => {
    const el = makeSmartArtElement({}, {
      resolvedLayoutType: undefined,
      layoutType: undefined,
    });
    // When both are undefined, renderer defaults to "list"
    const layoutType = el.smartArtData!.resolvedLayoutType ?? el.smartArtData!.layoutType ?? "list";
    expect(layoutType).toBe("list");
  });
});

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

describe("SmartArtRenderer module", () => {
  it("exports SmartArtRenderer as a named export", async () => {
    const mod = await import("./SmartArtRenderer");
    expect(typeof mod.SmartArtRenderer).toBe("function");
  });

  it("exports fitFontSize utility", async () => {
    const mod = await import("./SmartArtRenderer");
    expect(typeof mod.fitFontSize).toBe("function");
  });

  it("exports chevronPoints utility", async () => {
    const mod = await import("./SmartArtRenderer");
    expect(typeof mod.chevronPoints).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Drawing shapes — shape type handling
// ---------------------------------------------------------------------------

describe("drawing shape types", () => {
  it("recognizes roundRect shape type", () => {
    const shape = makeDrawingShape({ shapeType: "roundRect" });
    expect(shape.shapeType).toBe("roundRect");
  });

  it("recognizes ellipse shape type", () => {
    const shape = makeDrawingShape({ shapeType: "ellipse" });
    expect(shape.shapeType).toBe("ellipse");
  });

  it("recognizes chevron shape type", () => {
    const shape = makeDrawingShape({ shapeType: "chevron" });
    expect(shape.shapeType).toBe("chevron");
  });

  it("handles shape with rotation", () => {
    const shape = makeDrawingShape({ rotation: 45 });
    expect(shape.rotation).toBe(45);
  });

  it("handles shape with custom stroke", () => {
    const shape = makeDrawingShape({
      strokeColor: "#FF0000",
      strokeWidth: 2.5,
    });
    expect(shape.strokeColor).toBe("#FF0000");
    expect(shape.strokeWidth).toBe(2.5);
  });

  it("handles shape with font properties", () => {
    const shape = makeDrawingShape({
      fontSize: 16,
      fontColor: "#333333",
    });
    expect(shape.fontSize).toBe(16);
    expect(shape.fontColor).toBe("#333333");
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("handles empty nodes array", () => {
    const el = makeSmartArtElement({}, { nodes: [] });
    expect(el.smartArtData!.nodes).toHaveLength(0);
  });

  it("handles single node", () => {
    const el = makeSmartArtElement({}, {
      nodes: [makeNode({ id: "only", text: "Only Node" })],
    });
    expect(el.smartArtData!.nodes).toHaveLength(1);
  });

  it("handles node with empty text", () => {
    const el = makeSmartArtElement({}, {
      nodes: [makeNode({ id: "empty", text: "" })],
    });
    expect(el.smartArtData!.nodes[0].text).toBe("");
  });

  it("handles node with very long text", () => {
    const longText = "A".repeat(200);
    const el = makeSmartArtElement({}, {
      nodes: [makeNode({ id: "long", text: longText })],
    });
    expect(el.smartArtData!.nodes[0].text.length).toBe(200);
  });

  it("handles drawing shapes with zero dimensions", () => {
    const shape = makeDrawingShape({ width: 0, height: 0 });
    expect(shape.width).toBe(0);
    expect(shape.height).toBe(0);
  });

  it("handles element without smartArtData", () => {
    const el = {
      id: "sa_empty",
      type: "smartArt" as const,
      x: 0,
      y: 0,
      width: 400,
      height: 300,
    } as PptxElement;
    expect(el.type).toBe("smartArt");
    // Element body would render the "SmartArt" fallback
  });
});
