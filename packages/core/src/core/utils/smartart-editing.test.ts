import { describe, it, expect, beforeEach } from "vitest";
import {
  addSmartArtNode,
  addSmartArtNodeAsChild,
  removeSmartArtNode,
  updateSmartArtNodeText,
  reorderSmartArtNode,
  reorderSmartArtNodeToIndex,
  promoteSmartArtNode,
  demoteSmartArtNode,
  resetSmartArtEditCounter,
  reflowSmartArtLayout,
} from "./smartart-editing";
import type { PptxSmartArtData, PptxSmartArtNode } from "../types";
import type { ContainerBounds } from "./smartart-helpers";

// Reset counter before each test for deterministic IDs.
beforeEach(() => {
  resetSmartArtEditCounter();
});

const bounds: ContainerBounds = { x: 0, y: 0, width: 400, height: 300 };

function makeData(
  texts: string[],
  layoutType?: string,
): PptxSmartArtData {
  return {
    resolvedLayoutType: (layoutType as any) ?? "list",
    nodes: texts.map((text, i) => ({
      id: String(i + 1),
      text,
    })),
  };
}

function makeHierarchyData(): PptxSmartArtData {
  return {
    resolvedLayoutType: "hierarchy",
    nodes: [
      { id: "root", text: "CEO" },
      { id: "child-a", text: "VP Marketing", parentId: "root" },
      { id: "child-b", text: "VP Engineering", parentId: "root" },
      { id: "grandchild", text: "Dev Lead", parentId: "child-b" },
    ],
    connections: [
      { sourceId: "root", destId: "child-a", type: "parOf", srcOrd: 0 },
      { sourceId: "root", destId: "child-b", type: "parOf", srcOrd: 1 },
      { sourceId: "child-b", destId: "grandchild", type: "parOf", srcOrd: 0 },
    ],
  };
}

// ===========================================================================
// addSmartArtNode (after sibling)
// ===========================================================================

describe("addSmartArtNode", () => {
  it("appends a new node at the end when no afterNodeId given", () => {
    const data = makeData(["A", "B"]);
    const result = addSmartArtNode(data, "C");
    expect(result.nodes).toHaveLength(3);
    expect(result.nodes[2].text).toBe("C");
  });

  it("inserts after the specified sibling", () => {
    const data = makeData(["A", "B", "C"]);
    const result = addSmartArtNode(data, "New", "1");
    expect(result.nodes).toHaveLength(4);
    expect(result.nodes[1].text).toBe("New");
  });

  it("inherits parentId from sibling", () => {
    const data: PptxSmartArtData = {
      nodes: [
        { id: "p", text: "Parent" },
        { id: "c1", text: "Child 1", parentId: "p" },
        { id: "c2", text: "Child 2", parentId: "p" },
      ],
    };
    const result = addSmartArtNode(data, "Child 3", "c1");
    const newNode = result.nodes.find((n) => n.text === "Child 3")!;
    expect(newNode.parentId).toBe("p");
  });

  it("clears drawingShapes to trigger reflow", () => {
    const data: PptxSmartArtData = {
      nodes: [{ id: "1", text: "A" }],
      drawingShapes: [{ id: "ds1", x: 0, y: 0, width: 100, height: 50 }],
    };
    const result = addSmartArtNode(data, "B");
    expect(result.drawingShapes).toBeUndefined();
  });

  it("adds a connection when sibling has a parent", () => {
    const data: PptxSmartArtData = {
      nodes: [
        { id: "p", text: "Parent" },
        { id: "c1", text: "Child", parentId: "p" },
      ],
      connections: [{ sourceId: "p", destId: "c1", type: "parOf" }],
    };
    const result = addSmartArtNode(data, "New Child", "c1");
    expect(result.connections).toBeDefined();
    const newConn = result.connections!.find(
      (c) => c.destId !== "c1" && c.sourceId === "p",
    );
    expect(newConn).toBeDefined();
  });

  it("falls back to appending at the end when afterNodeId is not found", () => {
    const data = makeData(["A"]);
    const result = addSmartArtNode(data, "B", "nonexistent");
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[1].text).toBe("B");
  });
});

// ===========================================================================
// addSmartArtNodeAsChild (by parent)
// ===========================================================================

describe("addSmartArtNodeAsChild", () => {
  it("adds a root-level node when no parentId given", () => {
    const data = makeData(["A"]);
    const result = addSmartArtNodeAsChild(data);
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[1].parentId).toBeUndefined();
  });

  it("adds a child node under the specified parent", () => {
    const data = makeData(["Parent"]);
    const result = addSmartArtNodeAsChild(data, "1", "Child");
    expect(result.nodes).toHaveLength(2);
    const child = result.nodes[1];
    expect(child.text).toBe("Child");
    expect(child.parentId).toBe("1");
  });

  it("generates default text when none provided", () => {
    const data = makeData(["A", "B"]);
    const result = addSmartArtNodeAsChild(data);
    expect(result.nodes[2].text).toBe("Item 3");
  });

  it("clears drawingShapes to trigger reflow", () => {
    const data: PptxSmartArtData = {
      nodes: [{ id: "1", text: "A" }],
      drawingShapes: [{ id: "ds1", x: 0, y: 0, width: 100, height: 50 }],
    };
    const result = addSmartArtNodeAsChild(data);
    expect(result.drawingShapes).toBeUndefined();
  });

  it("creates a parOf connection when adding under a parent", () => {
    const data: PptxSmartArtData = {
      nodes: [{ id: "p", text: "Parent" }],
    };
    const result = addSmartArtNodeAsChild(data, "p", "Child");
    expect(result.connections).toBeDefined();
    expect(result.connections![0].sourceId).toBe("p");
    expect(result.connections![0].type).toBe("parOf");
  });
});

// ===========================================================================
// removeSmartArtNode
// ===========================================================================

