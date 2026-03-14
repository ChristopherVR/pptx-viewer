import { describe, it, expect, vi } from "vitest";
import { collectMediaElements, buildInitialGuides } from "./load-content-helpers";
import type { PptxElement, MediaPptxElement, PptxDrawingGuide } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// collectMediaElements
// ---------------------------------------------------------------------------

describe("collectMediaElements", () => {
  it("should return empty array when no elements are provided", () => {
    const collector: MediaPptxElement[] = [];
    collectMediaElements([], collector);
    expect(collector).toEqual([]);
  });

  it("should collect media elements from flat array", () => {
    const media1: MediaPptxElement = {
      id: "m1",
      type: "media",
      mediaType: "video",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    } as MediaPptxElement;
    const media2: MediaPptxElement = {
      id: "m2",
      type: "media",
      mediaType: "audio",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    } as MediaPptxElement;
    const shape = {
      id: "s1",
      type: "shape",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    } as PptxElement;

    const collector: MediaPptxElement[] = [];
    collectMediaElements([media1, shape, media2], collector);
    expect(collector).toHaveLength(2);
    expect(collector[0].id).toBe("m1");
    expect(collector[1].id).toBe("m2");
  });

  it("should skip non-media elements", () => {
    const elements: PptxElement[] = [
      { id: "s1", type: "shape", x: 0, y: 0, width: 100, height: 100 } as PptxElement,
      { id: "t1", type: "text", x: 0, y: 0, width: 100, height: 100 } as PptxElement,
      { id: "i1", type: "image", x: 0, y: 0, width: 100, height: 100 } as PptxElement,
    ];
    const collector: MediaPptxElement[] = [];
    collectMediaElements(elements, collector);
    expect(collector).toHaveLength(0);
  });

  it("should recursively collect media elements from groups", () => {
    const nestedMedia: MediaPptxElement = {
      id: "m-nested",
      type: "media",
      mediaType: "video",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    } as MediaPptxElement;
    const group = {
      id: "g1",
      type: "group",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      children: [nestedMedia],
    } as PptxElement;
    const collector: MediaPptxElement[] = [];
    collectMediaElements([group], collector);
    expect(collector).toHaveLength(1);
    expect(collector[0].id).toBe("m-nested");
  });

  it("should handle deeply nested groups", () => {
    const deepMedia: MediaPptxElement = {
      id: "m-deep",
      type: "media",
      mediaType: "audio",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    } as MediaPptxElement;
    const innerGroup = {
      id: "g-inner",
      type: "group",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      children: [deepMedia],
    } as PptxElement;
    const outerGroup = {
      id: "g-outer",
      type: "group",
      x: 0,
      y: 0,
      width: 400,
      height: 400,
      children: [innerGroup],
    } as PptxElement;
    const collector: MediaPptxElement[] = [];
    collectMediaElements([outerGroup], collector);
    expect(collector).toHaveLength(1);
    expect(collector[0].id).toBe("m-deep");
  });

  it("should not recurse into non-group elements", () => {
    const shape = {
      id: "s1",
      type: "shape",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      children: [
        {
          id: "m-hidden",
          type: "media",
          mediaType: "audio",
          x: 0,
          y: 0,
          width: 50,
          height: 50,
        },
      ],
    } as unknown as PptxElement;
    const collector: MediaPptxElement[] = [];
    collectMediaElements([shape], collector);
    expect(collector).toHaveLength(0);
  });

  it("should handle group with no children", () => {
    const emptyGroup = {
      id: "g-empty",
      type: "group",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      children: [],
    } as PptxElement;
    const collector: MediaPptxElement[] = [];
    collectMediaElements([emptyGroup], collector);
    expect(collector).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildInitialGuides
// ---------------------------------------------------------------------------

describe("buildInitialGuides", () => {
  it("should return empty array when no guides are provided", () => {
    const result = buildInitialGuides(undefined, undefined);
    expect(result).toEqual([]);
  });

  it("should convert horizontal presentation guides", () => {
    const guides: PptxDrawingGuide[] = [
      { id: "g1", orientation: "horz", positionEmu: 9525 },
    ];
    const result = buildInitialGuides(guides, undefined);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("g1");
    expect(result[0].axis).toBe("h");
    expect(result[0].position).toBe(1); // 9525 / 9525 = 1
  });

  it("should convert vertical presentation guides", () => {
    const guides: PptxDrawingGuide[] = [
      { id: "g2", orientation: "vert", positionEmu: 19050 },
    ];
    const result = buildInitialGuides(guides, undefined);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("g2");
    expect(result[0].axis).toBe("v");
    expect(result[0].position).toBe(2); // 19050 / 9525 = 2
  });

  it("should combine presentation and slide guides", () => {
    const presGuides: PptxDrawingGuide[] = [
      { id: "pg1", orientation: "horz", positionEmu: 9525 },
    ];
    const slideGuides: PptxDrawingGuide[] = [
      { id: "sg1", orientation: "vert", positionEmu: 28575 },
    ];
    const result = buildInitialGuides(presGuides, slideGuides);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("pg1");
    expect(result[0].axis).toBe("h");
    expect(result[1].id).toBe("sg1");
    expect(result[1].axis).toBe("v");
    expect(result[1].position).toBe(3); // 28575 / 9525 = 3
  });

  it("should handle only slide guides", () => {
    const slideGuides: PptxDrawingGuide[] = [
      { id: "sg1", orientation: "horz", positionEmu: 47625 },
      { id: "sg2", orientation: "vert", positionEmu: 95250 },
    ];
    const result = buildInitialGuides(undefined, slideGuides);
    expect(result).toHaveLength(2);
    expect(result[0].axis).toBe("h");
    expect(result[0].position).toBe(5); // 47625 / 9525
    expect(result[1].axis).toBe("v");
    expect(result[1].position).toBe(10); // 95250 / 9525
  });

  it("should handle zero EMU position", () => {
    const guides: PptxDrawingGuide[] = [
      { id: "g-zero", orientation: "horz", positionEmu: 0 },
    ];
    const result = buildInitialGuides(guides, undefined);
    expect(result).toHaveLength(1);
    expect(result[0].position).toBe(0);
  });
});
