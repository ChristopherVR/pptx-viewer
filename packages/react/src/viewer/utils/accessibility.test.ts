import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PptxElement } from "pptx-viewer-core";
import {
  computeReadingOrder,
  getAriaRole,
  getAriaLabel,
  getAriaRoleDescription,
  prefersReducedMotion,
  getReducedMotionStyles,
} from "./accessibility";

// ---------------------------------------------------------------------------
// Helper: create a minimal PptxElement-like object
// ---------------------------------------------------------------------------

function makeElement(
  overrides: Partial<PptxElement> & { id: string; type: string },
): PptxElement {
  return {
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    ...overrides,
  } as unknown as PptxElement;
}

// ===========================================================================
// computeReadingOrder
// ===========================================================================

describe("computeReadingOrder", () => {
  it("returns an empty map for an empty list", () => {
    expect(computeReadingOrder([])).toEqual(new Map());
  });

  it("assigns 1-based indices in top-to-bottom order", () => {
    const elements = [
      makeElement({ id: "a", type: "text", y: 200, x: 50 }),
      makeElement({ id: "b", type: "text", y: 50, x: 50 }),
      makeElement({ id: "c", type: "text", y: 400, x: 50 }),
    ];
    const order = computeReadingOrder(elements);
    expect(order.get("b")).toBe(1);
    expect(order.get("a")).toBe(2);
    expect(order.get("c")).toBe(3);
  });

  it("sorts left-to-right for elements at the same y", () => {
    const elements = [
      makeElement({ id: "r", type: "shape", y: 100, x: 300 }),
      makeElement({ id: "l", type: "shape", y: 100, x: 50 }),
      makeElement({ id: "m", type: "shape", y: 100, x: 150 }),
    ];
    const order = computeReadingOrder(elements);
    expect(order.get("l")).toBe(1);
    expect(order.get("m")).toBe(2);
    expect(order.get("r")).toBe(3);
  });

  it("groups elements within the tolerance band as the same row", () => {
    const elements = [
      makeElement({ id: "a", type: "text", y: 100, x: 200 }),
      makeElement({ id: "b", type: "text", y: 110, x: 50 }),
    ];
    // Within default 20px tolerance, so sorted by x
    const order = computeReadingOrder(elements, 20);
    expect(order.get("b")).toBe(1);
    expect(order.get("a")).toBe(2);
  });

  it("separates elements outside the tolerance band into different rows", () => {
    const elements = [
      makeElement({ id: "a", type: "text", y: 100, x: 200 }),
      makeElement({ id: "b", type: "text", y: 150, x: 50 }),
    ];
    // 50px apart > 20px tolerance, so sorted by y
    const order = computeReadingOrder(elements, 20);
    expect(order.get("a")).toBe(1);
    expect(order.get("b")).toBe(2);
  });

  it("excludes hidden elements from reading order", () => {
    const elements = [
      makeElement({ id: "visible", type: "text", y: 100, x: 50 }),
      makeElement({ id: "hidden", type: "text", y: 50, x: 50, hidden: true }),
    ];
    const order = computeReadingOrder(elements);
    expect(order.has("hidden")).toBe(false);
    expect(order.get("visible")).toBe(1);
    expect(order.size).toBe(1);
  });

  it("handles a single element", () => {
    const elements = [makeElement({ id: "solo", type: "text", y: 0, x: 0 })];
    const order = computeReadingOrder(elements);
    expect(order.get("solo")).toBe(1);
    expect(order.size).toBe(1);
  });

  it("uses custom tolerance value", () => {
    const elements = [
      makeElement({ id: "a", type: "text", y: 100, x: 300 }),
      makeElement({ id: "b", type: "text", y: 130, x: 50 }),
    ];
    // With tolerance = 50, they are on the same row -> sort by x
    const order50 = computeReadingOrder(elements, 50);
    expect(order50.get("b")).toBe(1);
    expect(order50.get("a")).toBe(2);

    // With tolerance = 10, they are on different rows -> sort by y
    const order10 = computeReadingOrder(elements, 10);
    expect(order10.get("a")).toBe(1);
    expect(order10.get("b")).toBe(2);
  });

  it("produces consistent order for identical positions", () => {
    const elements = [
      makeElement({ id: "x", type: "text", y: 100, x: 100 }),
      makeElement({ id: "y", type: "text", y: 100, x: 100 }),
    ];
    const order = computeReadingOrder(elements);
    // Both get assigned unique indices
    expect(order.size).toBe(2);
    const indices = [...order.values()];
    expect(new Set(indices).size).toBe(2);
  });
});

// ===========================================================================
// getAriaRole
// ===========================================================================