describe("removeSmartArtNode", () => {
  it("removes the specified node", () => {
    const data = makeData(["A", "B", "C"]);
    const result = removeSmartArtNode(data, "2");
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes.find((n) => n.id === "2")).toBeUndefined();
  });

  it("re-parents children to the removed node's parent", () => {
    const data = makeHierarchyData();
    // Remove child-b; grandchild should be re-parented to root
    const result = removeSmartArtNode(data, "child-b");
    const grandchild = result.nodes.find((n) => n.id === "grandchild");
    expect(grandchild).toBeDefined();
    expect(grandchild!.parentId).toBe("root");
  });

  it("promotes children to root when removing a root node", () => {
    const data: PptxSmartArtData = {
      nodes: [
        { id: "root", text: "Root" },
        { id: "child", text: "Child", parentId: "root" },
      ],
    };
    const result = removeSmartArtNode(data, "root");
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].parentId).toBeUndefined();
  });

  it("clears drawingShapes to trigger reflow", () => {
    const data: PptxSmartArtData = {
      nodes: [{ id: "1", text: "A" }, { id: "2", text: "B" }],
      drawingShapes: [{ id: "ds1", x: 0, y: 0, width: 100, height: 50 }],
    };
    const result = removeSmartArtNode(data, "2");
    expect(result.drawingShapes).toBeUndefined();
  });

  it("removes connections referencing the deleted node", () => {
    const data = makeHierarchyData();
    const result = removeSmartArtNode(data, "child-a");
    const removedConns = (result.connections ?? []).filter(
      (c) => c.sourceId === "child-a" || c.destId === "child-a",
    );
    expect(removedConns).toHaveLength(0);
  });

  it("adds re-wire connections for re-parented children", () => {
    const data = makeHierarchyData();
    const result = removeSmartArtNode(data, "child-b");
    const rewiredConns = (result.connections ?? []).filter(
      (c) => c.sourceId === "root" && c.destId === "grandchild",
    );
    expect(rewiredConns).toHaveLength(1);
  });

  it("handles removing last node gracefully", () => {
    const data: PptxSmartArtData = {
      nodes: [{ id: "1", text: "Only" }],
    };
    const result = removeSmartArtNode(data, "1");
    expect(result.nodes).toHaveLength(0);
  });
});

// ===========================================================================
// updateSmartArtNodeText
// ===========================================================================

describe("updateSmartArtNodeText", () => {
  it("updates the text of the specified node", () => {
    const data = makeData(["Old Text"]);
    const result = updateSmartArtNodeText(data, "1", "New Text");
    expect(result.nodes[0].text).toBe("New Text");
  });

  it("does not modify other nodes", () => {
    const data = makeData(["A", "B", "C"]);
    const result = updateSmartArtNodeText(data, "2", "Updated");
    expect(result.nodes[0].text).toBe("A");
    expect(result.nodes[1].text).toBe("Updated");
    expect(result.nodes[2].text).toBe("C");
  });

  it("clears drawingShapes to trigger reflow", () => {
    const data: PptxSmartArtData = {
      nodes: [{ id: "1", text: "A" }],
      drawingShapes: [{ id: "ds1", x: 0, y: 0, width: 100, height: 50 }],
    };
    const result = updateSmartArtNodeText(data, "1", "B");
    expect(result.drawingShapes).toBeUndefined();
  });

  it("preserves other data properties", () => {
    const data: PptxSmartArtData = {
      resolvedLayoutType: "process",
      colorScheme: "colorful2",
      style: "moderate",
      nodes: [{ id: "1", text: "A" }],
    };
    const result = updateSmartArtNodeText(data, "1", "B");
    expect(result.resolvedLayoutType).toBe("process");
    expect(result.colorScheme).toBe("colorful2");
    expect(result.style).toBe("moderate");
  });

  it("handles node ID not found gracefully", () => {
    const data = makeData(["A"]);
    const result = updateSmartArtNodeText(data, "nonexistent", "B");
    // Should return updated data with unchanged nodes
    expect(result.nodes[0].text).toBe("A");
  });
});

// ===========================================================================
// reorderSmartArtNode (direction)
// ===========================================================================

describe("reorderSmartArtNode", () => {
  it("moves a node down (direction=1)", () => {
    const data = makeData(["A", "B", "C"]);
    const result = reorderSmartArtNode(data, "1", 1);
    expect(result.nodes[0].text).toBe("B");
    expect(result.nodes[1].text).toBe("A");
  });

  it("moves a node up (direction=-1)", () => {
    const data = makeData(["A", "B", "C"]);
    const result = reorderSmartArtNode(data, "2", -1);
    expect(result.nodes[0].text).toBe("B");
    expect(result.nodes[1].text).toBe("A");
  });

  it("returns data unchanged if moving beyond bounds", () => {
    const data = makeData(["A", "B"]);
    const result = reorderSmartArtNode(data, "1", -1);
    expect(result).toBe(data);
  });

  it("returns data unchanged if node not found", () => {
    const data = makeData(["A"]);
    const result = reorderSmartArtNode(data, "nonexistent", 1);
    expect(result).toBe(data);
  });

  it("only swaps within the same sibling group", () => {
    const data: PptxSmartArtData = {
      nodes: [
        { id: "p", text: "Parent" },
        { id: "c1", text: "Child 1", parentId: "p" },
        { id: "c2", text: "Child 2", parentId: "p" },
      ],
    };
    const result = reorderSmartArtNode(data, "c1", 1);
    // Children should be swapped
    const children = result.nodes.filter((n) => n.parentId === "p");
    expect(children[0].id).toBe("c2");
    expect(children[1].id).toBe("c1");
    // Parent should stay
    expect(result.nodes[0].id).toBe("p");
  });

  it("clears drawingShapes to trigger reflow", () => {
    const data: PptxSmartArtData = {
      nodes: [
        { id: "1", text: "A" },
        { id: "2", text: "B" },
      ],
      drawingShapes: [{ id: "ds1", x: 0, y: 0, width: 100, height: 50 }],
    };
    const result = reorderSmartArtNode(data, "1", 1);
    expect(result.drawingShapes).toBeUndefined();
  });
});

