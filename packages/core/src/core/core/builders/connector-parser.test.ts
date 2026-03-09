import { describe, it, expect, vi } from "vitest";
import {
  PptxConnectorParser,
  type PptxConnectorParserContext,
} from "./PptxConnectorParser";
import type { XmlObject, ShapeStyle } from "../../types";

const EMU_PER_PX = 9525;

function makeContext(
  overrides: Partial<PptxConnectorParserContext> = {},
): PptxConnectorParserContext {
  return {
    emuPerPx: EMU_PER_PX,
    getOrderedSlidePaths: () => ["ppt/slides/slide1.xml"],
    slideRelsMap: new Map(),
    parseGeometryAdjustments: () => undefined,
    readFlipState: () => ({}),
    extractShapeStyle: (spPr) => {
      const style: ShapeStyle = {};
      const ln = spPr?.["a:ln"] as XmlObject | undefined;
      if (ln) {
        const w = ln["@_w"];
        if (w) style.strokeWidth = parseInt(String(w), 10) / EMU_PER_PX;
        const solidFill = ln["a:solidFill"] as XmlObject | undefined;
        if (solidFill?.["a:srgbClr"]) {
          style.strokeColor = `#${solidFill["a:srgbClr"]["@_val"]}`;
        }
        const dash = ln["a:prstDash"] as XmlObject | undefined;
        if (dash?.["@_val"]) {
          style.strokeDash = dash["@_val"];
        }
        const headEnd = ln["a:headEnd"] as XmlObject | undefined;
        if (headEnd?.["@_type"]) {
          style.connectorStartArrow = headEnd["@_type"];
          if (headEnd["@_w"]) style.connectorStartArrowWidth = headEnd["@_w"];
          if (headEnd["@_len"]) style.connectorStartArrowLength = headEnd["@_len"];
        }
        const tailEnd = ln["a:tailEnd"] as XmlObject | undefined;
        if (tailEnd?.["@_type"]) {
          style.connectorEndArrow = tailEnd["@_type"];
          if (tailEnd["@_w"]) style.connectorEndArrowWidth = tailEnd["@_w"];
          if (tailEnd["@_len"]) style.connectorEndArrowLength = tailEnd["@_len"];
        }
      }
      return style;
    },
    parseShapeLocks: () => undefined,
    parseElementActions: () => ({}),
    ...overrides,
  };
}

function makeStraightConnectorXml(opts: {
  x?: string;
  y?: string;
  cx?: string;
  cy?: string;
  prst?: string;
  rot?: string;
  stCxnId?: string;
  stCxnIdx?: string;
  endCxnId?: string;
  endCxnIdx?: string;
  lineProps?: XmlObject;
}): XmlObject {
  const xfrm: XmlObject = {
    "a:off": { "@_x": opts.x || "0", "@_y": opts.y || "0" },
    "a:ext": { "@_cx": opts.cx || "914400", "@_cy": opts.cy || "0" },
  };
  if (opts.rot) xfrm["@_rot"] = opts.rot;

  const spPr: XmlObject = {
    "a:xfrm": xfrm,
    "a:prstGeom": { "@_prst": opts.prst || "straightConnector1" },
  };
  if (opts.lineProps) {
    spPr["a:ln"] = opts.lineProps;
  }

  const cNvCxnSpPr: XmlObject = {};
  if (opts.stCxnId || opts.stCxnIdx) {
    const stCxn: XmlObject = {};
    if (opts.stCxnId) stCxn["@_id"] = opts.stCxnId;
    if (opts.stCxnIdx) stCxn["@_idx"] = opts.stCxnIdx;
    cNvCxnSpPr["a:stCxn"] = stCxn;
  }
  if (opts.endCxnId || opts.endCxnIdx) {
    const endCxn: XmlObject = {};
    if (opts.endCxnId) endCxn["@_id"] = opts.endCxnId;
    if (opts.endCxnIdx) endCxn["@_idx"] = opts.endCxnIdx;
    cNvCxnSpPr["a:endCxn"] = endCxn;
  }

  return {
    "p:nvCxnSpPr": {
      "p:cNvPr": { "@_id": "10", "@_name": "Connector 10" },
      "p:cNvCxnSpPr": cNvCxnSpPr,
    },
    "p:spPr": spPr,
  };
}

// ---------------------------------------------------------------------------
// Straight connector parsing
// ---------------------------------------------------------------------------