describe("getAriaRole", () => {
  it('returns "img" for image elements', () => {
    expect(getAriaRole(makeElement({ id: "1", type: "image" }))).toBe("img");
  });

  it('returns "img" for picture elements', () => {
    expect(getAriaRole(makeElement({ id: "1", type: "picture" }))).toBe("img");
  });

  it('returns "table" for table elements', () => {
    expect(getAriaRole(makeElement({ id: "1", type: "table" }))).toBe("table");
  });

  it('returns "group" for group elements', () => {
    expect(getAriaRole(makeElement({ id: "1", type: "group" }))).toBe("group");
  });

  it('returns "img" for chart elements', () => {
    expect(getAriaRole(makeElement({ id: "1", type: "chart" }))).toBe("img");
  });

  it('returns "img" for smartArt elements', () => {
    expect(getAriaRole(makeElement({ id: "1", type: "smartArt" }))).toBe("img");
  });

  it('returns "application" for media elements', () => {
    expect(getAriaRole(makeElement({ id: "1", type: "media" }))).toBe(
      "application",
    );
  });

  it('returns "img" for connector elements', () => {
    expect(getAriaRole(makeElement({ id: "1", type: "connector" }))).toBe(
      "img",
    );
  });

  it('returns "img" for ink elements', () => {
    expect(getAriaRole(makeElement({ id: "1", type: "ink" }))).toBe("img");
  });

  it('returns "img" for model3d elements', () => {
    expect(getAriaRole(makeElement({ id: "1", type: "model3d" }))).toBe("img");
  });

  it("returns undefined for text elements", () => {
    expect(
      getAriaRole(makeElement({ id: "1", type: "text" })),
    ).toBeUndefined();
  });

  it('returns "img" for shapes without text', () => {
    expect(
      getAriaRole(
        makeElement({ id: "1", type: "shape", shapeType: "rect" }),
      ),
    ).toBe("img");
  });

  it("returns undefined for shapes with text content", () => {
    expect(
      getAriaRole(
        makeElement({
          id: "1",
          type: "shape",
          text: "Hello",
          shapeType: "rect",
        }),
      ),
    ).toBeUndefined();
  });
});

// ===========================================================================
// getAriaLabel
// ===========================================================================

describe("getAriaLabel", () => {
  it("returns altText for image elements with alt text", () => {
    expect(
      getAriaLabel(
        makeElement({ id: "1", type: "image", altText: "A nice photo" }),
      ),
    ).toBe("A nice photo");
  });

  it("returns altText for picture elements with alt text", () => {
    expect(
      getAriaLabel(
        makeElement({ id: "1", type: "picture", altText: "Logo image" }),
      ),
    ).toBe("Logo image");
  });

  it("returns text content for text elements", () => {
    expect(
      getAriaLabel(makeElement({ id: "1", type: "text", text: "Hello World" })),
    ).toBe("Hello World");
  });

  it("truncates long text content at 120 characters", () => {
    const longText = "A".repeat(200);
    const label = getAriaLabel(
      makeElement({ id: "1", type: "text", text: longText }),
    );
    expect(label.length).toBe(120);
    expect(label.endsWith("...")).toBe(true);
  });

  it("returns text content for shapes with text", () => {
    expect(
      getAriaLabel(
        makeElement({ id: "1", type: "shape", text: "Shape label" }),
      ),
    ).toBe("Shape label");
  });

  it('returns "Chart: <title>" for chart with title', () => {
    expect(
      getAriaLabel(
        makeElement({
          id: "1",
          type: "chart",
          chartData: { title: "Sales Data" },
        }),
      ),
    ).toBe("Chart: Sales Data");
  });

  it('returns "Chart" for chart without title', () => {
    expect(
      getAriaLabel(
        makeElement({ id: "1", type: "chart", chartData: {} }),
      ),
    ).toBe("Chart");
  });

  it('returns "Table" for table elements', () => {
    expect(getAriaLabel(makeElement({ id: "1", type: "table" }))).toBe(
      "Table",
    );
  });

  it('returns "SmartArt diagram" for smartArt elements', () => {
    expect(getAriaLabel(makeElement({ id: "1", type: "smartArt" }))).toBe(
      "SmartArt diagram",
    );
  });

  it('returns "Media element" for media elements', () => {
    expect(getAriaLabel(makeElement({ id: "1", type: "media" }))).toBe(
      "Media element",
    );
  });

  it('returns "Group of elements" for group elements', () => {
    expect(getAriaLabel(makeElement({ id: "1", type: "group" }))).toBe(
      "Group of elements",
    );
  });

  it('returns "Connector line" for connector elements', () => {
    expect(getAriaLabel(makeElement({ id: "1", type: "connector" }))).toBe(
      "Connector line",
    );
  });

  it('returns "Ink drawing" for ink elements', () => {
    expect(getAriaLabel(makeElement({ id: "1", type: "ink" }))).toBe(
      "Ink drawing",
    );
  });

  it('returns "3D Model" for model3d elements', () => {
    expect(getAriaLabel(makeElement({ id: "1", type: "model3d" }))).toBe(
      "3D Model",
    );
  });

  it("returns shape type for shapes without text", () => {
    expect(
      getAriaLabel(
        makeElement({ id: "1", type: "shape", shapeType: "ellipse" }),
      ),
    ).toBe("Shape: ellipse");
  });

  it('returns "Shape" for shapes with no shapeType and no text', () => {
    expect(getAriaLabel(makeElement({ id: "1", type: "shape" }))).toBe(
      "Shape",
    );
  });

  it("trims whitespace from text content", () => {
    expect(
      getAriaLabel(
        makeElement({ id: "1", type: "text", text: "  trimmed  " }),
      ),
    ).toBe("trimmed");
  });

  it("falls back when text is only whitespace", () => {
    expect(
      getAriaLabel(makeElement({ id: "1", type: "text", text: "   " })),
    ).toBe("Text box");
  });

  it("prefers altText over text content for images", () => {
    expect(
      getAriaLabel(
        makeElement({
          id: "1",
          type: "image",
          altText: "Alt description",
          text: "Some text",
        }),
      ),
    ).toBe("Alt description");
  });

  it("falls back to Image label when image has no altText", () => {
    expect(
      getAriaLabel(makeElement({ id: "1", type: "image" })),
    ).toBe("Image");
  });
});

