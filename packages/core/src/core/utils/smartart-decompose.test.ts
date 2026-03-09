import { describe, it, expect, beforeEach } from "vitest";
import {
  decomposeSmartArt,
  resetDecomposeCounter,
} from "./smartart-decompose";
import type {
  PptxSmartArtData,
  PptxSmartArtNode,
  PptxSmartArtDrawingShape,
} from "../types";

// Reset the counter before each test for deterministic IDs.
beforeEach(() => {
  resetDecomposeCounter();
});

const bounds = { x: 0, y: 0, width: 400, height: 300 };

function makeNodes(texts: string[]): PptxSmartArtNode[] {
  return texts.map((text, i) => ({
    id: String(i + 1),
    text,
  }));
}

// ---------------------------------------------------------------------------
// decomposeSmartArt — basic
// ---------------------------------------------------------------------------

describe("decomposeSmartArt — basic", () => {
  it("returns undefined for empty node list", () => {
    const data: PptxSmartArtData = { nodes: [] };
    expect(decomposeSmartArt(data, bounds)).toBeUndefined();
  });

  it("returns undefined when nodes is undefined-like", () => {
    const data: PptxSmartArtData = { nodes: [] };
    expect(decomposeSmartArt(data, bounds)).toBeUndefined();
  });

  it("returns elements for a list layout", () => {
    const data: PptxSmartArtData = {
      resolvedLayoutType: "list",
      nodes: makeNodes(["A", "B", "C"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    expect(result!.length).toBe(3);
  });

  it("returns elements for a process layout", () => {
    const data: PptxSmartArtData = {
      resolvedLayoutType: "process",
      nodes: makeNodes(["A", "B"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    // 2 shapes + 1 connector
    expect(result!.length).toBe(3);
  });

  it("returns elements for a cycle layout", () => {
    const data: PptxSmartArtData = {
      resolvedLayoutType: "cycle",
      nodes: makeNodes(["A", "B", "C"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    expect(result!.length).toBeGreaterThan(0);
  });

  it("returns elements for a hierarchy layout", () => {
    const data: PptxSmartArtData = {
      resolvedLayoutType: "hierarchy",
      nodes: [
        { id: "1", text: "Root" },
        { id: "2", text: "Child", parentId: "1" },
      ],
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    const shapes = result!.filter((e) => e.type === "shape");
    const connectors = result!.filter((e) => e.type === "connector");
    expect(shapes.length).toBe(2);
    expect(connectors.length).toBe(1);
  });

  it("returns elements for a matrix layout", () => {
    const data: PptxSmartArtData = {
      resolvedLayoutType: "matrix",
      nodes: makeNodes(["A", "B", "C", "D"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    expect(result!.length).toBe(4);
  });

  it("returns elements for a pyramid layout", () => {
    const data: PptxSmartArtData = {
      resolvedLayoutType: "pyramid",
      nodes: makeNodes(["Top", "Mid", "Bot"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    expect(result!.length).toBe(3);
  });

  it("returns elements for a relationship (Venn) layout", () => {
    const data: PptxSmartArtData = {
      resolvedLayoutType: "relationship",
      nodes: makeNodes(["A", "B"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    expect(result!.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// decomposeSmartArt — drawing shapes (pre-computed)
// ---------------------------------------------------------------------------

describe("decomposeSmartArt — drawing shapes", () => {
  it("prefers drawing shapes over algorithmic layout", () => {
    const drawingShapes: PptxSmartArtDrawingShape[] = [
      { id: "ds1", x: 0, y: 0, width: 100, height: 50, text: "Box A" },
      { id: "ds2", x: 120, y: 0, width: 100, height: 50, text: "Box B" },
    ];
    const data: PptxSmartArtData = {
      resolvedLayoutType: "process",
      nodes: makeNodes(["A", "B"]),
      drawingShapes,
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    expect(result!.length).toBe(2);
    // Text from the drawing shape should be used
    expect((result![0] as any).text).toBe("Box A");
  });

  it("scales drawing shapes to fit container bounds", () => {
    const drawingShapes: PptxSmartArtDrawingShape[] = [
      { id: "ds1", x: 0, y: 0, width: 200, height: 100 },
      { id: "ds2", x: 200, y: 0, width: 200, height: 100 },
    ];
    const data: PptxSmartArtData = {
      nodes: makeNodes(["A", "B"]),
      drawingShapes,
    };
    const smallBounds = { x: 0, y: 0, width: 200, height: 50 };
    const result = decomposeSmartArt(data, smallBounds);
    expect(result).toBeDefined();
    // All elements should fit within the container
    for (const el of result!) {
      expect(el.x).toBeGreaterThanOrEqual(0);
      expect(el.y).toBeGreaterThanOrEqual(0);
    }
  });

  it("uses drawing shape fillColor", () => {
    const drawingShapes: PptxSmartArtDrawingShape[] = [
      { id: "ds1", x: 0, y: 0, width: 100, height: 50, fillColor: "#FF0000" },
    ];
    const data: PptxSmartArtData = {
      nodes: makeNodes(["A"]),
      drawingShapes,
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    expect((result![0] as any).shapeStyle.fillColor).toBe("#FF0000");
  });

  it("applies colorTransform fills when drawing shapes lack fillColor", () => {
    const drawingShapes: PptxSmartArtDrawingShape[] = [
      { id: "ds1", x: 0, y: 0, width: 100, height: 50 },
    ];
    const data: PptxSmartArtData = {
      nodes: makeNodes(["A"]),
      drawingShapes,
      colorTransform: {
        fillColors: ["#AABB00"],
        lineColors: [],
        name: "test",
      },
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    expect((result![0] as any).shapeStyle.fillColor).toBe("#AABB00");
  });

  it("applies quickStyle stroke scale for intense effect", () => {
    const drawingShapes: PptxSmartArtDrawingShape[] = [
      { id: "ds1", x: 0, y: 0, width: 100, height: 50, strokeWidth: 2 },
    ];
    const data: PptxSmartArtData = {
      nodes: makeNodes(["A"]),
      drawingShapes,
      quickStyle: { effectIntensity: "intense" },
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    // Intense effect doubles stroke width: 2 * 2 = 4
    expect((result![0] as any).shapeStyle.strokeWidth).toBe(4);
  });

  it("applies quickStyle stroke scale for subtle effect", () => {
    const drawingShapes: PptxSmartArtDrawingShape[] = [
      { id: "ds1", x: 0, y: 0, width: 100, height: 50, strokeWidth: 2 },
    ];
    const data: PptxSmartArtData = {
      nodes: makeNodes(["A"]),
      drawingShapes,
      quickStyle: { effectIntensity: "subtle" },
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    // Subtle effect halves stroke width: 2 * 0.5 = 1
    expect((result![0] as any).shapeStyle.strokeWidth).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// decomposeSmartArt — heuristic / unknown layout
// ---------------------------------------------------------------------------

describe("decomposeSmartArt — unknown layout heuristic", () => {
  it("uses heuristic for unknown layout type", () => {
    const data: PptxSmartArtData = {
      resolvedLayoutType: "unknown",
      nodes: makeNodes(["A", "B"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    expect(result!.length).toBeGreaterThan(0);
  });

  it("picks hierarchy for nodes with children", () => {
    const data: PptxSmartArtData = {
      resolvedLayoutType: "unknown",
      nodes: [
        { id: "1", text: "Root", children: [{ id: "2", text: "Child" }] },
        { id: "2", text: "Child", parentId: "1" },
      ],
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    // Should produce connectors for a hierarchy layout
    const connectors = result!.filter((e) => e.type === "connector");
    expect(connectors.length).toBeGreaterThan(0);
  });

  it("returns undefined when content nodes are all empty text", () => {
    const data: PptxSmartArtData = {
      resolvedLayoutType: "unknown",
      nodes: [{ id: "1", text: "" }],
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// decomposeSmartArt — layout type resolution from raw string
// ---------------------------------------------------------------------------

describe("decomposeSmartArt — raw layout type resolution", () => {
  it("resolves 'hierarchy' from raw layoutType", () => {
    const data: PptxSmartArtData = {
      layoutType: "hierarchy",
      nodes: [
        { id: "1", text: "Root" },
        { id: "2", text: "Child", parentId: "1" },
      ],
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    // Should have connectors since it's hierarchy
    const connectors = result!.filter((e) => e.type === "connector");
    expect(connectors.length).toBeGreaterThan(0);
  });

  it("resolves 'cycle' from raw layoutType containing 'radial'", () => {
    const data: PptxSmartArtData = {
      layoutType: "basicRadial",
      nodes: makeNodes(["A", "B", "C"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
  });

  it("resolves 'process' from raw layoutType containing 'chevron'", () => {
    const data: PptxSmartArtData = {
      layoutType: "basicChevronProcess",
      nodes: makeNodes(["A", "B"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
  });

  it("resolves 'relationship' from raw layoutType containing 'venn'", () => {
    const data: PptxSmartArtData = {
      layoutType: "basicVenn",
      nodes: makeNodes(["A", "B"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    expect((result![0] as any).shapeType).toBe("ellipse");
  });
});

// ---------------------------------------------------------------------------
// decomposeSmartArt — colour transform integration
// ---------------------------------------------------------------------------

describe("decomposeSmartArt — colour transforms", () => {
  it("overlays colorTransform fills onto theme map", () => {
    const data: PptxSmartArtData = {
      resolvedLayoutType: "list",
      nodes: makeNodes(["A"]),
      colorTransform: {
        fillColors: ["#AABBCC"],
        lineColors: [],
      },
    };
    const theme = { accent1: "#FFFFFF" };
    const result = decomposeSmartArt(data, bounds, theme);
    expect(result).toBeDefined();
    // The colorTransform fill should override the theme accent1
    expect((result![0] as any).shapeStyle.fillColor).toBe("#AABBCC");
  });

  it("passes through theme map when no colorTransform", () => {
    const data: PptxSmartArtData = {
      resolvedLayoutType: "list",
      nodes: makeNodes(["A"]),
    };
    const theme = { accent1: "#FACADE" };
    const result = decomposeSmartArt(data, bounds, theme);
    expect(result).toBeDefined();
    expect((result![0] as any).shapeStyle.fillColor).toBe("#FACADE");
  });
});
