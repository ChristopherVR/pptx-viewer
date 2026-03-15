import { describe, it, expect, beforeEach } from "vitest";
import {
  layoutStepDownProcess,
  layoutAlternatingFlow,
  layoutDescendingProcess,
  layoutPictureAccentList,
  layoutVerticalBlockList,
  layoutGroupedList,
  layoutPyramidList,
  layoutHorizontalPictureList,
  layoutAccentProcess,
  layoutVerticalChevronList,
} from "./smartart-layouts-extra";
import {
  decomposeSmartArt,
  resetDecomposeCounter,
} from "./smartart-decompose";
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
// layoutStepDownProcess
// ---------------------------------------------------------------------------

describe("layoutStepDownProcess", () => {
  it("returns empty array for empty nodes", () => {
    expect(layoutStepDownProcess([], bounds)).toEqual([]);
  });

  it("returns empty array when all nodes have empty text", () => {
    const nodes: PptxSmartArtNode[] = [{ id: "1", text: "" }];
    expect(layoutStepDownProcess(nodes, bounds)).toEqual([]);
  });

  it("creates shapes and connectors for multiple nodes", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const elements = layoutStepDownProcess(nodes, bounds);
    const shapes = elements.filter((e) => e.type === "shape");
    const connectors = elements.filter((e) => e.type === "connector");
    expect(shapes).toHaveLength(3);
    expect(connectors).toHaveLength(2);
  });

  it("creates no connectors for a single node", () => {
    const nodes = makeNodes(["Solo"]);
    const elements = layoutStepDownProcess(nodes, bounds);
    expect(elements).toHaveLength(1);
    expect(elements[0].type).toBe("shape");
  });

  it("positions nodes diagonally (increasing x and y)", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const elements = layoutStepDownProcess(nodes, bounds);
    const shapes = elements.filter((e) => e.type === "shape");
    for (let i = 1; i < shapes.length; i++) {
      expect(shapes[i].x).toBeGreaterThan(shapes[i - 1].x);
      expect(shapes[i].y).toBeGreaterThan(shapes[i - 1].y);
    }
  });

  it("assigns correct text to each shape", () => {
    const nodes = makeNodes(["Alpha", "Beta"]);
    const elements = layoutStepDownProcess(nodes, bounds);
    const shapes = elements.filter((e) => e.type === "shape");
    expect((shapes[0] as any).text).toBe("Alpha");
    expect((shapes[1] as any).text).toBe("Beta");
  });

  it("keeps all shapes within bounds", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const elements = layoutStepDownProcess(nodes, bounds);
    for (const el of elements) {
      expect(el.x).toBeGreaterThanOrEqual(bounds.x);
      expect(el.y).toBeGreaterThanOrEqual(bounds.y);
    }
  });

  it("applies theme colours when provided", () => {
    const nodes = makeNodes(["A"]);
    const theme = { accent1: "#FF0000" };
    const elements = layoutStepDownProcess(nodes, bounds, theme);
    expect((elements[0] as any).shapeStyle.fillColor).toBe("#FF0000");
  });
});

// ---------------------------------------------------------------------------
// layoutAlternatingFlow
// ---------------------------------------------------------------------------

describe("layoutAlternatingFlow", () => {
  it("returns empty array for empty nodes", () => {
    expect(layoutAlternatingFlow([], bounds)).toEqual([]);
  });

  it("returns empty array when all nodes have empty text", () => {
    const nodes: PptxSmartArtNode[] = [{ id: "1", text: "" }];
    expect(layoutAlternatingFlow(nodes, bounds)).toEqual([]);
  });

  it("creates shapes and connectors", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const elements = layoutAlternatingFlow(nodes, bounds);
    const shapes = elements.filter((e) => e.type === "shape");
    const connectors = elements.filter((e) => e.type === "connector");
    expect(shapes).toHaveLength(3);
    // Each node has a connector to the center spine
    expect(connectors).toHaveLength(3);
  });

  it("alternates nodes left and right of center", () => {
    const nodes = makeNodes(["A", "B", "C", "D"]);
    const elements = layoutAlternatingFlow(nodes, bounds);
    const shapes = elements.filter((e) => e.type === "shape");
    const centerX = bounds.x + bounds.width / 2;
    // First node (i=0) should be left of center
    expect(shapes[0].x + shapes[0].width).toBeLessThanOrEqual(centerX + 1);
    // Second node (i=1) should be right of center
    expect(shapes[1].x).toBeGreaterThanOrEqual(centerX - 1);
  });

  it("stacks nodes vertically", () => {
    const nodes = makeNodes(["A", "B"]);
    const elements = layoutAlternatingFlow(nodes, bounds);
    const shapes = elements.filter((e) => e.type === "shape");
    expect(shapes[1].y).toBeGreaterThan(shapes[0].y);
  });
});