describe("PptxConnectorParser — connector type detection", () => {
  it("parses straightConnector1 as connector type", () => {
    const xml = makeStraightConnectorXml({ prst: "straightConnector1" });
    const parser = new PptxConnectorParser(makeContext());
    const result = parser.parseConnector(xml, "cxn_1");

    expect(result).not.toBeNull();
    expect(result!.type).toBe("connector");
    expect(result!.shapeType).toBe("straightConnector1");
  });

  it("parses bentConnector3 shape type", () => {
    const xml = makeStraightConnectorXml({ prst: "bentConnector3" });
    const parser = new PptxConnectorParser(makeContext());
    const result = parser.parseConnector(xml, "cxn_2");

    expect(result).not.toBeNull();
    expect(result!.shapeType).toBe("bentConnector3");
  });

  it("parses curvedConnector3 shape type", () => {
    const xml = makeStraightConnectorXml({ prst: "curvedConnector3" });
    const parser = new PptxConnectorParser(makeContext());
    const result = parser.parseConnector(xml, "cxn_3");

    expect(result).not.toBeNull();
    expect(result!.shapeType).toBe("curvedConnector3");
  });

  it("defaults to straightConnector1 when prst is missing", () => {
    const xml: XmlObject = {
      "p:nvCxnSpPr": {
        "p:cNvPr": { "@_id": "5", "@_name": "Connector 5" },
        "p:cNvCxnSpPr": {},
      },
      "p:spPr": {
        "a:xfrm": {
          "a:off": { "@_x": "0", "@_y": "0" },
          "a:ext": { "@_cx": "914400", "@_cy": "0" },
        },
        "a:prstGeom": {},
      },
    };
    const parser = new PptxConnectorParser(makeContext());
    const result = parser.parseConnector(xml, "cxn_5");

    expect(result).not.toBeNull();
    expect(result!.shapeType).toBe("straightConnector1");
  });
});

// ---------------------------------------------------------------------------
// Connection point references (stCxn, endCxn)
// ---------------------------------------------------------------------------

describe("PptxConnectorParser — connection point references", () => {
  it("extracts start connection point with shapeId and idx", () => {
    const xml = makeStraightConnectorXml({
      stCxnId: "42",
      stCxnIdx: "2",
    });
    const parser = new PptxConnectorParser(makeContext());
    const result = parser.parseConnector(xml, "cxn_10");

    expect(result).not.toBeNull();
    expect(result!.shapeStyle).toBeDefined();
    expect(result!.shapeStyle!.connectorStartConnection).toEqual({
      shapeId: "42",
      connectionSiteIndex: 2,
    });
  });

  it("extracts end connection point with shapeId and idx", () => {
    const xml = makeStraightConnectorXml({
      endCxnId: "99",
      endCxnIdx: "0",
    });
    const parser = new PptxConnectorParser(makeContext());
    const result = parser.parseConnector(xml, "cxn_11");

    expect(result).not.toBeNull();
    expect(result!.shapeStyle!.connectorEndConnection).toEqual({
      shapeId: "99",
      connectionSiteIndex: 0,
    });
  });

  it("extracts both start and end connection points", () => {
    const xml = makeStraightConnectorXml({
      stCxnId: "10",
      stCxnIdx: "3",
      endCxnId: "20",
      endCxnIdx: "1",
    });
    const parser = new PptxConnectorParser(makeContext());
    const result = parser.parseConnector(xml, "cxn_12");

    expect(result).not.toBeNull();
    expect(result!.shapeStyle!.connectorStartConnection).toEqual({
      shapeId: "10",
      connectionSiteIndex: 3,
    });
    expect(result!.shapeStyle!.connectorEndConnection).toEqual({
      shapeId: "20",
      connectionSiteIndex: 1,
    });
  });
});

// ---------------------------------------------------------------------------
// Arrow type and size extraction
// ---------------------------------------------------------------------------

describe("PptxConnectorParser — arrow type and size", () => {
  it("extracts tail end arrow type (triangle) and size", () => {
    const xml = makeStraightConnectorXml({
      lineProps: {
        "@_w": "12700",
        "a:tailEnd": { "@_type": "triangle", "@_w": "med", "@_len": "med" },
      },
    });
    const parser = new PptxConnectorParser(makeContext());
    const result = parser.parseConnector(xml, "cxn_20");

    expect(result).not.toBeNull();
    expect(result!.shapeStyle!.connectorEndArrow).toBe("triangle");
    expect(result!.shapeStyle!.connectorEndArrowWidth).toBe("med");
    expect(result!.shapeStyle!.connectorEndArrowLength).toBe("med");
  });

  it("extracts head end arrow type (stealth) with small size", () => {
    const xml = makeStraightConnectorXml({
      lineProps: {
        "@_w": "12700",
        "a:headEnd": { "@_type": "stealth", "@_w": "sm", "@_len": "sm" },
      },
    });
    const parser = new PptxConnectorParser(makeContext());
    const result = parser.parseConnector(xml, "cxn_21");

    expect(result).not.toBeNull();
    expect(result!.shapeStyle!.connectorStartArrow).toBe("stealth");
    expect(result!.shapeStyle!.connectorStartArrowWidth).toBe("sm");
    expect(result!.shapeStyle!.connectorStartArrowLength).toBe("sm");
  });
});