// ===========================================================================
// reorderSmartArtNodeToIndex
// ===========================================================================

describe("reorderSmartArtNodeToIndex", () => {
  it("moves a node to a specific index", () => {
    const data = makeData(["A", "B", "C", "D"]);
    const result = reorderSmartArtNodeToIndex(data, "1", 2);
    expect(result.nodes[0].text).toBe("B");
    expect(result.nodes[1].text).toBe("C");
    expect(result.nodes[2].text).toBe("A");
    expect(result.nodes[3].text).toBe("D");
  });

  it("moves a node to the beginning", () => {
    const data = makeData(["A", "B", "C"]);
    const result = reorderSmartArtNodeToIndex(data, "3", 0);
    expect(result.nodes[0].text).toBe("C");
    expect(result.nodes[1].text).toBe("A");
    expect(result.nodes[2].text).toBe("B");
  });

  it("moves a node to the end", () => {
    const data = makeData(["A", "B", "C"]);
    const result = reorderSmartArtNodeToIndex(data, "1", 2);
    expect(result.nodes[0].text).toBe("B");
    expect(result.nodes[1].text).toBe("C");
    expect(result.nodes[2].text).toBe("A");
  });

  it("clamps index to valid range (too high)", () => {
    const data = makeData(["A", "B", "C"]);
    const result = reorderSmartArtNodeToIndex(data, "1", 99);
    expect(result.nodes[2].text).toBe("A");
  });

  it("clamps index to valid range (negative)", () => {
    const data = makeData(["A", "B", "C"]);
    const result = reorderSmartArtNodeToIndex(data, "3", -5);
    expect(result.nodes[0].text).toBe("C");
  });

  it("returns data unchanged if moving to same position", () => {
    const data = makeData(["A", "B", "C"]);
    const result = reorderSmartArtNodeToIndex(data, "2", 1);
    expect(result).toBe(data);
  });

  it("returns data unchanged if node not found", () => {
    const data = makeData(["A"]);
    const result = reorderSmartArtNodeToIndex(data, "nonexistent", 0);
    expect(result).toBe(data);
  });

  it("only reorders within the same sibling group", () => {
    const data: PptxSmartArtData = {
      nodes: [
        { id: "p", text: "Parent" },
        { id: "c1", text: "Child 1", parentId: "p" },
        { id: "c2", text: "Child 2", parentId: "p" },
        { id: "c3", text: "Child 3", parentId: "p" },
      ],
    };
    const result = reorderSmartArtNodeToIndex(data, "c1", 2);
    const children = result.nodes.filter((n) => n.parentId === "p");
    expect(children[0].id).toBe("c2");
    expect(children[1].id).toBe("c3");
    expect(children[2].id).toBe("c1");
    // Parent unaffected
    expect(result.nodes[0].id).toBe("p");
  });

  it("clears drawingShapes to trigger reflow", () => {
    const data: PptxSmartArtData = {
      nodes: [
        { id: "1", text: "A" },
        { id: "2", text: "B" },
      ],
      drawingShapes: [{ id: "ds1", x: 0, y: 0, width: 100, height: 50 }],
    };
    const result = reorderSmartArtNodeToIndex(data, "1", 1);
    expect(result.drawingShapes).toBeUndefined();
  });
});

// ===========================================================================
// promoteSmartArtNode
// ===========================================================================

describe("promoteSmartArtNode", () => {
  it("promotes a child to its grandparent level", () => {
    const data = makeHierarchyData();
    const result = promoteSmartArtNode(data, "grandchild");
    const promoted = result.nodes.find((n) => n.id === "grandchild")!;
    expect(promoted.parentId).toBe("root");
  });

  it("promotes a top-level child to root", () => {
    const data: PptxSmartArtData = {
      nodes: [
        { id: "root", text: "Root" },
        { id: "child", text: "Child", parentId: "root" },
      ],
    };
    const result = promoteSmartArtNode(data, "child");
    const promoted = result.nodes.find((n) => n.id === "child")!;
    expect(promoted.parentId).toBeUndefined();
  });

  it("returns data unchanged if node is already root", () => {
    const data = makeData(["A"]);
    const result = promoteSmartArtNode(data, "1");
    expect(result).toBe(data);
  });

  it("returns data unchanged if node not found", () => {
    const data = makeData(["A"]);
    const result = promoteSmartArtNode(data, "nonexistent");
    expect(result).toBe(data);
  });
});

// ===========================================================================
// demoteSmartArtNode
// ===========================================================================

describe("demoteSmartArtNode", () => {
  it("demotes a node to be a child of its preceding sibling", () => {
    const data = makeData(["A", "B", "C"]);
    const result = demoteSmartArtNode(data, "2");
    const demoted = result.nodes.find((n) => n.id === "2")!;
    expect(demoted.parentId).toBe("1");
  });

  it("returns data unchanged for the first sibling", () => {
    const data = makeData(["A", "B"]);
    const result = demoteSmartArtNode(data, "1");
    expect(result).toBe(data);
  });

  it("returns data unchanged if node not found", () => {
    const data = makeData(["A"]);
    const result = demoteSmartArtNode(data, "nonexistent");
    expect(result).toBe(data);
  });

  it("adds a parOf connection", () => {
    const data = makeData(["A", "B"]);
    const result = demoteSmartArtNode(data, "2");
    expect(result.connections).toBeDefined();
    const conn = result.connections!.find(
      (c) => c.sourceId === "1" && c.destId === "2",
    );
    expect(conn).toBeDefined();
    expect(conn!.type).toBe("parOf");
  });
});