// ---------------------------------------------------------------------------
// layoutDescendingProcess
// ---------------------------------------------------------------------------

describe("layoutDescendingProcess", () => {
  it("returns empty array for empty nodes", () => {
    expect(layoutDescendingProcess([], bounds)).toEqual([]);
  });

  it("creates shapes and connectors for multiple nodes", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const elements = layoutDescendingProcess(nodes, bounds);
    const shapes = elements.filter((e) => e.type === "shape");
    const connectors = elements.filter((e) => e.type === "connector");
    expect(shapes).toHaveLength(3);
    expect(connectors).toHaveLength(2);
  });

  it("stacks shapes vertically", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const elements = layoutDescendingProcess(nodes, bounds);
    const shapes = elements.filter((e) => e.type === "shape");
    for (let i = 1; i < shapes.length; i++) {
      expect(shapes[i].y).toBeGreaterThan(shapes[i - 1].y);
    }
  });

  it("makes later items narrower", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const elements = layoutDescendingProcess(nodes, bounds);
    const shapes = elements.filter((e) => e.type === "shape");
    expect(shapes[0].width).toBeGreaterThan(shapes[2].width);
  });

  it("centers shapes horizontally", () => {
    const nodes = makeNodes(["A", "B"]);
    const elements = layoutDescendingProcess(nodes, bounds);
    const shapes = elements.filter((e) => e.type === "shape");
    // First (wider) shape should have smaller x offset
    expect(shapes[0].x).toBeLessThanOrEqual(shapes[1].x);
  });
});

// ---------------------------------------------------------------------------
// layoutPictureAccentList
// ---------------------------------------------------------------------------

describe("layoutPictureAccentList", () => {
  it("returns empty array for empty nodes", () => {
    expect(layoutPictureAccentList([], bounds)).toEqual([]);
  });

  it("creates two elements per node (circle + text box)", () => {
    const nodes = makeNodes(["A", "B"]);
    const elements = layoutPictureAccentList(nodes, bounds);
    // 2 nodes * 2 elements each = 4
    expect(elements).toHaveLength(4);
  });

  it("creates ellipse shapes for accent circles", () => {
    const nodes = makeNodes(["A"]);
    const elements = layoutPictureAccentList(nodes, bounds);
    const ellipses = elements.filter(
      (e) => e.type === "shape" && (e as any).shapeType === "ellipse",
    );
    expect(ellipses).toHaveLength(1);
  });

  it("creates roundRect shapes for text boxes", () => {
    const nodes = makeNodes(["A"]);
    const elements = layoutPictureAccentList(nodes, bounds);
    const rects = elements.filter(
      (e) => e.type === "shape" && (e as any).shapeType === "roundRect",
    );
    expect(rects).toHaveLength(1);
  });

  it("assigns node text to the text box", () => {
    const nodes = makeNodes(["Hello"]);
    const elements = layoutPictureAccentList(nodes, bounds);
    const rects = elements.filter(
      (e) => e.type === "shape" && (e as any).shapeType === "roundRect",
    );
    expect((rects[0] as any).text).toBe("Hello");
  });
});

// ---------------------------------------------------------------------------
// layoutVerticalBlockList
// ---------------------------------------------------------------------------

