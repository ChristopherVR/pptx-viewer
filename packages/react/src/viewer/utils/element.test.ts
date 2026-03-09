import { describe, it, expect } from "vitest";
import {
  isTemplateElement,
  isTemplateElementId,
  getElementLabel,
  formatCommentTimestamp,
  getCommentMarkerPosition,
  getConnectionSitePosition,
} from "./element";
import type { PptxElement, PptxComment } from "pptx-viewer-core";

describe("isTemplateElement", () => {
  it("returns true for layout elements", () => {
    expect(
      isTemplateElement({ id: "layout-header-1" } as PptxElement),
    ).toBe(true);
  });

  it("returns true for master elements", () => {
    expect(
      isTemplateElement({ id: "master-bg-1" } as PptxElement),
    ).toBe(true);
  });

  it("returns false for normal elements", () => {
    expect(
      isTemplateElement({ id: "el-12345" } as PptxElement),
    ).toBe(false);
  });

  it("returns false for empty id", () => {
    expect(
      isTemplateElement({ id: "" } as PptxElement),
    ).toBe(false);
  });

  it("is case-sensitive (Layout- is not template)", () => {
    expect(
      isTemplateElement({ id: "Layout-1" } as PptxElement),
    ).toBe(false);
  });

  it("returns false when id contains layout- mid-string", () => {
    expect(
      isTemplateElement({ id: "x-layout-1" } as PptxElement),
    ).toBe(false);
  });
});

describe("isTemplateElementId", () => {
  it("returns true for layout- prefix", () => {
    expect(isTemplateElementId("layout-1")).toBe(true);
  });

  it("returns true for master- prefix", () => {
    expect(isTemplateElementId("master-1")).toBe(true);
  });

  it("returns false for normal ids", () => {
    expect(isTemplateElementId("el-abc")).toBe(false);
  });
});

describe("getElementLabel", () => {
  it('returns "Text" for text elements', () => {
    expect(getElementLabel({ type: "text" } as PptxElement)).toBe("Text");
  });

  it('returns "Image" for image elements', () => {
    expect(getElementLabel({ type: "image" } as PptxElement)).toBe("Image");
  });

  it('returns "Image" for picture elements', () => {
    expect(getElementLabel({ type: "picture" } as PptxElement)).toBe("Image");
  });

  it('returns "Chart" for chart elements', () => {
    expect(getElementLabel({ type: "chart" } as PptxElement)).toBe("Chart");
  });

  it('returns "Table" for table elements', () => {
    expect(getElementLabel({ type: "table" } as PptxElement)).toBe("Table");
  });

  it('returns "Connector" for connector elements', () => {
    expect(getElementLabel({ type: "connector" } as PptxElement)).toBe(
      "Connector",
    );
  });

  it("returns Group with children count", () => {
    expect(
      getElementLabel({
        type: "group",
        children: [{}, {}, {}],
      } as unknown as PptxElement),
    ).toBe("Group (3)");
  });

  it('returns "Shape" for shape type', () => {
    expect(getElementLabel({ type: "shape" } as PptxElement)).toBe("Shape");
  });

  it('returns "Media" for media elements', () => {
    expect(getElementLabel({ type: "media" } as PptxElement)).toBe("Media");
  });

  it('returns "Drawing" for ink elements', () => {
    expect(getElementLabel({ type: "ink" } as PptxElement)).toBe("Drawing");
  });

  it("returns OLE name when available", () => {
    expect(
      getElementLabel({
        type: "ole",
        oleName: "Excel Sheet",
      } as unknown as PptxElement),
    ).toBe("Excel Sheet");
  });

  it('returns "Embedded Object" for OLE without name', () => {
    expect(getElementLabel({ type: "ole" } as PptxElement)).toBe(
      "Embedded Object",
    );
  });
});