// ---------------------------------------------------------------------------
// Line width, color, and dash pattern
// ---------------------------------------------------------------------------

describe("PptxConnectorParser — line width, color, dash pattern", () => {
  it("extracts line width and color", () => {
    const xml = makeStraightConnectorXml({
      lineProps: {
        "@_w": "25400",
        "a:solidFill": {
          "a:srgbClr": { "@_val": "FF0000" },
        },
      },
    });
    const parser = new PptxConnectorParser(makeContext());
    const result = parser.parseConnector(xml, "cxn_30");

    expect(result).not.toBeNull();
    expect(result!.shapeStyle!.strokeWidth).toBeCloseTo(25400 / EMU_PER_PX, 1);
    expect(result!.shapeStyle!.strokeColor).toBe("#FF0000");
  });

  it("extracts dash pattern", () => {
    const xml = makeStraightConnectorXml({
      lineProps: {
        "@_w": "12700",
        "a:prstDash": { "@_val": "dash" },
      },
    });
    const parser = new PptxConnectorParser(makeContext());
    const result = parser.parseConnector(xml, "cxn_31");

    expect(result).not.toBeNull();
    expect(result!.shapeStyle!.strokeDash).toBe("dash");
  });
});

// ---------------------------------------------------------------------------
// Position, size, rotation
// ---------------------------------------------------------------------------

describe("PptxConnectorParser — position and rotation", () => {
  it("converts EMU position and size to pixels", () => {
    // 914400 EMU = 96 px at 9525 EMU/px
    const xml = makeStraightConnectorXml({
      x: "914400",
      y: "457200",
      cx: "1828800",
      cy: "914400",
    });
    const parser = new PptxConnectorParser(makeContext());
    const result = parser.parseConnector(xml, "cxn_40");

    expect(result).not.toBeNull();
    expect(result!.x).toBe(Math.round(914400 / EMU_PER_PX));
    expect(result!.y).toBe(Math.round(457200 / EMU_PER_PX));
    expect(result!.width).toBe(Math.round(1828800 / EMU_PER_PX));
    expect(result!.height).toBe(Math.round(914400 / EMU_PER_PX));
  });

  it("parses rotation from @_rot (60000ths of degree)", () => {
    // 5400000 = 90 degrees
    const xml = makeStraightConnectorXml({ rot: "5400000" });
    const parser = new PptxConnectorParser(makeContext());
    const result = parser.parseConnector(xml, "cxn_41");

    expect(result).not.toBeNull();
    expect(result!.rotation).toBe(90);
  });

  it("returns null when transform is missing", () => {
    const xml: XmlObject = {
      "p:nvCxnSpPr": {
        "p:cNvPr": { "@_id": "5", "@_name": "Connector 5" },
        "p:cNvCxnSpPr": {},
      },
      "p:spPr": {},
    };
    const parser = new PptxConnectorParser(makeContext());
    const result = parser.parseConnector(xml, "cxn_42");

    expect(result).toBeNull();
  });

  it("returns null when offset or extent is missing", () => {
    const xml: XmlObject = {
      "p:nvCxnSpPr": {
        "p:cNvPr": { "@_id": "5", "@_name": "Connector 5" },
        "p:cNvCxnSpPr": {},
      },
      "p:spPr": {
        "a:xfrm": {
          "a:off": { "@_x": "0", "@_y": "0" },
          // missing a:ext
        },
      },
    };
    const parser = new PptxConnectorParser(makeContext());
    const result = parser.parseConnector(xml, "cxn_43");

    expect(result).toBeNull();
  });

  it("reads flip state from context", () => {
    const xml = makeStraightConnectorXml({});
    const parser = new PptxConnectorParser(
      makeContext({
        readFlipState: () => ({ flipHorizontal: true, flipVertical: false }),
      }),
    );
    const result = parser.parseConnector(xml, "cxn_44");

    expect(result).not.toBeNull();
    expect(result!.flipHorizontal).toBe(true);
    expect(result!.flipVertical).toBe(false);
  });

  it("parses connector text body when parseConnectorTextBody is provided", () => {
    const xml = makeStraightConnectorXml({});
    (xml as XmlObject)["p:txBody"] = {
      "a:bodyPr": {},
      "a:p": { "a:r": { "a:t": "Label" } },
    };

    const parser = new PptxConnectorParser(
      makeContext({
        parseConnectorTextBody: () => ({
          text: "Label",
          textStyle: { fontSize: 12 },
          textSegments: [{ text: "Label", style: { fontSize: 12 } }],
        }),
      }),
    );
    const result = parser.parseConnector(xml, "cxn_45");

    expect(result).not.toBeNull();
    expect(result!.text).toBe("Label");
    expect(result!.textStyle).toEqual({ fontSize: 12 });
    expect(result!.textSegments).toHaveLength(1);
  });
});