describe("layoutVerticalBlockList", () => {
  it("returns empty array for empty nodes", () => {
    expect(layoutVerticalBlockList([], bounds)).toEqual([]);
  });

  it("creates two elements per node (header + body)", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const elements = layoutVerticalBlockList(nodes, bounds);
    // 3 nodes * 2 elements each = 6
    expect(elements).toHaveLength(6);
  });

  it("stacks items vertically", () => {
    const nodes = makeNodes(["A", "B"]);
    const elements = layoutVerticalBlockList(nodes, bounds);
    // Elements come in pairs: [header0, body0, header1, body1]
    // header1 should be below header0
    expect(elements[2].y).toBeGreaterThan(elements[0].y);
  });

  it("places header bar to the left of body block", () => {
    const nodes = makeNodes(["A"]);
    const elements = layoutVerticalBlockList(nodes, bounds);
    // First element is header, second is body
    expect(elements[0].x).toBeLessThan(elements[1].x);
  });
});

// ---------------------------------------------------------------------------
// layoutGroupedList
// ---------------------------------------------------------------------------

describe("layoutGroupedList", () => {
  it("returns empty array for empty nodes", () => {
    expect(layoutGroupedList([], bounds)).toEqual([]);
  });

  it("creates groups from nodes", () => {
    const nodes = makeNodes(["A", "B", "C", "D"]);
    const elements = layoutGroupedList(nodes, bounds);
    // 4 nodes in groups of 2 = 2 groups
    // 2 group headers + 4 sub-items = 6 elements
    expect(elements.length).toBeGreaterThan(4);
  });

  it("creates header shapes for each group", () => {
    const nodes = makeNodes(["A", "B", "C", "D"]);
    const elements = layoutGroupedList(nodes, bounds);
    // Check there are shapes with "Group" text
    const headers = elements.filter(
      (e) =>
        e.type === "shape" &&
        typeof (e as any).text === "string" &&
        (e as any).text.startsWith("Group"),
    );
    expect(headers.length).toBeGreaterThanOrEqual(2);
  });

  it("distributes groups horizontally", () => {
    const nodes = makeNodes(["A", "B", "C", "D"]);
    const elements = layoutGroupedList(nodes, bounds);
    // Find group header shapes
    const headers = elements.filter(
      (e) =>
        e.type === "shape" &&
        typeof (e as any).text === "string" &&
        (e as any).text.startsWith("Group"),
    );
    if (headers.length >= 2) {
      expect(headers[1].x).toBeGreaterThan(headers[0].x);
    }
  });
});

// ---------------------------------------------------------------------------
// layoutPyramidList
// ---------------------------------------------------------------------------

