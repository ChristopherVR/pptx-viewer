import { describe, it, expect } from "vitest";
import { PptxElementTransformUpdater } from "./PptxElementTransformUpdater";
import { PptxConnectorParser } from "./PptxConnectorParser";
import { PptxGraphicFrameParser } from "./PptxGraphicFrameParser";
import type { PptxElement, XmlObject, ShapeStyle } from "../../types";

const EMU_PER_PX = 9525;

/**
 * Helper to build a minimal PptxElement with optional skew overrides.
 */
function makeElement(
  overrides: Partial<{
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    skewX: number;
    skewY: number;
    flipHorizontal: boolean;
    flipVertical: boolean;
  }>,
): PptxElement {
  return {
    type: "shape",
    id: "test-el-1",
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    width: overrides.width ?? 100,
    height: overrides.height ?? 100,
    rotation: overrides.rotation,
    skewX: overrides.skewX,
    skewY: overrides.skewY,
    flipHorizontal: overrides.flipHorizontal,
    flipVertical: overrides.flipVertical,
  } as unknown as PptxElement;
}

function makeShapeXml(opts?: { useGroupTransform?: boolean }): XmlObject {
  if (opts?.useGroupTransform) {
    return {
      "p:xfrm": {
        "a:off": { "@_x": "0", "@_y": "0" },
        "a:ext": { "@_cx": "0", "@_cy": "0" },
      },
    };
  }
  return {
    "p:spPr": {
      "a:xfrm": {
        "a:off": { "@_x": "0", "@_y": "0" },
        "a:ext": { "@_cx": "0", "@_cy": "0" },
      },
    },
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PptxElementTransformUpdater – skew save tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("PptxElementTransformUpdater – skew", () => {
  const updater = new PptxElementTransformUpdater();

  it("sets skewX in 60000ths of a degree", () => {
    const shape = makeShapeXml();
    const element = makeElement({ skewX: 15 });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    // 15 degrees * 60000 = 900000
    expect(xfrm["@_skewX"]).toBe("900000");
  });

  it("sets skewY in 60000ths of a degree", () => {
    const shape = makeShapeXml();
    const element = makeElement({ skewY: 30 });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    // 30 degrees * 60000 = 1800000
    expect(xfrm["@_skewY"]).toBe("1800000");
  });

  it("does not set skewX when undefined", () => {
    const shape = makeShapeXml();
    const element = makeElement({});
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    expect(xfrm["@_skewX"]).toBeUndefined();
    expect(xfrm["@_skewY"]).toBeUndefined();
  });

  it("sets both skewX and skewY simultaneously", () => {
    const shape = makeShapeXml();
    const element = makeElement({ skewX: 10, skewY: 20 });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    expect(xfrm["@_skewX"]).toBe("600000"); // 10 * 60000
    expect(xfrm["@_skewY"]).toBe("1200000"); // 20 * 60000
  });

  it("handles negative skew values", () => {
    const shape = makeShapeXml();
    const element = makeElement({ skewX: -15, skewY: -45 });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    expect(xfrm["@_skewX"]).toBe("-900000"); // -15 * 60000
    expect(xfrm["@_skewY"]).toBe("-2700000"); // -45 * 60000
  });

  it("combines skew with rotation and flip", () => {
    const shape = makeShapeXml();
    const element = makeElement({
      rotation: 45,
      skewX: 10,
      skewY: 5,
      flipHorizontal: true,
    });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    expect(xfrm["@_rot"]).toBe("2700000"); // 45 * 60000
    expect(xfrm["@_skewX"]).toBe("600000"); // 10 * 60000
    expect(xfrm["@_skewY"]).toBe("300000"); // 5 * 60000
    expect(xfrm["@_flipH"]).toBe("1");
  });

  it("handles skew with group transform (p:xfrm)", () => {
    const shape = makeShapeXml({ useGroupTransform: true });
    const element = makeElement({ skewX: 22.5 });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = shape["p:xfrm"] as XmlObject;
    expect(xfrm["@_skewX"]).toBe("1350000"); // 22.5 * 60000
  });

  it("rounds fractional skew values to nearest integer", () => {
    const shape = makeShapeXml();
    const element = makeElement({ skewX: 10.5 });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    // 10.5 * 60000 = 630000 (Math.round)
    expect(xfrm["@_skewX"]).toBe("630000");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PptxConnectorParser – skew parsing
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("PptxConnectorParser – skew parsing", () => {
  function makeConnectorContext() {
    return {
      emuPerPx: EMU_PER_PX,
      getOrderedSlidePaths: () => ["ppt/slides/slide1.xml"],
      slideRelsMap: new Map(),
      parseGeometryAdjustments: () => undefined,
      readFlipState: () => ({}),
      extractShapeStyle: () => ({}) as ShapeStyle,
      parseShapeLocks: () => undefined,
      parseElementActions: () => ({}),
    };
  }

  function makeConnectorXml(skewX?: string, skewY?: string): XmlObject {
    const xfrm: XmlObject = {
      "a:off": { "@_x": "0", "@_y": "0" },
      "a:ext": { "@_cx": String(100 * EMU_PER_PX), "@_cy": String(50 * EMU_PER_PX) },
    };
    if (skewX) xfrm["@_skewX"] = skewX;
    if (skewY) xfrm["@_skewY"] = skewY;

    return {
      "p:nvCxnSpPr": { "p:cNvPr": { "@_id": "1", "@_name": "Connector 1" }, "p:cNvCxnSpPr": {}, "p:nvPr": {} },
      "p:spPr": {
        "a:xfrm": xfrm,
        "a:prstGeom": { "@_prst": "straightConnector1" },
      },
    };
  }

  it("parses skewX from connector transform", () => {
    const parser = new PptxConnectorParser(makeConnectorContext());
    const xml = makeConnectorXml("900000"); // 15 degrees
    const result = parser.parseConnector(xml, "c1");
    expect(result).not.toBeNull();
    expect(result!.skewX).toBe(15);
  });

  it("parses skewY from connector transform", () => {
    const parser = new PptxConnectorParser(makeConnectorContext());
    const xml = makeConnectorXml(undefined, "1800000"); // 30 degrees
    const result = parser.parseConnector(xml, "c1");
    expect(result).not.toBeNull();
    expect(result!.skewY).toBe(30);
  });

  it("returns undefined skew when attributes absent", () => {
    const parser = new PptxConnectorParser(makeConnectorContext());
    const xml = makeConnectorXml();
    const result = parser.parseConnector(xml, "c1");
    expect(result).not.toBeNull();
    expect(result!.skewX).toBeUndefined();
    expect(result!.skewY).toBeUndefined();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PptxGraphicFrameParser – skew parsing
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe("PptxGraphicFrameParser – skew parsing", () => {
  function makeFrameContext() {
    return {
      emuPerPx: EMU_PER_PX,
      getOrderedSlidePaths: () => ["ppt/slides/slide1.xml"],
      slideRelsMap: new Map<string, Map<string, string>>(),
      externalRelsMap: new Map<string, Set<string>>(),
      readFlipState: () => ({}),
      parseTableData: () => undefined,
      parseMediaData: () => ({}),
      parseElementActions: () => ({}),
      inspectGraphicFrameCompatibility: () => {},
    };
  }

  function makeFrameXml(skewX?: string, skewY?: string): XmlObject {
    const xfrm: XmlObject = {
      "a:off": { "@_x": "0", "@_y": "0" },
      "a:ext": { "@_cx": String(200 * EMU_PER_PX), "@_cy": String(100 * EMU_PER_PX) },
    };
    if (skewX) xfrm["@_skewX"] = skewX;
    if (skewY) xfrm["@_skewY"] = skewY;

    return {
      "p:nvGraphicFramePr": {
        "p:cNvPr": { "@_id": "1", "@_name": "Table 1" },
        "p:cNvGraphicFramePr": {},
        "p:nvPr": {},
      },
      "p:xfrm": xfrm,
      "a:graphic": {
        "a:graphicData": {
          "@_uri": "http://schemas.openxmlformats.org/drawingml/2006/table",
          "a:tbl": {},
        },
      },
    };
  }

  it("parses skewX from graphic frame transform", () => {
    const parser = new PptxGraphicFrameParser(makeFrameContext());
    const xml = makeFrameXml("600000"); // 10 degrees
    const result = parser.parseGraphicFrame(xml, "gf1");
    expect(result).not.toBeNull();
    expect(result!.skewX).toBe(10);
  });

  it("parses both skewX and skewY from graphic frame", () => {
    const parser = new PptxGraphicFrameParser(makeFrameContext());
    const xml = makeFrameXml("1200000", "2400000"); // 20 and 40 degrees
    const result = parser.parseGraphicFrame(xml, "gf1");
    expect(result).not.toBeNull();
    expect(result!.skewX).toBe(20);
    expect(result!.skewY).toBe(40);
  });

  it("returns undefined skew when attributes absent on graphic frame", () => {
    const parser = new PptxGraphicFrameParser(makeFrameContext());
    const xml = makeFrameXml();
    const result = parser.parseGraphicFrame(xml, "gf1");
    expect(result).not.toBeNull();
    expect(result!.skewX).toBeUndefined();
    expect(result!.skewY).toBeUndefined();
  });
});