// ===========================================================================
// reflowSmartArtLayout — List
// ===========================================================================

describe("reflowSmartArtLayout — list", () => {
  it("returns drawing shapes for a list layout", () => {
    const data = makeData(["A", "B", "C"], "list");
    const shapes = reflowSmartArtLayout(data, bounds);
    expect(shapes).toBeDefined();
    expect(shapes).toHaveLength(3);
  });

  it("distributes nodes vertically with equal spacing", () => {
    const data = makeData(["A", "B", "C"], "list");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    // Each shape should be below the previous one
    for (let i = 1; i < shapes.length; i++) {
      expect(shapes[i].y).toBeGreaterThan(shapes[i - 1].y);
    }
  });

  it("assigns correct text to each shape", () => {
    const data = makeData(["Alpha", "Beta"], "list");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes[0].text).toBe("Alpha");
    expect(shapes[1].text).toBe("Beta");
  });

  it("uses the full width of the container", () => {
    const data = makeData(["A"], "list");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    // Width should be close to bounds width minus padding
    expect(shapes[0].width).toBeGreaterThan(bounds.width * 0.8);
  });

  it("returns undefined for empty SmartArt", () => {
    const data: PptxSmartArtData = {
      resolvedLayoutType: "list",
      nodes: [],
    };
    const result = reflowSmartArtLayout(data, bounds);
    expect(result).toBeUndefined();
  });

  it("returns undefined for all-empty-text nodes", () => {
    const data: PptxSmartArtData = {
      resolvedLayoutType: "list",
      nodes: [{ id: "1", text: "" }],
    };
    const result = reflowSmartArtLayout(data, bounds);
    expect(result).toBeUndefined();
  });

  it("handles single node", () => {
    const data = makeData(["Solo"], "list");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes).toHaveLength(1);
    expect(shapes[0].text).toBe("Solo");
  });
});

// ===========================================================================
// reflowSmartArtLayout — Process
// ===========================================================================

describe("reflowSmartArtLayout — process", () => {
  it("distributes nodes horizontally", () => {
    const data = makeData(["A", "B", "C"], "process");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    const nodeShapes = shapes.filter((s) => s.shapeType === "roundRect");
    expect(nodeShapes).toHaveLength(3);
    for (let i = 1; i < nodeShapes.length; i++) {
      expect(nodeShapes[i].x).toBeGreaterThan(nodeShapes[i - 1].x);
    }
  });

  it("includes arrow shapes between nodes", () => {
    const data = makeData(["A", "B", "C"], "process");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    const arrows = shapes.filter((s) => s.shapeType === "rightArrow");
    expect(arrows).toHaveLength(2);
  });

  it("creates no arrows for a single node", () => {
    const data = makeData(["Solo"], "process");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    const arrows = shapes.filter((s) => s.shapeType === "rightArrow");
    expect(arrows).toHaveLength(0);
  });

  it("handles two nodes", () => {
    const data = makeData(["A", "B"], "process");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    const nodeShapes = shapes.filter((s) => s.shapeType === "roundRect");
    const arrows = shapes.filter((s) => s.shapeType === "rightArrow");
    expect(nodeShapes).toHaveLength(2);
    expect(arrows).toHaveLength(1);
  });
});

// ===========================================================================
// reflowSmartArtLayout — Hierarchy
// ===========================================================================

describe("reflowSmartArtLayout — hierarchy", () => {
  it("positions root above children", () => {
    const data = makeHierarchyData();
    data.resolvedLayoutType = "hierarchy";
    const shapes = reflowSmartArtLayout(data, bounds)!;
    const root = shapes.find((s) => s.text === "CEO")!;
    const child = shapes.find((s) => s.text === "VP Marketing")!;
    expect(root.y).toBeLessThan(child.y);
  });

  it("places children side by side horizontally", () => {
    const data = makeHierarchyData();
    data.resolvedLayoutType = "hierarchy";
    const shapes = reflowSmartArtLayout(data, bounds)!;
    const childA = shapes.find((s) => s.text === "VP Marketing")!;
    const childB = shapes.find((s) => s.text === "VP Engineering")!;
    // They should be at the same vertical level
    expect(childA.y).toBe(childB.y);
    // But different horizontal positions
    expect(childA.x).not.toBe(childB.x);
  });

  it("positions grandchildren below children", () => {
    const data = makeHierarchyData();
    data.resolvedLayoutType = "hierarchy";
    const shapes = reflowSmartArtLayout(data, bounds)!;
    const childB = shapes.find((s) => s.text === "VP Engineering")!;
    const grandchild = shapes.find((s) => s.text === "Dev Lead")!;
    expect(grandchild.y).toBeGreaterThan(childB.y);
  });

  it("falls back to list for flat nodes", () => {
    const data: PptxSmartArtData = {
      resolvedLayoutType: "hierarchy",
      nodes: [
        { id: "1", text: "A" },
        { id: "2", text: "B" },
      ],
    };
    const shapes = reflowSmartArtLayout(data, bounds);
    expect(shapes).toBeDefined();
    expect(shapes!.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// reflowSmartArtLayout — Cycle
// ===========================================================================

describe("reflowSmartArtLayout — cycle", () => {
  it("distributes nodes around a circle", () => {
    const data = makeData(["A", "B", "C", "D"], "cycle");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes).toHaveLength(4);
    // All shapes should have different positions
    const positions = shapes.map((s) => `${Math.round(s.x)},${Math.round(s.y)}`);
    const unique = new Set(positions);
    expect(unique.size).toBe(4);
  });

  it("uses ellipse shape type", () => {
    const data = makeData(["A", "B"], "cycle");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes[0].shapeType).toBe("ellipse");
  });

  it("handles single node", () => {
    const data = makeData(["Solo"], "cycle");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes).toHaveLength(1);
  });
});

// ===========================================================================
// reflowSmartArtLayout — Matrix
// ===========================================================================

describe("reflowSmartArtLayout — matrix", () => {
  it("arranges 4 items in a 2x2 grid", () => {
    const data = makeData(["A", "B", "C", "D"], "matrix");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes).toHaveLength(4);
    // Items 0 and 1 should be on the same row (same y)
    expect(shapes[0].y).toBe(shapes[1].y);
    // Items 0 and 2 should be in the same column (same x)
    expect(shapes[0].x).toBe(shapes[2].x);
  });

  it("handles single item", () => {
    const data = makeData(["Solo"], "matrix");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes).toHaveLength(1);
  });

  it("uses roundRect shape type", () => {
    const data = makeData(["A"], "matrix");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes[0].shapeType).toBe("roundRect");
  });
});

