import { describe, it, expect } from "vitest";
import {
  extractModel3DTransform,
  resolveModel3DMimeType,
} from "./model3d-parser";
import { SHAPE_TREE_ELEMENT_TAGS } from "./alternate-content";
import type { Model3DPptxElement, PptxElement } from "../types/elements";
import type { PptxLayoutOption, PptxData } from "../types/presentation";

// ---------------------------------------------------------------------------
// extractModel3DTransform
// ---------------------------------------------------------------------------

describe("extractModel3DTransform", () => {
  const EMU_PER_PX = 12700;

  it("parses x, y, width, height from p16:spPr", () => {
    const model3d = {
      "p16:spPr": {
        "a:xfrm": {
          "a:off": { "@_x": "127000", "@_y": "254000" },
          "a:ext": { "@_cx": "635000", "@_cy": "381000" },
        },
      },
    };
    const t = extractModel3DTransform(model3d);
    expect(t.x).toBe(127000 / EMU_PER_PX);
    expect(t.y).toBe(254000 / EMU_PER_PX);
    expect(t.width).toBe(635000 / EMU_PER_PX);
    expect(t.height).toBe(381000 / EMU_PER_PX);
  });

  it("falls back to p:spPr when p16:spPr is absent", () => {
    const model3d = {
      "p:spPr": {
        "a:xfrm": {
          "a:off": { "@_x": "100000", "@_y": "200000" },
          "a:ext": { "@_cx": "500000", "@_cy": "300000" },
        },
      },
    };
    const t = extractModel3DTransform(model3d);
    expect(t.x).toBe(100000 / EMU_PER_PX);
    expect(t.y).toBe(200000 / EMU_PER_PX);
    expect(t.width).toBe(500000 / EMU_PER_PX);
    expect(t.height).toBe(300000 / EMU_PER_PX);
  });

  it("defaults x and y to 0 when a:off is missing", () => {
    const model3d = {
      "p16:spPr": {
        "a:xfrm": {
          "a:ext": { "@_cx": "500000", "@_cy": "300000" },
        },
      },
    };
    const t = extractModel3DTransform(model3d);
    expect(t.x).toBe(0);
    expect(t.y).toBe(0);
    expect(t.width).toBe(500000 / EMU_PER_PX);
    expect(t.height).toBe(300000 / EMU_PER_PX);
  });

  it("defaults width to 120 and height to 80 when a:ext has zero values", () => {
    const model3d = {
      "p16:spPr": {
        "a:xfrm": {
          "a:off": { "@_x": "0", "@_y": "0" },
          "a:ext": { "@_cx": "0", "@_cy": "0" },
        },
      },
    };
    const t = extractModel3DTransform(model3d);
    expect(t.width).toBe(120);
    expect(t.height).toBe(80);
  });

  it("defaults width to 120 and height to 80 when a:ext is missing", () => {
    const model3d = {
      "p16:spPr": {
        "a:xfrm": {
          "a:off": { "@_x": "0", "@_y": "0" },
        },
      },
    };
    const t = extractModel3DTransform(model3d);
    expect(t.width).toBe(120);
    expect(t.height).toBe(80);
  });

  it("parses rotation from @_rot (divided by 60000)", () => {
    const model3d = {
      "p16:spPr": {
        "a:xfrm": {
          "@_rot": "5400000",
          "a:off": { "@_x": "0", "@_y": "0" },
          "a:ext": { "@_cx": "500000", "@_cy": "300000" },
        },
      },
    };
    const t = extractModel3DTransform(model3d);
    expect(t.rotation).toBe(5400000 / 60000); // 90 degrees
  });

  it("returns undefined rotation when @_rot is absent", () => {
    const model3d = {
      "p16:spPr": {
        "a:xfrm": {
          "a:off": { "@_x": "0", "@_y": "0" },
          "a:ext": { "@_cx": "500000", "@_cy": "300000" },
        },
      },
    };
    const t = extractModel3DTransform(model3d);
    expect(t.rotation).toBeUndefined();
  });

  it("handles complete XML object with all fields", () => {
    const model3d = {
      "p16:spPr": {
        "a:xfrm": {
          "@_rot": "10800000",
          "a:off": { "@_x": "914400", "@_y": "1828800" },
          "a:ext": { "@_cx": "4572000", "@_cy": "2743200" },
        },
      },
      // Additional fields that should be ignored
      "p16:model3Drel": { "@_r:id": "rId5" },
      "p16:posterImage": { "@_r:embed": "rId6" },
    };
    const t = extractModel3DTransform(model3d);
    expect(t.x).toBeCloseTo(914400 / EMU_PER_PX);
    expect(t.y).toBeCloseTo(1828800 / EMU_PER_PX);
    expect(t.width).toBeCloseTo(4572000 / EMU_PER_PX);
    expect(t.height).toBeCloseTo(2743200 / EMU_PER_PX);
    expect(t.rotation).toBe(10800000 / 60000); // 180 degrees
  });

  it("handles completely empty input", () => {
    const t = extractModel3DTransform({});
    expect(t.x).toBe(0);
    expect(t.y).toBe(0);
    expect(t.width).toBe(120);
    expect(t.height).toBe(80);
    expect(t.rotation).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveModel3DMimeType
// ---------------------------------------------------------------------------

describe("resolveModel3DMimeType", () => {
  it('returns "model/gltf-binary" for .glb files', () => {
    expect(resolveModel3DMimeType("ppt/media/model1.glb")).toBe(
      "model/gltf-binary",
    );
  });

  it('returns "model/gltf+json" for .gltf files', () => {
    expect(resolveModel3DMimeType("ppt/media/model1.gltf")).toBe(
      "model/gltf+json",
    );
  });

  it("returns undefined for unknown extensions", () => {
    expect(resolveModel3DMimeType("ppt/media/model1.obj")).toBeUndefined();
    expect(resolveModel3DMimeType("ppt/media/model1.fbx")).toBeUndefined();
  });

  it("handles uppercase extensions via case-insensitive check", () => {
    expect(resolveModel3DMimeType("ppt/media/model1.GLB")).toBe(
      "model/gltf-binary",
    );
    expect(resolveModel3DMimeType("ppt/media/model1.GLTF")).toBe(
      "model/gltf+json",
    );
  });

  it("handles paths with multiple dots", () => {
    expect(resolveModel3DMimeType("ppt/media/my.model.v2.glb")).toBe(
      "model/gltf-binary",
    );
    expect(resolveModel3DMimeType("ppt/media/scene.final.gltf")).toBe(
      "model/gltf+json",
    );
  });
});

// ---------------------------------------------------------------------------
// Type verification (compile-time checks via type assertions)
// ---------------------------------------------------------------------------

describe("type definitions", () => {
  it('Model3DPptxElement has type "model3d"', () => {
    const el: Model3DPptxElement = {
      id: "m3d_1",
      type: "model3d",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    };
    expect(el.type).toBe("model3d");
  });

  it("Model3DPptxElement is assignable to PptxElement", () => {
    const el: Model3DPptxElement = {
      id: "m3d_2",
      type: "model3d",
      x: 10,
      y: 20,
      width: 300,
      height: 200,
      modelPath: "ppt/media/model1.glb",
      modelMimeType: "model/gltf-binary",
      posterImage: "ppt/media/poster.png",
    };
    // This assignment verifies Model3DPptxElement is a member of PptxElement union
    const pptxEl: PptxElement = el;
    expect(pptxEl.type).toBe("model3d");
  });

  it("PptxLayoutOption accepts type field (GAP-11)", () => {
    const layout: PptxLayoutOption = {
      path: "ppt/slideLayouts/slideLayout1.xml",
      name: "Title Slide",
      type: "title",
    };
    expect(layout.type).toBe("title");
  });

  it("PptxData accepts slideSizeType field (GAP-12)", () => {
    const data: PptxData = {
      slides: [],
      width: 960,
      height: 540,
      slideSizeType: "screen16x9",
    };
    expect(data.slideSizeType).toBe("screen16x9");
  });
});

// ---------------------------------------------------------------------------
// Alternate content integration
// ---------------------------------------------------------------------------

describe("SHAPE_TREE_ELEMENT_TAGS integration", () => {
  it('includes "p16:model3D" in the shape tree element tags', () => {
    expect(SHAPE_TREE_ELEMENT_TAGS.has("p16:model3D")).toBe(true);
  });
});
