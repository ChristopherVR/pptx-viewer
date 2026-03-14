import { describe, it, expect, vi } from "vitest";
import type {
  PptxElement,
  PptxSlide,
  GroupPptxElement,
} from "pptx-viewer-core";
import type { ElementOperations } from "./useElementOperations";
import type { EditorHistoryResult } from "./useEditorHistory";

// ---------------------------------------------------------------------------
// Pure logic extracted from useGroupAlignLayerHandlers for testing
// ---------------------------------------------------------------------------

/**
 * Compute the bounding box of a set of elements.
 */
function computeBounds(elements: PptxElement[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Compute alignment positions for elements given an alignment type.
 * Mirrors the logic inside handleAlignElements.
 */
function computeAlignedPositions(
  elements: PptxElement[],
  align: string,
): Array<{ id: string; x: number; y: number }> {
  const bounds = elements.map((el) => ({
    id: el.id,
    left: el.x,
    top: el.y,
    right: el.x + el.width,
    bottom: el.y + el.height,
  }));
  const groupLeft = Math.min(...bounds.map((b) => b.left));
  const groupTop = Math.min(...bounds.map((b) => b.top));
  const groupRight = Math.max(...bounds.map((b) => b.right));
  const groupBottom = Math.max(...bounds.map((b) => b.bottom));
  const groupCenterX = (groupLeft + groupRight) / 2;
  const groupCenterY = (groupTop + groupBottom) / 2;

  return elements.map((el) => {
    let newX = el.x,
      newY = el.y;
    switch (align) {
      case "left":
        newX = groupLeft;
        break;
      case "center":
        newX = groupCenterX - el.width / 2;
        break;
      case "right":
        newX = groupRight - el.width;
        break;
      case "top":
        newY = groupTop;
        break;
      case "middle":
        newY = groupCenterY - el.height / 2;
        break;
      case "bottom":
        newY = groupBottom - el.height;
        break;
    }
    return { id: el.id, x: newX, y: newY };
  });
}

/**
 * Compute layer reordering for move-layer operations.
 * Returns the new element order or null if no change.
 */
function computeLayerMove(
  elements: PptxElement[],
  selectedId: string,
  direction: string,
): PptxElement[] | null {
  const idx = elements.findIndex((el) => el.id === selectedId);
  if (idx === -1) return null;
  const newElements = [...elements];
  if (direction === "forward" && idx < elements.length - 1) {
    [newElements[idx], newElements[idx + 1]] = [
      newElements[idx + 1],
      newElements[idx],
    ];
    return newElements;
  } else if (direction === "backward" && idx > 0) {
    [newElements[idx], newElements[idx - 1]] = [
      newElements[idx - 1],
      newElements[idx],
    ];
    return newElements;
  }
  return null;
}

/**
 * Compute layer move-to-edge operations.
 */
function computeLayerMoveToEdge(
  elements: PptxElement[],
  selectedId: string,
  direction: string,
): PptxElement[] | null {
  const idx = elements.findIndex((el) => el.id === selectedId);
  if (idx === -1) return null;
  const el = elements[idx];
  const rest = elements.filter((_, i) => i !== idx);
  return direction === "front" ? [...rest, el] : [el, ...rest];
}

/**
 * Compute the grouped element structure: group bounding box and children
 * with relative positions.
 */
function computeGroup(targets: PptxElement[]): {
  x: number;
  y: number;
  width: number;
  height: number;
  children: Array<{ x: number; y: number; id: string }>;
} {
  const { minX, minY, maxX, maxY } = computeBounds(targets);
  const children = targets.map((el) => ({
    id: el.id,
    x: el.x - minX,
    y: el.y - minY,
  }));
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    children,
  };
}

/**
 * Compute ungrouped elements with absolute positions.
 */
function computeUngroup(
  group: { x: number; y: number; children: PptxElement[] },
): Array<{ id: string; x: number; y: number }> {
  return group.children.map((child) => ({
    id: child.id || "generated",
    x: child.x + group.x,
    y: child.y + group.y,
  }));
}

// ---------------------------------------------------------------------------
// Helper factory
// ---------------------------------------------------------------------------

function makeElement(overrides: Partial<PptxElement> & { id: string }): PptxElement {
  return {
    type: "shape",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    flipHorizontal: false,
    flipVertical: false,
    hidden: false,
    opacity: 1,
    rawXml: {},
    ...overrides,
  } as PptxElement;
}

// ---------------------------------------------------------------------------
// Tests: Alignment
// ---------------------------------------------------------------------------

describe("computeAlignedPositions", () => {
  const el1 = makeElement({ id: "a", x: 10, y: 20, width: 100, height: 50 });
  const el2 = makeElement({ id: "b", x: 200, y: 80, width: 60, height: 40 });
  const el3 = makeElement({ id: "c", x: 50, y: 150, width: 80, height: 30 });

  it("should align elements to left edge", () => {
    const result = computeAlignedPositions([el1, el2, el3], "left");
    // groupLeft = min(10, 200, 50) = 10
    expect(result[0].x).toBe(10);
    expect(result[1].x).toBe(10);
    expect(result[2].x).toBe(10);
  });

  it("should align elements to right edge", () => {
    const result = computeAlignedPositions([el1, el2, el3], "right");
    // groupRight = max(110, 260, 130) = 260
    expect(result[0].x).toBe(260 - 100); // 160
    expect(result[1].x).toBe(260 - 60); // 200
    expect(result[2].x).toBe(260 - 80); // 180
  });

  it("should align elements to top edge", () => {
    const result = computeAlignedPositions([el1, el2, el3], "top");
    // groupTop = min(20, 80, 150) = 20
    expect(result[0].y).toBe(20);
    expect(result[1].y).toBe(20);
    expect(result[2].y).toBe(20);
  });

  it("should align elements to bottom edge", () => {
    const result = computeAlignedPositions([el1, el2, el3], "bottom");
    // groupBottom = max(70, 120, 180) = 180
    expect(result[0].y).toBe(180 - 50); // 130
    expect(result[1].y).toBe(180 - 40); // 140
    expect(result[2].y).toBe(180 - 30); // 150
  });

  it("should center-align elements horizontally", () => {
    const result = computeAlignedPositions([el1, el2, el3], "center");
    // groupLeft=10, groupRight=260, groupCenterX=135
    expect(result[0].x).toBe(135 - 100 / 2); // 85
    expect(result[1].x).toBe(135 - 60 / 2); // 105
    expect(result[2].x).toBe(135 - 80 / 2); // 95
  });

  it("should middle-align elements vertically", () => {
    const result = computeAlignedPositions([el1, el2, el3], "middle");
    // groupTop=20, groupBottom=180, groupCenterY=100
    expect(result[0].y).toBe(100 - 50 / 2); // 75
    expect(result[1].y).toBe(100 - 40 / 2); // 80
    expect(result[2].y).toBe(100 - 30 / 2); // 85
  });

  it("should not change positions for unknown alignment type", () => {
    const result = computeAlignedPositions([el1, el2], "unknown");
    expect(result[0].x).toBe(el1.x);
    expect(result[0].y).toBe(el1.y);
    expect(result[1].x).toBe(el2.x);
    expect(result[1].y).toBe(el2.y);
  });

  it("should handle single element alignment (degenerate case)", () => {
    const el = makeElement({ id: "solo", x: 50, y: 60, width: 100, height: 80 });
    const result = computeAlignedPositions([el], "left");
    expect(result[0].x).toBe(50);
    expect(result[0].y).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// Tests: Layer ordering
// ---------------------------------------------------------------------------

describe("computeLayerMove", () => {
  const elements = [
    makeElement({ id: "a" }),
    makeElement({ id: "b" }),
    makeElement({ id: "c" }),
  ];

  it("should move element forward (swap with next)", () => {
    const result = computeLayerMove(elements, "a", "forward");
    expect(result).not.toBeNull();
    expect(result!.map((e) => e.id)).toEqual(["b", "a", "c"]);
  });

  it("should move element backward (swap with previous)", () => {
    const result = computeLayerMove(elements, "c", "backward");
    expect(result).not.toBeNull();
    expect(result!.map((e) => e.id)).toEqual(["a", "c", "b"]);
  });

  it("should return null if already at front and moving forward", () => {
    const result = computeLayerMove(elements, "c", "forward");
    expect(result).toBeNull();
  });

  it("should return null if already at back and moving backward", () => {
    const result = computeLayerMove(elements, "a", "backward");
    expect(result).toBeNull();
  });

  it("should return null if element not found", () => {
    const result = computeLayerMove(elements, "unknown", "forward");
    expect(result).toBeNull();
  });

  it("should move middle element forward correctly", () => {
    const result = computeLayerMove(elements, "b", "forward");
    expect(result!.map((e) => e.id)).toEqual(["a", "c", "b"]);
  });

  it("should move middle element backward correctly", () => {
    const result = computeLayerMove(elements, "b", "backward");
    expect(result!.map((e) => e.id)).toEqual(["b", "a", "c"]);
  });
});

describe("computeLayerMoveToEdge", () => {
  const elements = [
    makeElement({ id: "a" }),
    makeElement({ id: "b" }),
    makeElement({ id: "c" }),
  ];

  it("should move element to front", () => {
    const result = computeLayerMoveToEdge(elements, "a", "front");
    expect(result!.map((e) => e.id)).toEqual(["b", "c", "a"]);
  });

  it("should move element to back", () => {
    const result = computeLayerMoveToEdge(elements, "c", "back");
    expect(result!.map((e) => e.id)).toEqual(["c", "a", "b"]);
  });

  it("should handle move to front when already at front", () => {
    const result = computeLayerMoveToEdge(elements, "c", "front");
    expect(result!.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("should handle move to back when already at back", () => {
    const result = computeLayerMoveToEdge(elements, "a", "back");
    expect(result!.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("should return null for unknown element", () => {
    const result = computeLayerMoveToEdge(elements, "unknown", "front");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: Grouping
// ---------------------------------------------------------------------------

describe("computeGroup", () => {
  it("should compute bounding box from multiple elements", () => {
    const targets = [
      makeElement({ id: "a", x: 10, y: 20, width: 100, height: 50 }),
      makeElement({ id: "b", x: 200, y: 80, width: 60, height: 40 }),
    ];
    const result = computeGroup(targets);
    expect(result.x).toBe(10);
    expect(result.y).toBe(20);
    expect(result.width).toBe(250); // 260 - 10
    expect(result.height).toBe(100); // 120 - 20
  });

  it("should compute children with relative positions", () => {
    const targets = [
      makeElement({ id: "a", x: 100, y: 200, width: 50, height: 50 }),
      makeElement({ id: "b", x: 150, y: 250, width: 50, height: 50 }),
    ];
    const result = computeGroup(targets);
    expect(result.children[0]).toEqual({ id: "a", x: 0, y: 0 });
    expect(result.children[1]).toEqual({ id: "b", x: 50, y: 50 });
  });

  it("should handle overlapping elements", () => {
    const targets = [
      makeElement({ id: "a", x: 0, y: 0, width: 100, height: 100 }),
      makeElement({ id: "b", x: 50, y: 50, width: 100, height: 100 }),
    ];
    const result = computeGroup(targets);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.width).toBe(150);
    expect(result.height).toBe(150);
  });

  it("should handle elements at the same position", () => {
    const targets = [
      makeElement({ id: "a", x: 10, y: 10, width: 50, height: 50 }),
      makeElement({ id: "b", x: 10, y: 10, width: 50, height: 50 }),
    ];
    const result = computeGroup(targets);
    expect(result.x).toBe(10);
    expect(result.y).toBe(10);
    expect(result.width).toBe(50);
    expect(result.height).toBe(50);
    expect(result.children[0]).toEqual({ id: "a", x: 0, y: 0 });
    expect(result.children[1]).toEqual({ id: "b", x: 0, y: 0 });
  });
});

describe("computeUngroup", () => {
  it("should convert children to absolute positions", () => {
    const group = {
      x: 100,
      y: 200,
      children: [
        makeElement({ id: "child1", x: 0, y: 0, width: 50, height: 50 }),
        makeElement({ id: "child2", x: 50, y: 60, width: 30, height: 30 }),
      ],
    };
    const result = computeUngroup(group);
    expect(result[0]).toEqual({ id: "child1", x: 100, y: 200 });
    expect(result[1]).toEqual({ id: "child2", x: 150, y: 260 });
  });

  it("should handle group at origin", () => {
    const group = {
      x: 0,
      y: 0,
      children: [
        makeElement({ id: "child1", x: 10, y: 20, width: 50, height: 50 }),
      ],
    };
    const result = computeUngroup(group);
    expect(result[0]).toEqual({ id: "child1", x: 10, y: 20 });
  });

  it("should handle empty children", () => {
    const group = { x: 100, y: 200, children: [] as PptxElement[] };
    const result = computeUngroup(group);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: Bounding box
// ---------------------------------------------------------------------------

describe("computeBounds", () => {
  it("should compute tight bounding box of multiple elements", () => {
    const elements = [
      makeElement({ id: "a", x: 10, y: 5, width: 100, height: 50 }),
      makeElement({ id: "b", x: 200, y: 80, width: 60, height: 40 }),
    ];
    const b = computeBounds(elements);
    expect(b.minX).toBe(10);
    expect(b.minY).toBe(5);
    expect(b.maxX).toBe(260);
    expect(b.maxY).toBe(120);
  });

  it("should handle single element", () => {
    const elements = [
      makeElement({ id: "a", x: 50, y: 60, width: 100, height: 200 }),
    ];
    const b = computeBounds(elements);
    expect(b.minX).toBe(50);
    expect(b.minY).toBe(60);
    expect(b.maxX).toBe(150);
    expect(b.maxY).toBe(260);
  });

  it("should handle elements at negative coordinates", () => {
    const elements = [
      makeElement({ id: "a", x: -50, y: -30, width: 100, height: 100 }),
      makeElement({ id: "b", x: 20, y: 10, width: 50, height: 50 }),
    ];
    const b = computeBounds(elements);
    expect(b.minX).toBe(-50);
    expect(b.minY).toBe(-30);
    expect(b.maxX).toBe(70);
    expect(b.maxY).toBe(70);
  });
});
