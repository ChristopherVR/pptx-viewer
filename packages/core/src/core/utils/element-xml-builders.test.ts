import { describe, it, expect } from "vitest";
import {
  createTemplateShapeRawXml,
  createTemplateConnectorRawXml,
} from "./element-xml-builders";
import type {
  PptxElementWithText,
  ConnectorPptxElement,
  XmlObject,
} from "../types";
import { EMU_PER_PX } from "../constants";

// ---------------------------------------------------------------------------
// createTemplateShapeRawXml
// ---------------------------------------------------------------------------

describe("createTemplateShapeRawXml", () => {
  const baseElement: PptxElementWithText = {
    type: "shape",
    id: "s1",
    x: 100,
    y: 200,
    width: 300,
    height: 150,
    shapeType: "rect",
    text: "Hello",
  } as PptxElementWithText;

  it("sets correct EMU position values", () => {
    const xml = createTemplateShapeRawXml(baseElement);
    const off = (xml["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    const aOff = off["a:off"] as XmlObject;
    expect(aOff["@_x"]).toBe(String(Math.round(100 * EMU_PER_PX)));
    expect(aOff["@_y"]).toBe(String(Math.round(200 * EMU_PER_PX)));
  });

  it("sets correct EMU size values", () => {
    const xml = createTemplateShapeRawXml(baseElement);
    const xfrm = (xml["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    const ext = xfrm["a:ext"] as XmlObject;
    expect(ext["@_cx"]).toBe(String(Math.round(300 * EMU_PER_PX)));
    expect(ext["@_cy"]).toBe(String(Math.round(150 * EMU_PER_PX)));
  });

  it("sets txBox to 1 for text type", () => {
    const el = { ...baseElement, type: "text" } as PptxElementWithText;
    const xml = createTemplateShapeRawXml(el);
    const cNvSpPr = (xml["p:nvSpPr"] as XmlObject)["p:cNvSpPr"] as XmlObject;
    expect(cNvSpPr["@_txBox"]).toBe("1");
  });

  it("sets txBox to 0 for shape type", () => {
    const xml = createTemplateShapeRawXml(baseElement);
    const cNvSpPr = (xml["p:nvSpPr"] as XmlObject)["p:cNvSpPr"] as XmlObject;
    expect(cNvSpPr["@_txBox"]).toBe("0");
  });

  it("maps cylinder shapeType to can geometry", () => {
    const el = { ...baseElement, shapeType: "cylinder" } as PptxElementWithText;
    const xml = createTemplateShapeRawXml(el);
    const prstGeom = (xml["p:spPr"] as XmlObject)["a:prstGeom"] as XmlObject;
    expect(prstGeom["@_prst"]).toBe("can");
  });

  it("uses rect as default geometry when shapeType is empty", () => {
    const el = { ...baseElement, shapeType: "" } as PptxElementWithText;
    const xml = createTemplateShapeRawXml(el);
    const prstGeom = (xml["p:spPr"] as XmlObject)["a:prstGeom"] as XmlObject;
    expect(prstGeom["@_prst"]).toBe("rect");
  });

  it("includes text content in body", () => {
    const xml = createTemplateShapeRawXml(baseElement);
    const txBody = xml["p:txBody"] as XmlObject;
    const paragraphs = txBody["a:p"] as XmlObject[];
    const run = paragraphs[0]["a:r"] as XmlObject;
    expect((run["a:t"] as string)).toBe("Hello");
  });

  it("includes shape adjustment values when present", () => {
    const el = {
      ...baseElement,
      shapeAdjustments: { adj1: 25000, adj2: 50000 },
    } as PptxElementWithText;
    const xml = createTemplateShapeRawXml(el);
    const prstGeom = (xml["p:spPr"] as XmlObject)["a:prstGeom"] as XmlObject;
    const avLst = prstGeom["a:avLst"] as XmlObject;
    const gds = avLst["a:gd"] as XmlObject[];
    expect(gds).toHaveLength(2);
    expect(gds[0]["@_name"]).toBe("adj1");
    expect(gds[0]["@_fmla"]).toBe("val 25000");
  });

  it("sets flipH when flipHorizontal is true", () => {
    const el = { ...baseElement, flipHorizontal: true } as PptxElementWithText;
    const xml = createTemplateShapeRawXml(el);
    const xfrm = (xml["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    expect(xfrm["@_flipH"]).toBe("1");
  });
});

// ---------------------------------------------------------------------------
// createTemplateConnectorRawXml
// ---------------------------------------------------------------------------

describe("createTemplateConnectorRawXml", () => {
  const baseConnector: ConnectorPptxElement = {
    type: "connector",
    id: "c1",
    x: 50,
    y: 60,
    width: 200,
    height: 10,
    shapeType: "connector",
  } as ConnectorPptxElement;

  it("defaults to straightConnector1 geometry for generic connector", () => {
    const xml = createTemplateConnectorRawXml(baseConnector);
    const prstGeom = (xml["p:spPr"] as XmlObject)["a:prstGeom"] as XmlObject;
    expect(prstGeom["@_prst"]).toBe("straightConnector1");
  });

  it("uses custom shapeType when set", () => {
    const el = { ...baseConnector, shapeType: "bentConnector3" } as ConnectorPptxElement;
    const xml = createTemplateConnectorRawXml(el);
    const prstGeom = (xml["p:spPr"] as XmlObject)["a:prstGeom"] as XmlObject;
    expect(prstGeom["@_prst"]).toBe("bentConnector3");
  });

  it("sets correct EMU position", () => {
    const xml = createTemplateConnectorRawXml(baseConnector);
    const xfrm = (xml["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    const off = xfrm["a:off"] as XmlObject;
    expect(off["@_x"]).toBe(String(Math.round(50 * EMU_PER_PX)));
    expect(off["@_y"]).toBe(String(Math.round(60 * EMU_PER_PX)));
  });

  it("applies stroke width from shapeStyle", () => {
    const el = {
      ...baseConnector,
      shapeStyle: { strokeWidth: 3 },
    } as ConnectorPptxElement;
    const xml = createTemplateConnectorRawXml(el);
    const ln = (xml["p:spPr"] as XmlObject)["a:ln"] as XmlObject;
    expect(ln["@_w"]).toBe(String(Math.round(3 * EMU_PER_PX)));
  });

  it("includes head arrow when connectorStartArrow is set", () => {
    const el = {
      ...baseConnector,
      shapeStyle: { connectorStartArrow: "triangle" },
    } as ConnectorPptxElement;
    const xml = createTemplateConnectorRawXml(el);
    const ln = (xml["p:spPr"] as XmlObject)["a:ln"] as XmlObject;
    expect(ln["a:headEnd"]).toBeDefined();
    expect((ln["a:headEnd"] as XmlObject)["@_type"]).toBe("triangle");
  });

  it("includes tail arrow when connectorEndArrow is set", () => {
    const el = {
      ...baseConnector,
      shapeStyle: { connectorEndArrow: "stealth" },
    } as ConnectorPptxElement;
    const xml = createTemplateConnectorRawXml(el);
    const ln = (xml["p:spPr"] as XmlObject)["a:ln"] as XmlObject;
    expect(ln["a:tailEnd"]).toBeDefined();
    expect((ln["a:tailEnd"] as XmlObject)["@_type"]).toBe("stealth");
  });
});