// ===========================================================================
// getAriaRoleDescription
// ===========================================================================

describe("getAriaRoleDescription", () => {
  it('returns "shape" for shapes without shapeType', () => {
    expect(
      getAriaRoleDescription(makeElement({ id: "1", type: "shape" })),
    ).toBe("shape");
  });

  it('returns "shape: rect" for shapes with shapeType', () => {
    expect(
      getAriaRoleDescription(
        makeElement({ id: "1", type: "shape", shapeType: "rect" }),
      ),
    ).toBe("shape: rect");
  });

  it('returns "chart" for chart elements', () => {
    expect(
      getAriaRoleDescription(makeElement({ id: "1", type: "chart" })),
    ).toBe("chart");
  });

  it('returns "connector line" for connector elements', () => {
    expect(
      getAriaRoleDescription(makeElement({ id: "1", type: "connector" })),
    ).toBe("connector line");
  });

  it('returns "diagram" for smartArt elements', () => {
    expect(
      getAriaRoleDescription(makeElement({ id: "1", type: "smartArt" })),
    ).toBe("diagram");
  });

  it('returns "image" for image elements', () => {
    expect(
      getAriaRoleDescription(makeElement({ id: "1", type: "image" })),
    ).toBe("image");
  });

  it('returns "image" for picture elements', () => {
    expect(
      getAriaRoleDescription(makeElement({ id: "1", type: "picture" })),
    ).toBe("image");
  });

  it('returns "data table" for table elements', () => {
    expect(
      getAriaRoleDescription(makeElement({ id: "1", type: "table" })),
    ).toBe("data table");
  });

  it('returns "grouped elements" for group elements', () => {
    expect(
      getAriaRoleDescription(makeElement({ id: "1", type: "group" })),
    ).toBe("grouped elements");
  });

  it('returns "media player" for media elements', () => {
    expect(
      getAriaRoleDescription(makeElement({ id: "1", type: "media" })),
    ).toBe("media player");
  });

  it('returns "ink drawing" for ink elements', () => {
    expect(
      getAriaRoleDescription(makeElement({ id: "1", type: "ink" })),
    ).toBe("ink drawing");
  });

  it('returns "3D model" for model3d elements', () => {
    expect(
      getAriaRoleDescription(makeElement({ id: "1", type: "model3d" })),
    ).toBe("3D model");
  });

  it("returns undefined for text elements", () => {
    expect(
      getAriaRoleDescription(makeElement({ id: "1", type: "text" })),
    ).toBeUndefined();
  });
});

// ===========================================================================
// prefersReducedMotion
// ===========================================================================

