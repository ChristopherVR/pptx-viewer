import { describe, it, expect, beforeEach } from "vitest";
import {
  accentColor,
  lighten,
  DEFAULT_ACCENT_COLORS,
  nextId,
  resetDecomposeCounter,
  makeShapeElement,
  makeConnectorElement,
  buildForest,
  treeWidth,
  treeDepth,
  getContentNodes,
} from "./smartart-helpers";
import type { PptxSmartArtNode } from "../types";

// Reset the shape counter before each test to ensure deterministic IDs.
beforeEach(() => {
  resetDecomposeCounter();
});

// ---------------------------------------------------------------------------
// accentColor
// ---------------------------------------------------------------------------

describe("accentColor", () => {
  it("returns default palette colour when no theme map is provided", () => {
    expect(accentColor(0)).toBe(DEFAULT_ACCENT_COLORS[0]);
    expect(accentColor(1)).toBe(DEFAULT_ACCENT_COLORS[1]);
  });

  it("cycles through the 6-colour palette", () => {
    expect(accentColor(6)).toBe(DEFAULT_ACCENT_COLORS[0]);
    expect(accentColor(7)).toBe(DEFAULT_ACCENT_COLORS[1]);
  });

  it("uses theme map accent keys when provided", () => {
    const theme = { accent1: "#FF0000", accent2: "#00FF00" };
    expect(accentColor(0, theme)).toBe("#FF0000");
    expect(accentColor(1, theme)).toBe("#00FF00");
  });

  it("prepends # to theme colour if missing", () => {
    const theme = { accent1: "AABBCC" };
    expect(accentColor(0, theme)).toBe("#AABBCC");
  });

  it("falls back to default palette if theme key is missing", () => {
    const theme = { accent1: "#FF0000" };
    // index 1 maps to accent2 which is missing → fall back
    expect(accentColor(1, theme)).toBe(DEFAULT_ACCENT_COLORS[1]);
  });
});

// ---------------------------------------------------------------------------
// lighten
// ---------------------------------------------------------------------------

