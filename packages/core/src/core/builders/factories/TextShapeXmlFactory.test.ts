import { describe, it, expect } from "vitest";
import { TextShapeXmlFactory } from "./TextShapeXmlFactory";
import type { PptxBuilderFactoryContext } from "./types";
import type { PptxElementWithText, XmlObject } from "../../types";

/**
 * Minimal factory context for testing.
 */
function createMockContext(overrides?: Partial<PptxBuilderFactoryContext>): PptxBuilderFactoryContext {
  let nextId = 100;
  return {
    emuPerPx: 9525,
    getNextId: () => nextId++,
    normalizePresetGeometry: (shapeType) => {
      if (shapeType === "cylinder") return "can";
      return shapeType || "rect";
    },
    toDrawingTextVerticalAlign: (value) => {
      if (value === "middle") return "ctr";
      if (value === "bottom") return "b";
      return undefined;
    },
    ...overrides,
  };
}

function createTextElement(overrides?: Partial<PptxElementWithText>): PptxElementWithText {
  return {
    type: "text",
    id: "t1",
    x: 100,
    y: 200,
    width: 400,
    height: 300,
    text: "Hello World",
    ...overrides,
  } as PptxElementWithText;
}

// ---------------------------------------------------------------------------
// TextShapeXmlFactory
// ---------------------------------------------------------------------------