describe("layoutPyramidList", () => {
  it("returns empty array for empty nodes", () => {
    expect(layoutPyramidList([], bounds)).toEqual([]);
  });

  it("creates three elements per node (segment + connector + label)", () => {
    const nodes = makeNodes(["A", "B"]);
    const elements = layoutPyramidList(nodes, bounds);
    // 2 nodes * 3 elements each = 6
    expect(elements).toHaveLength(6);
  });

  it("places segments on the left side", () => {
    const nodes = makeNodes(["A"]);
    const elements = layoutPyramidList(nodes, bounds);
    // First element is pyramid segment, should be on left half
    expect(elements[0].x).toBeLessThan(bounds.width / 2);
  });

  it("places labels on the right side", () => {
    const nodes = makeNodes(["A"]);
    const elements = layoutPyramidList(nodes, bounds);
    // Third element is label, should be on right half
    const label = elements[2]; // segment, connector, label
    expect(label.x).toBeGreaterThan(bounds.width * 0.3);
  });

  it("includes connectors between segments and labels", () => {
    const nodes = makeNodes(["A", "B"]);
    const elements = layoutPyramidList(nodes, bounds);
    const connectors = elements.filter((e) => e.type === "connector");
    expect(connectors).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// layoutHorizontalPictureList
// ---------------------------------------------------------------------------

describe("layoutHorizontalPictureList", () => {
  it("returns empty array for empty nodes", () => {
    expect(layoutHorizontalPictureList([], bounds)).toEqual([]);
  });

  it("creates two elements per node (circle + label)", () => {
    const nodes = makeNodes(["A", "B"]);
    const elements = layoutHorizontalPictureList(nodes, bounds);
    // 2 nodes * 2 elements = 4
    expect(elements).toHaveLength(4);
  });

  it("creates ellipse shapes for circles", () => {
    const nodes = makeNodes(["A"]);
    const elements = layoutHorizontalPictureList(nodes, bounds);
    const ellipses = elements.filter(
      (e) => e.type === "shape" && (e as any).shapeType === "ellipse",
    );
    expect(ellipses).toHaveLength(1);
  });

  it("arranges items horizontally", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const elements = layoutHorizontalPictureList(nodes, bounds);
    const ellipses = elements.filter(
      (e) => e.type === "shape" && (e as any).shapeType === "ellipse",
    );
    for (let i = 1; i < ellipses.length; i++) {
      expect(ellipses[i].x).toBeGreaterThan(ellipses[i - 1].x);
    }
  });

  it("places labels below circles", () => {
    const nodes = makeNodes(["A"]);
    const elements = layoutHorizontalPictureList(nodes, bounds);
    const ellipse = elements.find(
      (e) => e.type === "shape" && (e as any).shapeType === "ellipse",
    )!;
    const label = elements.find(
      (e) => e.type === "shape" && (e as any).shapeType === "roundRect",
    )!;
    expect(label.y).toBeGreaterThan(ellipse.y);
  });
});

// ---------------------------------------------------------------------------
// layoutAccentProcess
// ---------------------------------------------------------------------------

describe("layoutAccentProcess", () => {
  it("returns empty array for empty nodes", () => {
    expect(layoutAccentProcess([], bounds)).toEqual([]);
  });

  it("creates accent circles and main boxes and connectors", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const elements = layoutAccentProcess(nodes, bounds);
    const shapes = elements.filter((e) => e.type === "shape");
    const connectors = elements.filter((e) => e.type === "connector");
    // Each node: 1 accent circle + 1 main box = 2 shapes
    // 3 nodes = 6 shapes + 2 connectors = 8 elements
    expect(shapes).toHaveLength(6);
    expect(connectors).toHaveLength(2);
  });

  it("arranges nodes horizontally", () => {
    const nodes = makeNodes(["A", "B"]);
    const elements = layoutAccentProcess(nodes, bounds);
    // Get the main boxes (every other shape starting at index 1)
    const mainBoxes = elements.filter(
      (e) => e.type === "shape" && (e as any).shapeType === "roundRect",
    );
    if (mainBoxes.length >= 2) {
      expect(mainBoxes[1].x).toBeGreaterThan(mainBoxes[0].x);
    }
  });

  it("creates no connectors for a single node", () => {
    const nodes = makeNodes(["Solo"]);
    const elements = layoutAccentProcess(nodes, bounds);
    const connectors = elements.filter((e) => e.type === "connector");
    expect(connectors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// layoutVerticalChevronList
// ---------------------------------------------------------------------------

describe("layoutVerticalChevronList", () => {
  it("returns empty array for empty nodes", () => {
    expect(layoutVerticalChevronList([], bounds)).toEqual([]);
  });

  it("creates one shape per node plus connectors between", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const elements = layoutVerticalChevronList(nodes, bounds);
    const shapes = elements.filter((e) => e.type === "shape");
    const connectors = elements.filter((e) => e.type === "connector");
    expect(shapes).toHaveLength(3);
    expect(connectors).toHaveLength(2);
  });

  it("stacks shapes vertically", () => {
    const nodes = makeNodes(["A", "B", "C"]);
    const elements = layoutVerticalChevronList(nodes, bounds);
    const shapes = elements.filter((e) => e.type === "shape");
    for (let i = 1; i < shapes.length; i++) {
      expect(shapes[i].y).toBeGreaterThan(shapes[i - 1].y);
    }
  });

  it("creates a single shape with no connectors for one node", () => {
    const nodes = makeNodes(["Solo"]);
    const elements = layoutVerticalChevronList(nodes, bounds);
    expect(elements).toHaveLength(1);
    expect(elements[0].type).toBe("shape");
  });

  it("assigns correct text to each shape", () => {
    const nodes = makeNodes(["First", "Second"]);
    const elements = layoutVerticalChevronList(nodes, bounds);
    const shapes = elements.filter((e) => e.type === "shape");
    expect((shapes[0] as any).text).toBe("First");
    expect((shapes[1] as any).text).toBe("Second");
  });
});

// ---------------------------------------------------------------------------
// decomposeSmartArt — named layout dispatch
// ---------------------------------------------------------------------------

describe("decomposeSmartArt — new named layouts", () => {
  it("dispatches stepDownProcess via named layout", () => {
    const data: PptxSmartArtData = {
      layout: "stepDownProcess",
      resolvedLayoutType: "process",
      nodes: makeNodes(["A", "B", "C"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    const shapes = result!.filter((e) => e.type === "shape");
    expect(shapes).toHaveLength(3);
  });

  it("dispatches alternatingFlow via named layout", () => {
    const data: PptxSmartArtData = {
      layout: "alternatingFlow",
      resolvedLayoutType: "process",
      nodes: makeNodes(["A", "B", "C", "D"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    const shapes = result!.filter((e) => e.type === "shape");
    expect(shapes).toHaveLength(4);
  });

  it("dispatches descendingProcess via named layout", () => {
    const data: PptxSmartArtData = {
      layout: "descendingProcess",
      resolvedLayoutType: "process",
      nodes: makeNodes(["A", "B"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    expect(result!.length).toBeGreaterThan(0);
  });

  it("dispatches pictureAccentList via named layout", () => {
    const data: PptxSmartArtData = {
      layout: "pictureAccentList",
      resolvedLayoutType: "list",
      nodes: makeNodes(["A", "B"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    expect(result!.length).toBe(4); // 2 nodes * 2 elements
  });

  it("dispatches verticalBlockList via named layout", () => {
    const data: PptxSmartArtData = {
      layout: "verticalBlockList",
      resolvedLayoutType: "list",
      nodes: makeNodes(["A", "B"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    expect(result!.length).toBe(4); // 2 nodes * 2 elements
  });

  it("dispatches groupedList via named layout", () => {
    const data: PptxSmartArtData = {
      layout: "groupedList",
      resolvedLayoutType: "list",
      nodes: makeNodes(["A", "B", "C", "D"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    expect(result!.length).toBeGreaterThan(4);
  });

  it("dispatches pyramidList via named layout", () => {
    const data: PptxSmartArtData = {
      layout: "pyramidList",
      resolvedLayoutType: "list",
      nodes: makeNodes(["A", "B"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    expect(result!.length).toBe(6); // 2 nodes * 3 elements
  });

  it("dispatches horizontalPictureList via named layout", () => {
    const data: PptxSmartArtData = {
      layout: "horizontalPictureList",
      resolvedLayoutType: "list",
      nodes: makeNodes(["A", "B", "C"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    expect(result!.length).toBe(6); // 3 nodes * 2 elements
  });

  it("dispatches accentProcess via named layout", () => {
    const data: PptxSmartArtData = {
      layout: "accentProcess",
      resolvedLayoutType: "process",
      nodes: makeNodes(["A", "B"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    // 2 nodes: 2 circles + 2 boxes + 1 connector = 5
    expect(result!.length).toBe(5);
  });

  it("dispatches verticalChevronList via named layout", () => {
    const data: PptxSmartArtData = {
      layout: "verticalChevronList",
      resolvedLayoutType: "list",
      nodes: makeNodes(["A", "B", "C"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    // 3 shapes + 2 connectors = 5
    expect(result!.length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// decomposeSmartArt — raw layout type resolution for new types
// ---------------------------------------------------------------------------

describe("decomposeSmartArt — raw layout type resolution for new types", () => {
  it("resolves process for raw layoutType containing 'stepdown'", () => {
    const data: PptxSmartArtData = {
      layoutType: "stepDownProcess",
      nodes: makeNodes(["A", "B"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    expect(result!.length).toBeGreaterThan(0);
  });

  it("resolves process for raw layoutType containing 'descend'", () => {
    const data: PptxSmartArtData = {
      layoutType: "descendingProcess",
      nodes: makeNodes(["A", "B"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    expect(result!.length).toBeGreaterThan(0);
  });

  it("resolves list for raw layoutType containing 'grouped'", () => {
    const data: PptxSmartArtData = {
      layoutType: "groupedList",
      nodes: makeNodes(["A", "B"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    expect(result!.length).toBeGreaterThan(0);
  });

  it("resolves list for raw layoutType containing 'picture'", () => {
    const data: PptxSmartArtData = {
      layoutType: "horizontalPictureList",
      nodes: makeNodes(["A"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    expect(result!.length).toBeGreaterThan(0);
  });

  it("resolves funnel for raw layoutType containing 'funnel'", () => {
    const data: PptxSmartArtData = {
      layoutType: "basicFunnel",
      nodes: makeNodes(["A", "B"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
  });

  it("resolves target for raw layoutType containing 'target'", () => {
    const data: PptxSmartArtData = {
      layoutType: "basicTarget",
      nodes: makeNodes(["A"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
  });

  it("resolves bending for raw layoutType containing 'bending'", () => {
    const data: PptxSmartArtData = {
      layoutType: "bendingProcess",
      nodes: makeNodes(["A", "B"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Improved heuristic fallback
// ---------------------------------------------------------------------------

describe("decomposeSmartArt — improved heuristic", () => {
  it("uses matrix layout for 5-9 unknown nodes", () => {
    const data: PptxSmartArtData = {
      resolvedLayoutType: "unknown",
      nodes: makeNodes(["A", "B", "C", "D", "E", "F"]),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    // 6 items should produce 6 shapes in a matrix grid
    expect(result!.length).toBe(6);
    // Matrix places items in a grid, so check that some x values differ
    const uniqueX = new Set(result!.map((e) => e.x));
    expect(uniqueX.size).toBeGreaterThan(1);
  });

  it("uses process layout for 10+ unknown nodes", () => {
    const texts = Array.from({ length: 10 }, (_, i) => `Item ${i + 1}`);
    const data: PptxSmartArtData = {
      resolvedLayoutType: "unknown",
      nodes: makeNodes(texts),
    };
    const result = decomposeSmartArt(data, bounds);
    expect(result).toBeDefined();
    // Process creates shapes + connectors
    const shapes = result!.filter((e) => e.type === "shape");
    const connectors = result!.filter((e) => e.type === "connector");
    expect(shapes).toHaveLength(10);
    expect(connectors).toHaveLength(9);
  });
});

// ---------------------------------------------------------------------------
// Edge cases for new layouts
// ---------------------------------------------------------------------------

describe("new layouts — edge cases", () => {
  it("handles large number of nodes in stepDownProcess", () => {
    const nodes = makeNodes(
      Array.from({ length: 20 }, (_, i) => `Step ${i + 1}`),
    );
    const elements = layoutStepDownProcess(nodes, bounds);
    const shapes = elements.filter((e) => e.type === "shape");
    expect(shapes).toHaveLength(20);
  });

  it("handles single node in alternatingFlow", () => {
    const nodes = makeNodes(["Solo"]);
    const elements = layoutAlternatingFlow(nodes, bounds);
    const shapes = elements.filter((e) => e.type === "shape");
    expect(shapes).toHaveLength(1);
  });

  it("handles two nodes in groupedList", () => {
    const nodes = makeNodes(["A", "B"]);
    const elements = layoutGroupedList(nodes, bounds);
    expect(elements.length).toBeGreaterThan(0);
  });

  it("handles single node in horizontalPictureList", () => {
    const nodes = makeNodes(["Solo"]);
    const elements = layoutHorizontalPictureList(nodes, bounds);
    expect(elements).toHaveLength(2); // 1 circle + 1 label
  });

  it("handles custom bounds for all new layouts", () => {
    const customBounds: ContainerBounds = {
      x: 50,
      y: 50,
      width: 200,
      height: 150,
    };
    const nodes = makeNodes(["A", "B"]);

    const layouts = [
      layoutStepDownProcess,
      layoutAlternatingFlow,
      layoutDescendingProcess,
      layoutPictureAccentList,
      layoutVerticalBlockList,
      layoutGroupedList,
      layoutPyramidList,
      layoutHorizontalPictureList,
      layoutAccentProcess,
      layoutVerticalChevronList,
    ];

    for (const layout of layouts) {
      const elements = layout(nodes, customBounds);
      expect(elements.length).toBeGreaterThan(0);
      // All elements should have non-negative coordinates
      for (const el of elements) {
        expect(el.x).toBeGreaterThanOrEqual(0);
        expect(el.y).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