// ===========================================================================
// reflowSmartArtLayout — Pyramid
// ===========================================================================

describe("reflowSmartArtLayout — pyramid", () => {
  it("makes bottom band wider than top band", () => {
    const data = makeData(["Top", "Bottom"], "pyramid");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes[1].width).toBeGreaterThan(shapes[0].width);
  });

  it("stacks bands vertically", () => {
    const data = makeData(["A", "B", "C"], "pyramid");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    for (let i = 1; i < shapes.length; i++) {
      expect(shapes[i].y).toBeGreaterThan(shapes[i - 1].y);
    }
  });

  it("centers bands horizontally", () => {
    const data = makeData(["Top", "Bottom"], "pyramid");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    // Top band (narrower) should have a larger x offset (more centered)
    expect(shapes[0].x).toBeGreaterThan(shapes[1].x);
  });

  it("handles single node", () => {
    const data = makeData(["Only"], "pyramid");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes).toHaveLength(1);
  });
});

// ===========================================================================
// reflowSmartArtLayout — Funnel
// ===========================================================================

describe("reflowSmartArtLayout — funnel", () => {
  it("returns correct number of shapes", () => {
    const data = makeData(["Wide", "Medium", "Narrow"], "funnel");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes).toHaveLength(3);
  });

  it("top band is wider than bottom band", () => {
    const data = makeData(["Top", "Bottom"], "funnel");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes[0].width).toBeGreaterThan(shapes[1].width);
  });

  it("stacks bands vertically", () => {
    const data = makeData(["A", "B", "C"], "funnel");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    for (let i = 1; i < shapes.length; i++) {
      expect(shapes[i].y).toBeGreaterThan(shapes[i - 1].y);
    }
  });

  it("centers bands horizontally (narrower bands have larger x)", () => {
    const data = makeData(["A", "B", "C"], "funnel");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    // Last (narrowest) should have greater x than first (widest)
    expect(shapes[2].x).toBeGreaterThan(shapes[0].x);
  });

  it("uses rect shape type", () => {
    const data = makeData(["A"], "funnel");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes[0].shapeType).toBe("rect");
  });

  it("handles single node", () => {
    const data = makeData(["Only"], "funnel");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes).toHaveLength(1);
    expect(shapes[0].text).toBe("Only");
  });
});

// ===========================================================================
// reflowSmartArtLayout — Target
// ===========================================================================

describe("reflowSmartArtLayout — target", () => {
  it("returns correct number of shapes", () => {
    const data = makeData(["Outer", "Middle", "Inner"], "target");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes).toHaveLength(3);
  });

  it("outermost ring (first node) is larger than inner ring (last node)", () => {
    const data = makeData(["Outer", "Inner"], "target");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes[0].width).toBeGreaterThan(shapes[1].width);
    expect(shapes[0].height).toBeGreaterThan(shapes[1].height);
  });

  it("all rings are centered on the same point", () => {
    const data = makeData(["A", "B", "C"], "target");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    // Center of each ring = x + width/2
    const centers = shapes.map((s) => Math.round(s.x + s.width / 2));
    expect(new Set(centers).size).toBe(1);
  });

  it("uses ellipse shape type", () => {
    const data = makeData(["A"], "target");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes[0].shapeType).toBe("ellipse");
  });

  it("handles single node", () => {
    const data = makeData(["Bull"], "target");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes).toHaveLength(1);
  });
});

// ===========================================================================
// reflowSmartArtLayout — Gear
// ===========================================================================

describe("reflowSmartArtLayout — gear", () => {
  it("creates gear shapes for up to 3 nodes", () => {
    const data = makeData(["A", "B", "C"], "gear");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes).toHaveLength(3);
    shapes.forEach((s) => expect(s.shapeType).toBe("ellipse"));
  });

  it("extra nodes beyond 3 are placed as side labels", () => {
    const data = makeData(["A", "B", "C", "D", "E"], "gear");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes).toHaveLength(5);
    // First 3 are gear ellipses
    expect(shapes[0].shapeType).toBe("ellipse");
    expect(shapes[1].shapeType).toBe("ellipse");
    expect(shapes[2].shapeType).toBe("ellipse");
    // Extra are roundRect labels
    expect(shapes[3].shapeType).toBe("roundRect");
    expect(shapes[4].shapeType).toBe("roundRect");
  });

  it("alternates gear vertical positions (even/odd offset)", () => {
    const data = makeData(["A", "B", "C"], "gear");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    // Odd-indexed gear (B) should be offset vertically from even-indexed (A, C)
    const yA = shapes[0].y + shapes[0].height / 2;
    const yB = shapes[1].y + shapes[1].height / 2;
    expect(yB).not.toBe(yA);
  });

  it("handles single node", () => {
    const data = makeData(["Solo"], "gear");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes).toHaveLength(1);
  });
});

// ===========================================================================
// reflowSmartArtLayout — Venn
// ===========================================================================

