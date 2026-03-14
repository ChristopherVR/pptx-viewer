import { describe, it, expect } from "vitest";
import { MediaGraphicFrameXmlFactory } from "./MediaGraphicFrameXmlFactory";
import type { PptxBuilderFactoryContext } from "./types";
import type { MediaPptxElement, XmlObject } from "../../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMU_PER_PX = 9525;

function createMockContext(
  overrides?: Partial<PptxBuilderFactoryContext>,
): PptxBuilderFactoryContext {
  let nextId = 100;
  return {
    emuPerPx: EMU_PER_PX,
    getNextId: () => nextId++,
    normalizePresetGeometry: (shapeType) => shapeType || "rect",
    toDrawingTextVerticalAlign: () => undefined,
    ...overrides,
  };
}

function createMediaElement(
  overrides: Partial<MediaPptxElement> = {},
): MediaPptxElement {
  return {
    type: "media",
    id: "media1",
    x: 100,
    y: 200,
    width: 640,
    height: 480,
    mediaType: "video",
    ...overrides,
  } as MediaPptxElement;
}

// ---------------------------------------------------------------------------
// MediaGraphicFrameXmlFactory
// ---------------------------------------------------------------------------

describe("MediaGraphicFrameXmlFactory", () => {
  it("produces p:nvGraphicFramePr, p:xfrm, and a:graphic nodes", () => {
    const factory = new MediaGraphicFrameXmlFactory(createMockContext());
    const result = factory.createXmlElement({
      element: createMediaElement(),
      relationshipId: "rId1",
    });
    expect(result["p:nvGraphicFramePr"]).toBeDefined();
    expect(result["p:xfrm"]).toBeDefined();
    expect(result["a:graphic"]).toBeDefined();
  });

  it("assigns a unique ID from context", () => {
    const ctx = createMockContext();
    const factory = new MediaGraphicFrameXmlFactory(ctx);
    const r1 = factory.createXmlElement({
      element: createMediaElement(),
      relationshipId: "rId1",
    });
    const r2 = factory.createXmlElement({
      element: createMediaElement(),
      relationshipId: "rId2",
    });
    const id1 = (r1["p:nvGraphicFramePr"] as XmlObject)["p:cNvPr"] as XmlObject;
    const id2 = (r2["p:nvGraphicFramePr"] as XmlObject)["p:cNvPr"] as XmlObject;
    expect(id1["@_id"]).not.toBe(id2["@_id"]);
  });

  it('names the element "Video <id>" for video media type', () => {
    const factory = new MediaGraphicFrameXmlFactory(createMockContext());
    const result = factory.createXmlElement({
      element: createMediaElement({ mediaType: "video" }),
      relationshipId: "rId1",
    });
    const cNvPr = (result["p:nvGraphicFramePr"] as XmlObject)[
      "p:cNvPr"
    ] as XmlObject;
    expect(cNvPr["@_name"]).toMatch(/^Video \d+$/);
  });

  it('names the element "Audio <id>" for audio media type', () => {
    const factory = new MediaGraphicFrameXmlFactory(createMockContext());
    const result = factory.createXmlElement({
      element: createMediaElement({ mediaType: "audio" }),
      relationshipId: "rId1",
    });
    const cNvPr = (result["p:nvGraphicFramePr"] as XmlObject)[
      "p:cNvPr"
    ] as XmlObject;
    expect(cNvPr["@_name"]).toMatch(/^Audio \d+$/);
  });

  it('uses a:videoFile tag for video media', () => {
    const factory = new MediaGraphicFrameXmlFactory(createMockContext());
    const result = factory.createXmlElement({
      element: createMediaElement({ mediaType: "video" }),
      relationshipId: "rId5",
    });
    const graphicData = (result["a:graphic"] as XmlObject)[
      "a:graphicData"
    ] as XmlObject;
    expect(graphicData["a:videoFile"]).toBeDefined();
    expect(
      (graphicData["a:videoFile"] as XmlObject)["@_r:link"],
    ).toBe("rId5");
    expect(graphicData["a:audioFile"]).toBeUndefined();
  });

  it('uses a:audioFile tag for audio media', () => {
    const factory = new MediaGraphicFrameXmlFactory(createMockContext());
    const result = factory.createXmlElement({
      element: createMediaElement({ mediaType: "audio" }),
      relationshipId: "rId7",
    });
    const graphicData = (result["a:graphic"] as XmlObject)[
      "a:graphicData"
    ] as XmlObject;
    expect(graphicData["a:audioFile"]).toBeDefined();
    expect(
      (graphicData["a:audioFile"] as XmlObject)["@_r:link"],
    ).toBe("rId7");
    expect(graphicData["a:videoFile"]).toBeUndefined();
  });

  it('defaults to video for "unknown" media type', () => {
    const factory = new MediaGraphicFrameXmlFactory(createMockContext());
    const result = factory.createXmlElement({
      element: createMediaElement({ mediaType: "unknown" }),
      relationshipId: "rId1",
    });
    const graphicData = (result["a:graphic"] as XmlObject)[
      "a:graphicData"
    ] as XmlObject;
    expect(graphicData["a:videoFile"]).toBeDefined();
  });

  it("converts position to EMU in p:xfrm", () => {
    const factory = new MediaGraphicFrameXmlFactory(createMockContext());
    const result = factory.createXmlElement({
      element: createMediaElement({ x: 50, y: 75 }),
      relationshipId: "rId1",
    });
    const xfrm = result["p:xfrm"] as XmlObject;
    const off = xfrm["a:off"] as XmlObject;
    expect(off["@_x"]).toBe(String(Math.round(50 * EMU_PER_PX)));
    expect(off["@_y"]).toBe(String(Math.round(75 * EMU_PER_PX)));
  });

  it("converts size to EMU in p:xfrm", () => {
    const factory = new MediaGraphicFrameXmlFactory(createMockContext());
    const result = factory.createXmlElement({
      element: createMediaElement({ width: 320, height: 240 }),
      relationshipId: "rId1",
    });
    const xfrm = result["p:xfrm"] as XmlObject;
    const ext = xfrm["a:ext"] as XmlObject;
    expect(ext["@_cx"]).toBe(String(Math.round(320 * EMU_PER_PX)));
    expect(ext["@_cy"]).toBe(String(Math.round(240 * EMU_PER_PX)));
  });

  it("sets rotation when element has rotation", () => {
    const factory = new MediaGraphicFrameXmlFactory(createMockContext());
    const result = factory.createXmlElement({
      element: createMediaElement({ rotation: 90 }),
      relationshipId: "rId1",
    });
    const xfrm = result["p:xfrm"] as XmlObject;
    // 90 * 60000 = 5400000
    expect(xfrm["@_rot"]).toBe(String(Math.round(90 * 60000)));
  });

  it("omits rotation when element has no rotation", () => {
    const factory = new MediaGraphicFrameXmlFactory(createMockContext());
    const result = factory.createXmlElement({
      element: createMediaElement({ rotation: undefined }),
      relationshipId: "rId1",
    });
    const xfrm = result["p:xfrm"] as XmlObject;
    expect(xfrm["@_rot"]).toBeUndefined();
  });

  it("omits rotation when rotation is 0", () => {
    const factory = new MediaGraphicFrameXmlFactory(createMockContext());
    const result = factory.createXmlElement({
      element: createMediaElement({ rotation: 0 }),
      relationshipId: "rId1",
    });
    const xfrm = result["p:xfrm"] as XmlObject;
    expect(xfrm["@_rot"]).toBeUndefined();
  });

  it("sets flipH when flipHorizontal is true", () => {
    const factory = new MediaGraphicFrameXmlFactory(createMockContext());
    const result = factory.createXmlElement({
      element: createMediaElement({ flipHorizontal: true }),
      relationshipId: "rId1",
    });
    const xfrm = result["p:xfrm"] as XmlObject;
    expect(xfrm["@_flipH"]).toBe("1");
  });

  it("omits flipH when flipHorizontal is false", () => {
    const factory = new MediaGraphicFrameXmlFactory(createMockContext());
    const result = factory.createXmlElement({
      element: createMediaElement({ flipHorizontal: false }),
      relationshipId: "rId1",
    });
    const xfrm = result["p:xfrm"] as XmlObject;
    expect(xfrm["@_flipH"]).toBeUndefined();
  });

  it("sets flipV when flipVertical is true", () => {
    const factory = new MediaGraphicFrameXmlFactory(createMockContext());
    const result = factory.createXmlElement({
      element: createMediaElement({ flipVertical: true }),
      relationshipId: "rId1",
    });
    const xfrm = result["p:xfrm"] as XmlObject;
    expect(xfrm["@_flipV"]).toBe("1");
  });

  it("sets the correct graphic data URI for media", () => {
    const factory = new MediaGraphicFrameXmlFactory(createMockContext());
    const result = factory.createXmlElement({
      element: createMediaElement(),
      relationshipId: "rId1",
    });
    const graphicData = (result["a:graphic"] as XmlObject)[
      "a:graphicData"
    ] as XmlObject;
    expect(graphicData["@_uri"]).toBe(
      "http://schemas.openxmlformats.org/drawingml/2006/media",
    );
  });
});