describe("TextShapeXmlFactory", () => {
  it("creates a valid p:sp XML object", () => {
    const factory = new TextShapeXmlFactory(createMockContext());
    const result = factory.createXmlElement({ element: createTextElement() });
    expect(result["p:nvSpPr"]).toBeDefined();
    expect(result["p:spPr"]).toBeDefined();
    expect(result["p:txBody"]).toBeDefined();
  });

  it("sets txBox=1 for text elements", () => {
    const factory = new TextShapeXmlFactory(createMockContext());
    const result = factory.createXmlElement({ element: createTextElement({ type: "text" }) });
    const nvSpPr = result["p:nvSpPr"] as XmlObject;
    const cNvSpPr = nvSpPr["p:cNvSpPr"] as XmlObject;
    expect(cNvSpPr["@_txBox"]).toBe("1");
  });

  it("sets txBox=0 for shape elements", () => {
    const factory = new TextShapeXmlFactory(createMockContext());
    const el = createTextElement({ type: "shape" });
    const result = factory.createXmlElement({ element: el });
    const nvSpPr = result["p:nvSpPr"] as XmlObject;
    const cNvSpPr = nvSpPr["p:cNvSpPr"] as XmlObject;
    expect(cNvSpPr["@_txBox"]).toBe("0");
  });

  it("converts position and size to EMU", () => {
    const factory = new TextShapeXmlFactory(createMockContext());
    const el = createTextElement({ x: 10, y: 20, width: 100, height: 50 });
    const result = factory.createXmlElement({ element: el });
    const spPr = result["p:spPr"] as XmlObject;
    const xfrm = spPr["a:xfrm"] as XmlObject;
    const off = xfrm["a:off"] as XmlObject;
    const ext = xfrm["a:ext"] as XmlObject;
    expect(off["@_x"]).toBe(String(Math.round(10 * 9525)));
    expect(off["@_y"]).toBe(String(Math.round(20 * 9525)));
    expect(ext["@_cx"]).toBe(String(Math.round(100 * 9525)));
    expect(ext["@_cy"]).toBe(String(Math.round(50 * 9525)));
  });

  it("uses sequential IDs from context", () => {
    const ctx = createMockContext();
    const factory = new TextShapeXmlFactory(ctx);
    const r1 = factory.createXmlElement({ element: createTextElement() });
    const r2 = factory.createXmlElement({ element: createTextElement() });
    const id1 = (r1["p:nvSpPr"] as XmlObject)["p:cNvPr"]["@_id"];
    const id2 = (r2["p:nvSpPr"] as XmlObject)["p:cNvPr"]["@_id"];
    expect(id1).not.toBe(id2);
  });

  it("includes text content in the text body", () => {
    const factory = new TextShapeXmlFactory(createMockContext());
    const result = factory.createXmlElement({ element: createTextElement({ text: "Test text" }) });
    const txBody = result["p:txBody"] as XmlObject;
    const paragraphs = txBody["a:p"] as XmlObject[];
    const run = paragraphs[0]["a:r"] as XmlObject;
    expect(run["a:t"]).toBe("Test text");
  });

  it("normalizes preset geometry using context", () => {
    const factory = new TextShapeXmlFactory(createMockContext());
    const el = createTextElement({ shapeType: "cylinder" } as Partial<PptxElementWithText>);
    const result = factory.createXmlElement({ element: el });
    const spPr = result["p:spPr"] as XmlObject;
    const prstGeom = spPr["a:prstGeom"] as XmlObject;
    expect(prstGeom["@_prst"]).toBe("can");
  });

  it("defaults geometry to rect when shapeType is undefined", () => {
    const factory = new TextShapeXmlFactory(createMockContext());
    const el = createTextElement({ shapeType: undefined } as Partial<PptxElementWithText>);
    const result = factory.createXmlElement({ element: el });
    const spPr = result["p:spPr"] as XmlObject;
    const prstGeom = spPr["a:prstGeom"] as XmlObject;
    expect(prstGeom["@_prst"]).toBe("rect");
  });

  it("includes adjustment values when present", () => {
    const factory = new TextShapeXmlFactory(createMockContext());
    const el = createTextElement({
      shapeType: "roundRect",
      shapeAdjustments: { adj: 50000 },
    } as Partial<PptxElementWithText>);
    const result = factory.createXmlElement({ element: el });
    const spPr = result["p:spPr"] as XmlObject;
    const avLst = (spPr["a:prstGeom"] as XmlObject)["a:avLst"] as XmlObject;
    expect(avLst["a:gd"]).toBeDefined();
    const gd = (avLst["a:gd"] as XmlObject[])[0];
    expect(gd["@_name"]).toBe("adj");
    expect(gd["@_fmla"]).toBe("val 50000");
  });

  it("sets rotation when present", () => {
    const factory = new TextShapeXmlFactory(createMockContext());
    const el = createTextElement({ rotation: 45 });
    const result = factory.createXmlElement({ element: el });
    const spPr = result["p:spPr"] as XmlObject;
    const xfrm = spPr["a:xfrm"] as XmlObject;
    // 45 degrees * 60000 = 2700000
    expect(xfrm["@_rot"]).toBe(String(Math.round(45 * 60000)));
  });

  it("sets flipH and flipV when present", () => {
    const factory = new TextShapeXmlFactory(createMockContext());
    const el = createTextElement({ flipHorizontal: true, flipVertical: true });
    const result = factory.createXmlElement({ element: el });
    const spPr = result["p:spPr"] as XmlObject;
    const xfrm = spPr["a:xfrm"] as XmlObject;
    expect(xfrm["@_flipH"]).toBe("1");
    expect(xfrm["@_flipV"]).toBe("1");
  });

  it("omits rotation, flipH, flipV when not set", () => {
    const factory = new TextShapeXmlFactory(createMockContext());
    const el = createTextElement({ rotation: undefined, flipHorizontal: false, flipVertical: false });
    const result = factory.createXmlElement({ element: el });
    const spPr = result["p:spPr"] as XmlObject;
    const xfrm = spPr["a:xfrm"] as XmlObject;
    expect(xfrm["@_rot"]).toBeUndefined();
    expect(xfrm["@_flipH"]).toBeUndefined();
    expect(xfrm["@_flipV"]).toBeUndefined();
  });

  it("sets vertical text alignment from textStyle.vAlign", () => {
    const factory = new TextShapeXmlFactory(createMockContext());
    const el = createTextElement({
      textStyle: { vAlign: "middle" },
    } as Partial<PptxElementWithText>);
    const result = factory.createXmlElement({ element: el });
    const txBody = result["p:txBody"] as XmlObject;
    const bodyPr = txBody["a:bodyPr"] as XmlObject;
    expect(bodyPr["@_anchor"]).toBe("ctr");
  });
});