describe("formatCommentTimestamp", () => {
  it("returns empty string for undefined", () => {
    expect(formatCommentTimestamp(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(formatCommentTimestamp("")).toBe("");
  });

  it("returns empty string for invalid date", () => {
    expect(formatCommentTimestamp("not-a-date")).toBe("");
  });

  it("returns formatted date for valid ISO string", () => {
    const result = formatCommentTimestamp("2024-03-07T10:30:00Z");
    expect(result.length).toBeGreaterThan(0);
    // Should contain some recognizable date component
    expect(result).toMatch(/\d/);
  });

  it("returns empty string for whitespace-only input", () => {
    expect(formatCommentTimestamp("   ")).toBe("");
  });

  it("handles dates with timezone offsets", () => {
    const result = formatCommentTimestamp("2024-06-15T14:00:00+05:00");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("getCommentMarkerPosition", () => {
  it("uses comment coordinates when available", () => {
    const comment = { x: 50, y: 60 } as PptxComment;
    const pos = getCommentMarkerPosition(comment, 0, 800, 600);
    expect(pos.x).toBe(50);
    expect(pos.y).toBe(60);
  });

  it("uses fallback grid position when comment has no coords", () => {
    const comment = {} as PptxComment;
    const pos = getCommentMarkerPosition(comment, 0, 800, 600);
    expect(pos.x).toBe(18); // 18 + (0 % 4) * 14
    expect(pos.y).toBe(18); // 18 + floor(0 / 4) * 14
  });

  it("distributes fallback positions across a 4-column grid", () => {
    const comment = {} as PptxComment;
    const pos0 = getCommentMarkerPosition(comment, 0, 800, 600);
    const pos1 = getCommentMarkerPosition(comment, 1, 800, 600);
    const pos4 = getCommentMarkerPosition(comment, 4, 800, 600);
    // index 0: x=18, y=18
    expect(pos0).toEqual({ x: 18, y: 18 });
    // index 1: x=32, y=18
    expect(pos1.x).toBe(32);
    expect(pos1.y).toBe(18);
    // index 4: wraps to next row
    expect(pos4.x).toBe(18);
    expect(pos4.y).toBe(32);
  });

  it("clamps position to stay within slide bounds", () => {
    const comment = { x: 900, y: 700 } as PptxComment;
    const pos = getCommentMarkerPosition(comment, 0, 800, 600);
    expect(pos.x).toBeLessThanOrEqual(800);
    expect(pos.y).toBeLessThanOrEqual(600);
  });

  it("clamps position to minimum bounds", () => {
    const comment = { x: -100, y: -100 } as PptxComment;
    const pos = getCommentMarkerPosition(comment, 0, 800, 600);
    expect(pos.x).toBeGreaterThanOrEqual(8);
    expect(pos.y).toBeGreaterThanOrEqual(8);
  });

  it("handles very small slides", () => {
    const comment = { x: 50, y: 50 } as PptxComment;
    const pos = getCommentMarkerPosition(comment, 0, 10, 10);
    expect(pos.x).toBeGreaterThanOrEqual(8);
    expect(pos.y).toBeGreaterThanOrEqual(8);
  });
});

describe("getConnectionSitePosition", () => {
  const element = {
    x: 100,
    y: 200,
    width: 80,
    height: 60,
  } as PptxElement;

  it("returns top-centre for site 0", () => {
    expect(getConnectionSitePosition(element, 0)).toEqual({
      x: 140,
      y: 200,
    });
  });

  it("returns right-centre for site 1", () => {
    expect(getConnectionSitePosition(element, 1)).toEqual({
      x: 180,
      y: 230,
    });
  });

  it("returns bottom-centre for site 2", () => {
    expect(getConnectionSitePosition(element, 2)).toEqual({
      x: 140,
      y: 260,
    });
  });

  it("returns left-centre for site 3", () => {
    expect(getConnectionSitePosition(element, 3)).toEqual({
      x: 100,
      y: 230,
    });
  });

  it("returns undefined for out-of-range site index", () => {
    expect(getConnectionSitePosition(element, 4)).toBeUndefined();
    expect(getConnectionSitePosition(element, -1)).toBeUndefined();
  });

  it("handles zero-size elements", () => {
    const zeroEl = { x: 50, y: 50, width: 0, height: 0 } as PptxElement;
    expect(getConnectionSitePosition(zeroEl, 0)).toEqual({ x: 50, y: 50 });
    expect(getConnectionSitePosition(zeroEl, 2)).toEqual({ x: 50, y: 50 });
  });
});