describe("reflowSmartArtLayout — venn", () => {
  it("creates overlapping circles for 2-4 nodes", () => {
    const data = makeData(["A", "B", "C"], "venn");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes).toHaveLength(3);
    shapes.forEach((s) => expect(s.shapeType).toBe("ellipse"));
  });

  it("circles are equal in size for small sets", () => {
    const data = makeData(["A", "B", "C"], "venn");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    const widths = shapes.map((s) => s.width);
    expect(new Set(widths).size).toBe(1);
  });

  it("uses row layout for 5+ nodes", () => {
    const data = makeData(["A", "B", "C", "D", "E"], "venn");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes).toHaveLength(5);
    // All should be at the same vertical center
    const yPositions = shapes.map((s) => s.y);
    expect(new Set(yPositions).size).toBe(1);
  });

  it("all shapes use ellipse type", () => {
    const data = makeData(["A", "B", "C", "D", "E", "F"], "venn");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    shapes.forEach((s) => expect(s.shapeType).toBe("ellipse"));
  });

  it("handles single node", () => {
    const data = makeData(["Solo"], "venn");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes).toHaveLength(1);
  });
});

// ===========================================================================
// reflowSmartArtLayout — Timeline
// ===========================================================================

describe("reflowSmartArtLayout — timeline", () => {
  it("creates shapes for nodes plus a timeline bar", () => {
    const data = makeData(["Jan", "Feb", "Mar"], "timeline");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    // 3 node shapes + 1 bar shape
    expect(shapes).toHaveLength(4);
  });

  it("includes a timeline bar as first shape", () => {
    const data = makeData(["A", "B"], "timeline");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    const bar = shapes.find((s) => s.id === "reflow-timeline-bar");
    expect(bar).toBeDefined();
    expect(bar!.shapeType).toBe("rect");
  });

  it("alternates nodes above and below the timeline", () => {
    const data = makeData(["A", "B", "C", "D"], "timeline");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    const nodeShapes = shapes.filter((s) => s.id !== "reflow-timeline-bar");
    const midY = bounds.y + bounds.height / 2;
    // Even-indexed nodes (A, C) should be above the midline
    expect(nodeShapes[0].y + nodeShapes[0].height / 2).toBeLessThan(midY);
    // Odd-indexed nodes (B, D) should be below the midline
    expect(nodeShapes[1].y + nodeShapes[1].height / 2).toBeGreaterThan(midY);
  });

  it("distributes nodes along horizontal axis", () => {
    const data = makeData(["A", "B", "C"], "timeline");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    const nodeShapes = shapes.filter((s) => s.id !== "reflow-timeline-bar");
    for (let i = 1; i < nodeShapes.length; i++) {
      expect(nodeShapes[i].x).toBeGreaterThan(nodeShapes[i - 1].x);
    }
  });

  it("handles single node", () => {
    const data = makeData(["Event"], "timeline");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    // 1 bar + 1 node
    expect(shapes).toHaveLength(2);
  });
});

// ===========================================================================
// reflowSmartArtLayout — Relationship
// ===========================================================================

describe("reflowSmartArtLayout — relationship", () => {
  it("positions 2 nodes side by side with an arrow", () => {
    const data = makeData(["A", "B"], "relationship");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    // 2 nodes + 1 arrow
    expect(shapes).toHaveLength(3);
    const arrow = shapes.find((s) => s.shapeType === "leftRightArrow");
    expect(arrow).toBeDefined();
  });

  it("uses circle arrangement for 3+ nodes", () => {
    const data = makeData(["A", "B", "C", "D"], "relationship");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes).toHaveLength(4);
    // All different positions
    const positions = shapes.map((s) => `${Math.round(s.x)},${Math.round(s.y)}`);
    expect(new Set(positions).size).toBe(4);
  });

  it("uses roundRect shape for all nodes", () => {
    const data = makeData(["A", "B", "C"], "relationship");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    shapes.forEach((s) => expect(s.shapeType).toBe("roundRect"));
  });

  it("handles single node", () => {
    const data = makeData(["Solo"], "relationship");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes).toHaveLength(1);
  });
});

// ===========================================================================
// reflowSmartArtLayout — Chevron
// ===========================================================================

describe("reflowSmartArtLayout — chevron", () => {
  it("creates chevron shapes for each node", () => {
    const data = makeData(["A", "B", "C"], "chevron");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes).toHaveLength(3);
    shapes.forEach((s) => expect(s.shapeType).toBe("chevron"));
  });

  it("positions chevrons left to right", () => {
    const data = makeData(["A", "B", "C"], "chevron");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    for (let i = 1; i < shapes.length; i++) {
      expect(shapes[i].x).toBeGreaterThan(shapes[i - 1].x);
    }
  });

  it("all chevrons are at the same vertical position", () => {
    const data = makeData(["A", "B", "C"], "chevron");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    const yPositions = shapes.map((s) => s.y);
    expect(new Set(yPositions).size).toBe(1);
  });

  it("assigns correct text to each chevron", () => {
    const data = makeData(["Step 1", "Step 2", "Step 3"], "chevron");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes[0].text).toBe("Step 1");
    expect(shapes[1].text).toBe("Step 2");
    expect(shapes[2].text).toBe("Step 3");
  });

  it("handles single node", () => {
    const data = makeData(["Only"], "chevron");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes).toHaveLength(1);
  });
});

// ===========================================================================
// reflowSmartArtLayout — Bending / Snake
// ===========================================================================