describe("prefersReducedMotion", () => {
  // In the default vitest node environment `window` is not defined.
  // We must define a minimal global `window` with `matchMedia` for these tests.

  const originalWindow = globalThis.window;

  afterEach(() => {
    if (originalWindow === undefined) {
      // @ts-expect-error -- restore undefined state
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  });

  it("returns false when window is undefined (SSR)", () => {
    // Ensure there is no window
    // @ts-expect-error -- intentionally removing window
    delete globalThis.window;
    expect(prefersReducedMotion()).toBe(false);
  });

  it("returns true when the media query matches", () => {
    const mockMatchMedia = vi.fn().mockReturnValue({ matches: true });
    // @ts-expect-error -- providing minimal window for test
    globalThis.window = { matchMedia: mockMatchMedia };
    expect(prefersReducedMotion()).toBe(true);
  });

  it("returns false when the media query does not match", () => {
    const mockMatchMedia = vi.fn().mockReturnValue({ matches: false });
    // @ts-expect-error -- providing minimal window for test
    globalThis.window = { matchMedia: mockMatchMedia };
    expect(prefersReducedMotion()).toBe(false);
  });

  it("queries the correct media query string", () => {
    const mockMatchMedia = vi.fn().mockReturnValue({ matches: false });
    // @ts-expect-error -- providing minimal window for test
    globalThis.window = { matchMedia: mockMatchMedia };
    prefersReducedMotion();
    expect(mockMatchMedia).toHaveBeenCalledWith(
      "(prefers-reduced-motion: reduce)",
    );
  });
});

// ===========================================================================
// getReducedMotionStyles
// ===========================================================================

describe("getReducedMotionStyles", () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    if (originalWindow === undefined) {
      // @ts-expect-error -- restore undefined state
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  });

  it("returns empty object when reduced motion is not preferred", () => {
    const mockMatchMedia = vi.fn().mockReturnValue({ matches: false });
    // @ts-expect-error -- providing minimal window for test
    globalThis.window = { matchMedia: mockMatchMedia };
    const styles = getReducedMotionStyles();
    expect(styles).toEqual({});
  });

  it("returns animation-disabling styles when reduced motion is preferred", () => {
    const mockMatchMedia = vi.fn().mockReturnValue({ matches: true });
    // @ts-expect-error -- providing minimal window for test
    globalThis.window = { matchMedia: mockMatchMedia };
    const styles = getReducedMotionStyles();
    expect(styles.animationDuration).toBe("0.001ms");
    expect(styles.animationIterationCount).toBe(1);
    expect(styles.transitionDuration).toBe("0.001ms");
    expect(styles.animationDelay).toBe("0ms");
    expect(styles.transitionDelay).toBe("0ms");
  });

  it("returns empty object in SSR (no window)", () => {
    // @ts-expect-error -- intentionally removing window
    delete globalThis.window;
    const styles = getReducedMotionStyles();
    expect(styles).toEqual({});
  });
});

// ===========================================================================
// Reading order integration scenarios
// ===========================================================================

describe("computeReadingOrder — integration scenarios", () => {
  it("handles a typical slide layout (title, subtitle, content)", () => {
    const elements = [
      makeElement({
        id: "content",
        type: "text",
        x: 50,
        y: 200,
        width: 600,
        height: 300,
      }),
      makeElement({
        id: "title",
        type: "text",
        x: 50,
        y: 30,
        width: 600,
        height: 60,
      }),
      makeElement({
        id: "subtitle",
        type: "text",
        x: 50,
        y: 100,
        width: 600,
        height: 40,
      }),
    ];
    const order = computeReadingOrder(elements);
    expect(order.get("title")).toBe(1);
    expect(order.get("subtitle")).toBe(2);
    expect(order.get("content")).toBe(3);
  });

  it("handles a two-column layout", () => {
    const elements = [
      makeElement({
        id: "left-col",
        type: "text",
        x: 50,
        y: 100,
        width: 280,
        height: 300,
      }),
      makeElement({
        id: "right-col",
        type: "text",
        x: 370,
        y: 100,
        width: 280,
        height: 300,
      }),
      makeElement({
        id: "header",
        type: "text",
        x: 50,
        y: 20,
        width: 600,
        height: 50,
      }),
    ];
    const order = computeReadingOrder(elements);
    expect(order.get("header")).toBe(1);
    // Left and right columns are at the same y, so sorted by x
    expect(order.get("left-col")).toBe(2);
    expect(order.get("right-col")).toBe(3);
  });

  it("handles mixed element types", () => {
    const elements = [
      makeElement({ id: "img", type: "image", x: 400, y: 50 }),
      makeElement({ id: "title", type: "text", x: 50, y: 50 }),
      makeElement({ id: "chart", type: "chart", x: 50, y: 300 }),
      makeElement({ id: "table", type: "table", x: 50, y: 500 }),
    ];
    const order = computeReadingOrder(elements);
    // Same y row: title (x=50), img (x=400)
    expect(order.get("title")).toBe(1);
    expect(order.get("img")).toBe(2);
    expect(order.get("chart")).toBe(3);
    expect(order.get("table")).toBe(4);
  });
});