describe("lighten", () => {
  it("returns white for amount = 1", () => {
    expect(lighten("#000000", 1)).toBe("#ffffff");
  });

  it("returns the same colour for amount = 0", () => {
    expect(lighten("#4472C4", 0)).toBe("#4472c4");
  });

  it("lightens a colour by mixing with white", () => {
    const result = lighten("#000000", 0.5);
    // Each channel: 0 + (255 - 0) * 0.5 = 128 (rounded)
    expect(result).toBe("#808080");
  });

  it("handles colours with # prefix", () => {
    const result = lighten("#FF0000", 0.5);
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("handles colours without # prefix", () => {
    const result = lighten("FF0000", 0.5);
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });
});

// ---------------------------------------------------------------------------
// nextId / resetDecomposeCounter
// ---------------------------------------------------------------------------

describe("nextId", () => {
  it("generates sequential IDs with the given prefix", () => {
    expect(nextId("test")).toBe("test-1");
    expect(nextId("test")).toBe("test-2");
    expect(nextId("other")).toBe("other-3");
  });

  it("resets to 0 after resetDecomposeCounter", () => {
    nextId("x");
    resetDecomposeCounter();
    expect(nextId("x")).toBe("x-1");
  });
});

// ---------------------------------------------------------------------------
// makeShapeElement
// ---------------------------------------------------------------------------

describe("makeShapeElement", () => {
  it("creates a shape element with required fields", () => {
    const el = makeShapeElement("id1", 10, 20, 100, 50, "rect", "#FF0000", "Hello");
    expect(el.id).toBe("id1");
    expect(el.type).toBe("shape");
    expect(el.x).toBe(10);
    expect(el.y).toBe(20);
    expect(el.width).toBe(100);
    expect(el.height).toBe(50);
    expect(el.shapeType).toBe("rect");
    expect(el.text).toBe("Hello");
    expect(el.shapeStyle.fillColor).toBe("#FF0000");
  });

  it("rounds positions and sizes to integers", () => {
    const el = makeShapeElement("id", 10.7, 20.3, 100.9, 50.1, "rect", "#000", "");
    expect(el.x).toBe(11);
    expect(el.y).toBe(20);
    expect(el.width).toBe(101);
    expect(el.height).toBe(50);
  });

  it("enforces minimum width and height of 1", () => {
    const el = makeShapeElement("id", 0, 0, 0, 0, "rect", "#000", "");
    expect(el.width).toBe(1);
    expect(el.height).toBe(1);
  });

  it("applies optional overrides", () => {
    const el = makeShapeElement("id", 0, 0, 100, 50, "rect", "#000", "txt", {
      rotation: 45,
      strokeColor: "#CCC",
      strokeWidth: 2,
      fontSize: 14,
      fontColor: "#333",
      textAlign: "left",
      textVAlign: "top",
      cornerRadius: 10000,
    });
    expect(el.rotation).toBe(45);
    expect(el.shapeStyle.strokeColor).toBe("#CCC");
    expect(el.shapeStyle.strokeWidth).toBe(2);
    expect(el.textStyle!.fontSize).toBe(14);
    expect(el.textStyle!.color).toBe("#333");
    expect(el.textStyle!.align).toBe("left");
    expect(el.textStyle!.vAlign).toBe("top");
    expect(el.shapeAdjustments).toEqual({ adj: 10000 });
  });

  it("defaults strokeColor to lightened fill", () => {
    const el = makeShapeElement("id", 0, 0, 100, 50, "rect", "#000000", "");
    // lighten("#000000", 0.2) => #333333
    expect(el.shapeStyle.strokeColor).toBe(lighten("#000000", 0.2));
  });
});

// ---------------------------------------------------------------------------
// makeConnectorElement
// ---------------------------------------------------------------------------

describe("makeConnectorElement", () => {
  it("creates a connector element", () => {
    const el = makeConnectorElement("c1", 0, 0, 100, 50, "#444");
    expect(el.type).toBe("connector");
    expect(el.shapeType).toBe("straightConnector1");
    expect(el.shapeStyle.strokeColor).toBe("#444");
    expect(el.width).toBe(100);
    expect(el.height).toBe(50);
  });

  it("handles reversed coordinates (x2 < x1)", () => {
    const el = makeConnectorElement("c2", 100, 50, 0, 0, "#444");
    expect(el.x).toBe(0);
    expect(el.y).toBe(0);
    expect(el.width).toBe(100);
    expect(el.height).toBe(50);
  });

  it("enforces minimum width/height of 2 for zero-length connectors", () => {
    const el = makeConnectorElement("c3", 50, 50, 50, 50, "#444");
    expect(el.width).toBe(2);
    expect(el.height).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// buildForest
// ---------------------------------------------------------------------------

describe("buildForest", () => {
  it("returns all nodes as roots when none have parents", () => {
    const nodes: PptxSmartArtNode[] = [
      { id: "1", text: "A" },
      { id: "2", text: "B" },
    ];
    const roots = buildForest(nodes);
    expect(roots).toHaveLength(2);
    expect(roots[0].node.id).toBe("1");
    expect(roots[1].node.id).toBe("2");
  });

  it("nests children under their parent", () => {
    const nodes: PptxSmartArtNode[] = [
      { id: "1", text: "Root" },
      { id: "2", text: "Child", parentId: "1" },
    ];
    const roots = buildForest(nodes);
    expect(roots).toHaveLength(1);
    expect(roots[0].children).toHaveLength(1);
    expect(roots[0].children[0].node.text).toBe("Child");
  });

  it("handles multi-level nesting", () => {
    const nodes: PptxSmartArtNode[] = [
      { id: "1", text: "Root" },
      { id: "2", text: "Child", parentId: "1" },
      { id: "3", text: "Grandchild", parentId: "2" },
    ];
    const roots = buildForest(nodes);
    expect(roots).toHaveLength(1);
    expect(roots[0].children[0].children[0].node.text).toBe("Grandchild");
  });

  it("returns empty array for empty input", () => {
    expect(buildForest([])).toEqual([]);
  });

  it("treats nodes with unknown parentId as roots", () => {
    const nodes: PptxSmartArtNode[] = [
      { id: "1", text: "A", parentId: "missing" },
    ];
    const roots = buildForest(nodes);
    expect(roots).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// treeWidth / treeDepth
// ---------------------------------------------------------------------------

describe("treeWidth", () => {
  it("returns 1 for a leaf node", () => {
    const tree = { node: { id: "1", text: "A" } as PptxSmartArtNode, children: [] };
    expect(treeWidth(tree)).toBe(1);
  });

  it("sums leaf widths for a parent node", () => {
    const tree = {
      node: { id: "1", text: "R" } as PptxSmartArtNode,
      children: [
        { node: { id: "2", text: "A" } as PptxSmartArtNode, children: [] },
        { node: { id: "3", text: "B" } as PptxSmartArtNode, children: [] },
      ],
    };
    expect(treeWidth(tree)).toBe(2);
  });
});

describe("treeDepth", () => {
  it("returns 1 for a leaf node", () => {
    const tree = { node: { id: "1", text: "A" } as PptxSmartArtNode, children: [] };
    expect(treeDepth(tree)).toBe(1);
  });

  it("returns correct depth for nested tree", () => {
    const tree = {
      node: { id: "1", text: "R" } as PptxSmartArtNode,
      children: [
        {
          node: { id: "2", text: "C" } as PptxSmartArtNode,
          children: [
            { node: { id: "3", text: "G" } as PptxSmartArtNode, children: [] },
          ],
        },
      ],
    };
    expect(treeDepth(tree)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// getContentNodes
// ---------------------------------------------------------------------------

describe("getContentNodes", () => {
  it("filters out nodes with empty text", () => {
    const nodes: PptxSmartArtNode[] = [
      { id: "1", text: "" },
      { id: "2", text: "Hello" },
      { id: "3", text: "" },
      { id: "4", text: "World" },
    ];
    const result = getContentNodes(nodes);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Hello");
    expect(result[1].text).toBe("World");
  });

  it("returns empty array when all nodes have empty text", () => {
    const nodes: PptxSmartArtNode[] = [
      { id: "1", text: "" },
    ];
    expect(getContentNodes(nodes)).toEqual([]);
  });

  it("returns all nodes when all have text", () => {
    const nodes: PptxSmartArtNode[] = [
      { id: "1", text: "A" },
      { id: "2", text: "B" },
    ];
    expect(getContentNodes(nodes)).toHaveLength(2);
  });
});