describe("reflowSmartArtLayout — bending", () => {
  it("creates node shapes plus arrow connectors", () => {
    const data = makeData(["A", "B", "C", "D"], "bending");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    const nodeShapes = shapes.filter((s) => s.shapeType === "roundRect");
    expect(nodeShapes).toHaveLength(4);
  });

  it("includes arrows between consecutive nodes", () => {
    const data = makeData(["A", "B", "C", "D"], "bending");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    const arrows = shapes.filter(
      (s) => s.shapeType === "rightArrow" || s.shapeType === "leftArrow" || s.shapeType === "downArrow",
    );
    // 3 arrows for 4 nodes
    expect(arrows).toHaveLength(3);
  });

  it("reverses direction on odd rows (serpentine pattern)", () => {
    // With 8 nodes and COLS=4, row 0 is L-R, row 1 is R-L
    const texts = Array.from({ length: 8 }, (_, i) => `N${i}`);
    const data = makeData(texts, "bending");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    const nodeShapes = shapes.filter((s) => s.shapeType === "roundRect");

    // Row 0 (first 4): should go left to right
    expect(nodeShapes[0].x).toBeLessThan(nodeShapes[3].x);
    // Row 1 (next 4): should go right to left
    expect(nodeShapes[4].x).toBeGreaterThan(nodeShapes[7].x);
  });

  it("wraps to a new row after COLS items", () => {
    const texts = Array.from({ length: 6 }, (_, i) => `N${i}`);
    const data = makeData(texts, "bending");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    const nodeShapes = shapes.filter((s) => s.shapeType === "roundRect");

    // Node 4 should be on the second row (higher y)
    expect(nodeShapes[4].y).toBeGreaterThan(nodeShapes[0].y);
  });

  it("handles single node without arrows", () => {
    const data = makeData(["Solo"], "bending");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    const nodeShapes = shapes.filter((s) => s.shapeType === "roundRect");
    const arrows = shapes.filter(
      (s) => s.shapeType === "rightArrow" || s.shapeType === "leftArrow" || s.shapeType === "downArrow",
    );
    expect(nodeShapes).toHaveLength(1);
    expect(arrows).toHaveLength(0);
  });

  it("handles large node count (12 nodes = 3 rows)", () => {
    const texts = Array.from({ length: 12 }, (_, i) => `Item ${i}`);
    const data = makeData(texts, "bending");
    const shapes = reflowSmartArtLayout(data, bounds)!;
    const nodeShapes = shapes.filter((s) => s.shapeType === "roundRect");
    expect(nodeShapes).toHaveLength(12);
  });
});

// ===========================================================================
// resolveLayoutCategory — raw string resolution for new types
// ===========================================================================

describe("resolveLayoutCategory via reflowSmartArtLayout", () => {
  it("resolves 'basicFunnel' string to funnel layout", () => {
    const data: PptxSmartArtData = {
      layoutType: "basicFunnel",
      nodes: [{ id: "1", text: "A" }, { id: "2", text: "B" }],
    };
    const shapes = reflowSmartArtLayout(data, bounds)!;
    // Funnel: top wider than bottom
    expect(shapes[0].width).toBeGreaterThan(shapes[1].width);
  });

  it("resolves 'basicTarget' string to target layout", () => {
    const data: PptxSmartArtData = {
      layoutType: "basicTarget",
      nodes: [{ id: "1", text: "A" }, { id: "2", text: "B" }],
    };
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes[0].shapeType).toBe("ellipse");
    expect(shapes[0].width).toBeGreaterThan(shapes[1].width);
  });

  it("resolves 'interlockingGears' string to gear layout", () => {
    const data: PptxSmartArtData = {
      layoutType: "interlockingGears",
      nodes: [{ id: "1", text: "A" }, { id: "2", text: "B" }],
    };
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes[0].shapeType).toBe("ellipse");
  });

  it("resolves 'basicVenn' string to venn layout", () => {
    const data: PptxSmartArtData = {
      layoutType: "basicVenn",
      nodes: [{ id: "1", text: "A" }, { id: "2", text: "B" }, { id: "3", text: "C" }],
    };
    const shapes = reflowSmartArtLayout(data, bounds)!;
    expect(shapes).toHaveLength(3);
    shapes.forEach((s) => expect(s.shapeType).toBe("ellipse"));
  });

  it("resolves 'basicTimeline' string to timeline layout", () => {
    const data: PptxSmartArtData = {
      layoutType: "basicTimeline",
      nodes: [{ id: "1", text: "A" }, { id: "2", text: "B" }],
    };
    const shapes = reflowSmartArtLayout(data, bounds)!;
    const bar = shapes.find((s) => s.id === "reflow-timeline-bar");
    expect(bar).toBeDefined();
  });

  it("resolves 'bendingProcess' string to bending layout", () => {
    const data: PptxSmartArtData = {
      layoutType: "bendingProcess",
      nodes: [{ id: "1", text: "A" }, { id: "2", text: "B" }],
    };
    const shapes = reflowSmartArtLayout(data, bounds)!;
    const nodeShapes = shapes.filter((s) => s.shapeType === "roundRect");
    expect(nodeShapes).toHaveLength(2);
  });

  it("resolves 'snakeProcess' string to bending layout", () => {
    const data: PptxSmartArtData = {
      layoutType: "snakeProcess",
      nodes: [{ id: "1", text: "A" }, { id: "2", text: "B" }],
    };
    const shapes = reflowSmartArtLayout(data, bounds)!;
    const nodeShapes = shapes.filter((s) => s.shapeType === "roundRect");
    expect(nodeShapes).toHaveLength(2);
  });
});

// ===========================================================================
// reflowSmartArtLayout — Unknown / fallback
// ===========================================================================

describe("reflowSmartArtLayout — unknown layout type", () => {
  it("falls back to list layout for truly unknown types", () => {
    const data: PptxSmartArtData = {
      resolvedLayoutType: "unknown",
      nodes: [
        { id: "1", text: "A" },
        { id: "2", text: "B" },
      ],
    };
    const shapes = reflowSmartArtLayout(data, bounds);
    expect(shapes).toBeDefined();
    expect(shapes!.length).toBe(2);
  });

  it("resolves layout from raw layoutType string", () => {
    const data: PptxSmartArtData = {
      layoutType: "basicChevronProcess",
      nodes: [
        { id: "1", text: "A" },
        { id: "2", text: "B" },
      ],
    };
    const shapes = reflowSmartArtLayout(data, bounds);
    expect(shapes).toBeDefined();
    // Chevron layout should produce chevron shapes
    expect(shapes!.length).toBe(2);
  });
});

