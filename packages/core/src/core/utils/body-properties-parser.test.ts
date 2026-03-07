import { describe, it, expect } from "vitest";
import {
  parseBodyPrBooleanAttrs,
  writeBodyPrBooleanAttrs,
} from "./body-properties-parser";
import type { TextStyle, XmlObject } from "../types";
import type { PptxLayoutOption, PptxData } from "../types";

// ---------------------------------------------------------------------------
// parseBodyPrBooleanAttrs
// ---------------------------------------------------------------------------

describe("parseBodyPrBooleanAttrs", () => {
  it("does nothing when attributes are absent", () => {
    const textStyle: TextStyle = {};
    parseBodyPrBooleanAttrs({}, textStyle);
    expect(textStyle.compatibleLineSpacing).toBeUndefined();
    expect(textStyle.forceAntiAlias).toBeUndefined();
    expect(textStyle.upright).toBeUndefined();
    expect(textStyle.fromWordArt).toBeUndefined();
  });

  it('parses @_compatLnSpc = "1" as true', () => {
    const textStyle: TextStyle = {};
    parseBodyPrBooleanAttrs({ "@_compatLnSpc": "1" }, textStyle);
    expect(textStyle.compatibleLineSpacing).toBe(true);
  });

  it('parses @_compatLnSpc = "0" as false', () => {
    const textStyle: TextStyle = {};
    parseBodyPrBooleanAttrs({ "@_compatLnSpc": "0" }, textStyle);
    expect(textStyle.compatibleLineSpacing).toBe(false);
  });

  it('parses @_compatLnSpc = "true" as true', () => {
    const textStyle: TextStyle = {};
    parseBodyPrBooleanAttrs({ "@_compatLnSpc": "true" }, textStyle);
    expect(textStyle.compatibleLineSpacing).toBe(true);
  });

  it('parses @_forceAA = "1" as true', () => {
    const textStyle: TextStyle = {};
    parseBodyPrBooleanAttrs({ "@_forceAA": "1" }, textStyle);
    expect(textStyle.forceAntiAlias).toBe(true);
  });

  it('parses @_forceAA = "0" as false', () => {
    const textStyle: TextStyle = {};
    parseBodyPrBooleanAttrs({ "@_forceAA": "0" }, textStyle);
    expect(textStyle.forceAntiAlias).toBe(false);
  });

  it('parses @_upright = "1" as true', () => {
    const textStyle: TextStyle = {};
    parseBodyPrBooleanAttrs({ "@_upright": "1" }, textStyle);
    expect(textStyle.upright).toBe(true);
  });

  it('parses @_upright = "0" as false', () => {
    const textStyle: TextStyle = {};
    parseBodyPrBooleanAttrs({ "@_upright": "0" }, textStyle);
    expect(textStyle.upright).toBe(false);
  });

  it('parses @_fromWordArt = "1" as true', () => {
    const textStyle: TextStyle = {};
    parseBodyPrBooleanAttrs({ "@_fromWordArt": "1" }, textStyle);
    expect(textStyle.fromWordArt).toBe(true);
  });

  it("handles all attributes set simultaneously", () => {
    const textStyle: TextStyle = {};
    parseBodyPrBooleanAttrs(
      {
        "@_compatLnSpc": "1",
        "@_forceAA": "0",
        "@_upright": "true",
        "@_fromWordArt": "1",
      },
      textStyle,
    );
    expect(textStyle.compatibleLineSpacing).toBe(true);
    expect(textStyle.forceAntiAlias).toBe(false);
    expect(textStyle.upright).toBe(true);
    expect(textStyle.fromWordArt).toBe(true);
  });

  it("ignores undefined attributes and does not set them to false", () => {
    const textStyle: TextStyle = { compatibleLineSpacing: true };
    parseBodyPrBooleanAttrs({ "@_forceAA": "1" }, textStyle);
    // compatibleLineSpacing was already set and should remain unchanged
    expect(textStyle.compatibleLineSpacing).toBe(true);
    expect(textStyle.forceAntiAlias).toBe(true);
    // These were never in bodyPr, so they must remain undefined
    expect(textStyle.upright).toBeUndefined();
    expect(textStyle.fromWordArt).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// writeBodyPrBooleanAttrs
// ---------------------------------------------------------------------------

describe("writeBodyPrBooleanAttrs", () => {
  it("does nothing when textStyle is undefined", () => {
    const bodyPr: XmlObject = {};
    writeBodyPrBooleanAttrs(bodyPr, undefined);
    expect(Object.keys(bodyPr)).toHaveLength(0);
  });

  it('writes compatLnSpc = "1" for true', () => {
    const bodyPr: XmlObject = {};
    writeBodyPrBooleanAttrs(bodyPr, { compatibleLineSpacing: true });
    expect(bodyPr["@_compatLnSpc"]).toBe("1");
  });

  it('writes compatLnSpc = "0" for false', () => {
    const bodyPr: XmlObject = {};
    writeBodyPrBooleanAttrs(bodyPr, { compatibleLineSpacing: false });
    expect(bodyPr["@_compatLnSpc"]).toBe("0");
  });

  it('writes forceAA = "1" for true', () => {
    const bodyPr: XmlObject = {};
    writeBodyPrBooleanAttrs(bodyPr, { forceAntiAlias: true });
    expect(bodyPr["@_forceAA"]).toBe("1");
  });

  it('writes upright = "1" for true', () => {
    const bodyPr: XmlObject = {};
    writeBodyPrBooleanAttrs(bodyPr, { upright: true });
    expect(bodyPr["@_upright"]).toBe("1");
  });

  it('writes fromWordArt = "1" for true', () => {
    const bodyPr: XmlObject = {};
    writeBodyPrBooleanAttrs(bodyPr, { fromWordArt: true });
    expect(bodyPr["@_fromWordArt"]).toBe("1");
  });

  it("does not write attributes when undefined in textStyle", () => {
    const bodyPr: XmlObject = {};
    writeBodyPrBooleanAttrs(bodyPr, {});
    expect(bodyPr["@_compatLnSpc"]).toBeUndefined();
    expect(bodyPr["@_forceAA"]).toBeUndefined();
    expect(bodyPr["@_upright"]).toBeUndefined();
    expect(bodyPr["@_fromWordArt"]).toBeUndefined();
  });

  it("round-trip: parse then write produces same XML attributes", () => {
    const original: XmlObject = {
      "@_compatLnSpc": "1",
      "@_forceAA": "0",
      "@_upright": "1",
      "@_fromWordArt": "0",
    };
    const textStyle: TextStyle = {};
    parseBodyPrBooleanAttrs(original, textStyle);

    const output: XmlObject = {};
    writeBodyPrBooleanAttrs(output, textStyle);

    expect(output["@_compatLnSpc"]).toBe("1");
    expect(output["@_forceAA"]).toBe("0");
    expect(output["@_upright"]).toBe("1");
    expect(output["@_fromWordArt"]).toBe("0");
  });
});

// ---------------------------------------------------------------------------
// GAP-11: PptxLayoutOption.type (Slide Layout Type)
// ---------------------------------------------------------------------------

describe("PptxLayoutOption type contract", () => {
  it("accepts a type string field", () => {
    const layout: PptxLayoutOption = {
      path: "ppt/slideLayouts/slideLayout1.xml",
      name: "Title Slide",
      type: "title",
    };
    expect(layout.type).toBe("title");
  });

  it("type is optional", () => {
    const layout: PptxLayoutOption = {
      path: "ppt/slideLayouts/slideLayout2.xml",
      name: "Blank",
    };
    expect(layout.type).toBeUndefined();
  });

  it("accepts common layout type string values", () => {
    const types = [
      "blank",
      "chart",
      "clipArtAndTx",
      "cust",
      "dgm",
      "fourObj",
      "mediaAndTx",
      "obj",
      "objAndTx",
      "objOnly",
      "objOverTx",
      "objTx",
      "picTx",
      "secHead",
      "tbl",
      "title",
      "titleOnly",
      "twoColTx",
      "twoObj",
      "twoObjAndTx",
      "twoObjOverTx",
      "twoTxTwoObj",
      "tx",
      "txAndChart",
      "txAndClipArt",
      "txAndMedia",
      "txAndObj",
      "txAndTwoObj",
      "txOverObj",
      "vertTitleAndTx",
      "vertTitleAndTxOverChart",
      "vertTx",
    ];
    for (const t of types) {
      const layout: PptxLayoutOption = {
        path: "ppt/slideLayouts/slideLayout1.xml",
        name: "Test",
        type: t,
      };
      expect(layout.type).toBe(t);
    }
  });
});

// ---------------------------------------------------------------------------
// GAP-12: PptxData.slideSizeType (Slide Size Type)
// ---------------------------------------------------------------------------

describe("PptxData slideSizeType contract", () => {
  it("accepts a slideSizeType string field", () => {
    const data: Pick<PptxData, "slideSizeType"> = {
      slideSizeType: "screen4x3",
    };
    expect(data.slideSizeType).toBe("screen4x3");
  });

  it("slideSizeType is optional", () => {
    const data: Pick<PptxData, "slideSizeType"> = {};
    expect(data.slideSizeType).toBeUndefined();
  });

  it("accepts common size type string values", () => {
    const sizeTypes = [
      "screen4x3",
      "screen16x9",
      "screen16x10",
      "letter",
      "ledger",
      "A3",
      "A4",
      "B4ISO",
      "B5ISO",
      "B4JIS",
      "B5JIS",
      "hagakiCard",
      "35mm",
      "overhead",
      "banner",
      "custom",
    ];
    for (const st of sizeTypes) {
      const data: Pick<PptxData, "slideSizeType"> = { slideSizeType: st };
      expect(data.slideSizeType).toBe(st);
    }
  });
});