// ===========================================================================
// Integration: editing + reflow
// ===========================================================================

describe("editing + reflow integration", () => {
  it("add node then reflow produces correct number of shapes", () => {
    const data = makeData(["A", "B"], "list");
    const updated = addSmartArtNode(data, "C");
    const shapes = reflowSmartArtLayout(updated, bounds);
    expect(shapes).toBeDefined();
    expect(shapes).toHaveLength(3);
  });

  it("remove node then reflow produces correct number of shapes", () => {
    const data = makeData(["A", "B", "C"], "process");
    const updated = removeSmartArtNode(data, "2");
    const shapes = reflowSmartArtLayout(updated, bounds);
    expect(shapes).toBeDefined();
    const nodeShapes = shapes!.filter((s) => s.shapeType === "roundRect");
    expect(nodeShapes).toHaveLength(2);
  });

  it("update text then reflow reflects new text", () => {
    const data = makeData(["Old"], "list");
    const updated = updateSmartArtNodeText(data, "1", "New");
    const shapes = reflowSmartArtLayout(updated, bounds);
    expect(shapes).toBeDefined();
    expect(shapes![0].text).toBe("New");
  });

  it("reorder then reflow reflects new order", () => {
    const data = makeData(["A", "B", "C"], "list");
    const updated = reorderSmartArtNodeToIndex(data, "1", 2);
    const shapes = reflowSmartArtLayout(updated, bounds);
    expect(shapes).toBeDefined();
    expect(shapes![0].text).toBe("B");
    expect(shapes![1].text).toBe("C");
    expect(shapes![2].text).toBe("A");
  });

  it("add child to hierarchy then reflow shows new node", () => {
    const data = makeHierarchyData();
    data.resolvedLayoutType = "hierarchy";
    const updated = addSmartArtNodeAsChild(data, "child-a", "New Member");
    const shapes = reflowSmartArtLayout(updated, bounds);
    expect(shapes).toBeDefined();
    const newShape = shapes!.find((s) => s.text === "New Member");
    expect(newShape).toBeDefined();
  });

  it("remove from hierarchy then reflow updates tree", () => {
    const data = makeHierarchyData();
    data.resolvedLayoutType = "hierarchy";
    const before = reflowSmartArtLayout(data, bounds)!;
    const updated = removeSmartArtNode(data, "child-a");
    const after = reflowSmartArtLayout(updated, bounds)!;
    expect(after.length).toBeLessThan(before.length);
  });

  it("switch layout then reflow produces different shape types", () => {
    const data = makeData(["A", "B", "C"], "list");
    const listShapes = reflowSmartArtLayout(data, bounds)!;

    const cycleData: PptxSmartArtData = {
      ...data,
      resolvedLayoutType: "cycle",
    };
    const cycleShapes = reflowSmartArtLayout(cycleData, bounds)!;

    expect(listShapes[0].shapeType).toBe("roundRect");
    expect(cycleShapes[0].shapeType).toBe("ellipse");
  });
});

// ===========================================================================
// Edge cases
// ===========================================================================

describe("edge cases", () => {
  it("empty SmartArt returns undefined from reflow", () => {
    const data: PptxSmartArtData = { nodes: [] };
    expect(reflowSmartArtLayout(data, bounds)).toBeUndefined();
  });

  it("single node SmartArt works for all layout types", () => {
    const layouts = [
      "list", "process", "cycle", "hierarchy", "matrix", "pyramid",
      "funnel", "target", "gear", "venn", "timeline", "relationship",
      "chevron", "bending",
    ];
    for (const layout of layouts) {
      const data = makeData(["Only"], layout);
      const shapes = reflowSmartArtLayout(data, bounds);
      expect(shapes).toBeDefined();
      expect(shapes!.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("removing all nodes leaves empty node list", () => {
    let data = makeData(["A", "B"]);
    data = removeSmartArtNode(data, "1");
    data = removeSmartArtNode(data, "2");
    expect(data.nodes).toHaveLength(0);
    expect(reflowSmartArtLayout(data, bounds)).toBeUndefined();
  });

  it("large number of nodes (20) reflows without errors", () => {
    const texts = Array.from({ length: 20 }, (_, i) => `Node ${i + 1}`);
    const data = makeData(texts, "list");
    const shapes = reflowSmartArtLayout(data, bounds);
    expect(shapes).toBeDefined();
    expect(shapes).toHaveLength(20);
  });

  it("reflow with offset container bounds positions shapes correctly", () => {
    const data = makeData(["A", "B"], "list");
    const offsetBounds: ContainerBounds = { x: 100, y: 50, width: 200, height: 150 };
    const shapes = reflowSmartArtLayout(data, offsetBounds);
    expect(shapes).toBeDefined();
    for (const shape of shapes!) {
      expect(shape.x).toBeGreaterThanOrEqual(offsetBounds.x);
      expect(shape.y).toBeGreaterThanOrEqual(offsetBounds.y);
    }
  });

  it("nodes with empty text are filtered out during reflow", () => {
    const data: PptxSmartArtData = {
      resolvedLayoutType: "list",
      nodes: [
        { id: "1", text: "" },
        { id: "2", text: "Visible" },
        { id: "3", text: "" },
      ],
    };
    const shapes = reflowSmartArtLayout(data, bounds);
    expect(shapes).toBeDefined();
    expect(shapes).toHaveLength(1);
    expect(shapes![0].text).toBe("Visible");
  });
});
