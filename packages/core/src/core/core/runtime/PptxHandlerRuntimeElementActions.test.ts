import { describe, it, expect } from "vitest";
import type { XmlObject, PptxAction, PptxElement } from "../../types";

// Extracted logic from PptxHandlerRuntimeElementActions for unit testing.

function getTreeBucketKeyForElementType(type: PptxElement["type"]): string {
  if (type === "picture" || type === "image") return "p:pic";
  if (type === "connector") return "p:cxnSp";
  if (
    type === "table" ||
    type === "chart" ||
    type === "smartArt" ||
    type === "ole" ||
    type === "media"
  ) {
    return "p:graphicFrame";
  }
  return "p:sp";
}

function getCnvPrNode(shape: XmlObject, key: string): XmlObject | undefined {
  if (key === "p:pic") {
    return shape?.["p:nvPicPr"]?.["p:cNvPr"] as XmlObject | undefined;
  }
  if (key === "p:cxnSp") {
    return shape?.["p:nvCxnSpPr"]?.["p:cNvPr"] as XmlObject | undefined;
  }
  if (key === "p:graphicFrame") {
    return shape?.["p:nvGraphicFramePr"]?.["p:cNvPr"] as XmlObject | undefined;
  }
  return shape?.["p:nvSpPr"]?.["p:cNvPr"] as XmlObject | undefined;
}

function serializeSingleAction(
  cNvPr: XmlObject,
  nodeName: string,
  action: PptxAction | undefined,
  resolveHyperlinkRelationshipId: (target: string) => string | undefined,
): void {
  if (!action) {
    delete cNvPr[nodeName];
    return;
  }
  const node: XmlObject = {};
  let rId = action.rId;
  if (!rId && action.url) {
    rId = resolveHyperlinkRelationshipId(action.url) ?? undefined;
  }
  if (rId) {
    node["@_r:id"] = rId;
  }
  if (action.action) {
    node["@_action"] = action.action;
  }
  if (action.tooltip) {
    node["@_tooltip"] = action.tooltip;
  }
  if (action.highlightClick) {
    node["@_highlightClick"] = "1";
  }
  const soundRId = action.soundRId;
  if (soundRId) {
    node["a:snd"] = {
      "@_r:embed": soundRId,
    };
  }
  cNvPr[nodeName] = node;
}

// ---------------------------------------------------------------------------
// getTreeBucketKeyForElementType
// ---------------------------------------------------------------------------
describe("getTreeBucketKeyForElementType", () => {
  it('should return "p:pic" for "picture"', () => {
    expect(getTreeBucketKeyForElementType("picture" as PptxElement["type"])).toBe("p:pic");
  });

  it('should return "p:pic" for "image"', () => {
    expect(getTreeBucketKeyForElementType("image" as PptxElement["type"])).toBe("p:pic");
  });

  it('should return "p:cxnSp" for "connector"', () => {
    expect(getTreeBucketKeyForElementType("connector")).toBe("p:cxnSp");
  });

  it('should return "p:graphicFrame" for "table"', () => {
    expect(getTreeBucketKeyForElementType("table")).toBe("p:graphicFrame");
  });

  it('should return "p:graphicFrame" for "chart"', () => {
    expect(getTreeBucketKeyForElementType("chart")).toBe("p:graphicFrame");
  });

  it('should return "p:graphicFrame" for "smartArt"', () => {
    expect(getTreeBucketKeyForElementType("smartArt")).toBe("p:graphicFrame");
  });

  it('should return "p:graphicFrame" for "ole"', () => {
    expect(getTreeBucketKeyForElementType("ole")).toBe("p:graphicFrame");
  });

  it('should return "p:graphicFrame" for "media"', () => {
    expect(getTreeBucketKeyForElementType("media")).toBe("p:graphicFrame");
  });

  it('should return "p:sp" for "text"', () => {
    expect(getTreeBucketKeyForElementType("text")).toBe("p:sp");
  });

  it('should return "p:sp" for "shape"', () => {
    expect(getTreeBucketKeyForElementType("shape")).toBe("p:sp");
  });

  it('should return "p:sp" for "group"', () => {
    expect(getTreeBucketKeyForElementType("group")).toBe("p:sp");
  });
});

// ---------------------------------------------------------------------------
// getCnvPrNode
// ---------------------------------------------------------------------------
describe("getCnvPrNode", () => {
  it("should resolve p:cNvPr from p:nvSpPr for p:sp key", () => {
    const cNvPr: XmlObject = { "@_id": "1", "@_name": "Shape 1" };
    const shape: XmlObject = {
      "p:nvSpPr": { "p:cNvPr": cNvPr },
    };
    expect(getCnvPrNode(shape, "p:sp")).toBe(cNvPr);
  });

  it("should resolve p:cNvPr from p:nvPicPr for p:pic key", () => {
    const cNvPr: XmlObject = { "@_id": "2", "@_name": "Picture 1" };
    const shape: XmlObject = {
      "p:nvPicPr": { "p:cNvPr": cNvPr },
    };
    expect(getCnvPrNode(shape, "p:pic")).toBe(cNvPr);
  });

  it("should resolve p:cNvPr from p:nvCxnSpPr for p:cxnSp key", () => {
    const cNvPr: XmlObject = { "@_id": "3", "@_name": "Connector 1" };
    const shape: XmlObject = {
      "p:nvCxnSpPr": { "p:cNvPr": cNvPr },
    };
    expect(getCnvPrNode(shape, "p:cxnSp")).toBe(cNvPr);
  });

  it("should resolve p:cNvPr from p:nvGraphicFramePr for p:graphicFrame key", () => {
    const cNvPr: XmlObject = { "@_id": "4", "@_name": "Table 1" };
    const shape: XmlObject = {
      "p:nvGraphicFramePr": { "p:cNvPr": cNvPr },
    };
    expect(getCnvPrNode(shape, "p:graphicFrame")).toBe(cNvPr);
  });

  it("should return undefined when the nv wrapper is missing", () => {
    expect(getCnvPrNode({}, "p:sp")).toBeUndefined();
    expect(getCnvPrNode({}, "p:pic")).toBeUndefined();
    expect(getCnvPrNode({}, "p:cxnSp")).toBeUndefined();
    expect(getCnvPrNode({}, "p:graphicFrame")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// serializeSingleAction
// ---------------------------------------------------------------------------
describe("serializeSingleAction", () => {
  const noopResolver = (_target: string): string | undefined => undefined;

  it("should delete the node when action is undefined", () => {
    const cNvPr: XmlObject = { "a:hlinkClick": { "@_r:id": "rId1" } };
    serializeSingleAction(cNvPr, "a:hlinkClick", undefined, noopResolver);
    expect(cNvPr["a:hlinkClick"]).toBeUndefined();
  });

  it("should write rId directly when provided", () => {
    const cNvPr: XmlObject = {};
    const action: PptxAction = { rId: "rId5" };
    serializeSingleAction(cNvPr, "a:hlinkClick", action, noopResolver);
    const node = cNvPr["a:hlinkClick"] as XmlObject;
    expect(node["@_r:id"]).toBe("rId5");
  });

  it("should resolve rId from url when rId is not provided", () => {
    const cNvPr: XmlObject = {};
    const action: PptxAction = { url: "https://example.com" };
    const resolver = (target: string) =>
      target === "https://example.com" ? "rId10" : undefined;
    serializeSingleAction(cNvPr, "a:hlinkClick", action, resolver);
    const node = cNvPr["a:hlinkClick"] as XmlObject;
    expect(node["@_r:id"]).toBe("rId10");
  });

  it("should not set @_r:id when both rId is undefined and resolver returns undefined", () => {
    const cNvPr: XmlObject = {};
    const action: PptxAction = { url: "https://example.com" };
    serializeSingleAction(cNvPr, "a:hlinkClick", action, noopResolver);
    const node = cNvPr["a:hlinkClick"] as XmlObject;
    expect(node["@_r:id"]).toBeUndefined();
  });

  it("should write action attribute", () => {
    const cNvPr: XmlObject = {};
    const action: PptxAction = { action: "ppaction://hlinksldjump" };
    serializeSingleAction(cNvPr, "a:hlinkClick", action, noopResolver);
    const node = cNvPr["a:hlinkClick"] as XmlObject;
    expect(node["@_action"]).toBe("ppaction://hlinksldjump");
  });

  it("should write tooltip attribute", () => {
    const cNvPr: XmlObject = {};
    const action: PptxAction = { tooltip: "Click here" };
    serializeSingleAction(cNvPr, "a:hlinkClick", action, noopResolver);
    const node = cNvPr["a:hlinkClick"] as XmlObject;
    expect(node["@_tooltip"]).toBe("Click here");
  });

  it("should write highlightClick as '1' when true", () => {
    const cNvPr: XmlObject = {};
    const action: PptxAction = { highlightClick: true };
    serializeSingleAction(cNvPr, "a:hlinkClick", action, noopResolver);
    const node = cNvPr["a:hlinkClick"] as XmlObject;
    expect(node["@_highlightClick"]).toBe("1");
  });

  it("should not write highlightClick when false", () => {
    const cNvPr: XmlObject = {};
    const action: PptxAction = { highlightClick: false };
    serializeSingleAction(cNvPr, "a:hlinkClick", action, noopResolver);
    const node = cNvPr["a:hlinkClick"] as XmlObject;
    expect(node["@_highlightClick"]).toBeUndefined();
  });

  it("should write sound element when soundRId is provided", () => {
    const cNvPr: XmlObject = {};
    const action: PptxAction = { soundRId: "rId20" };
    serializeSingleAction(cNvPr, "a:hlinkClick", action, noopResolver);
    const node = cNvPr["a:hlinkClick"] as XmlObject;
    expect(node["a:snd"]).toEqual({ "@_r:embed": "rId20" });
  });

  it("should not write sound element when soundRId is not provided", () => {
    const cNvPr: XmlObject = {};
    const action: PptxAction = { tooltip: "Test" };
    serializeSingleAction(cNvPr, "a:hlinkClick", action, noopResolver);
    const node = cNvPr["a:hlinkClick"] as XmlObject;
    expect(node["a:snd"]).toBeUndefined();
  });

  it("should handle hlinkHover nodeName", () => {
    const cNvPr: XmlObject = {};
    const action: PptxAction = { rId: "rId3", tooltip: "Hover me" };
    serializeSingleAction(cNvPr, "a:hlinkHover", action, noopResolver);
    const node = cNvPr["a:hlinkHover"] as XmlObject;
    expect(node["@_r:id"]).toBe("rId3");
    expect(node["@_tooltip"]).toBe("Hover me");
  });

  it("should handle fully populated action", () => {
    const cNvPr: XmlObject = {};
    const action: PptxAction = {
      rId: "rId1",
      action: "ppaction://hlinkshowjump?jump=nextslide",
      tooltip: "Next slide",
      highlightClick: true,
      soundRId: "rId30",
    };
    serializeSingleAction(cNvPr, "a:hlinkClick", action, noopResolver);
    const node = cNvPr["a:hlinkClick"] as XmlObject;
    expect(node["@_r:id"]).toBe("rId1");
    expect(node["@_action"]).toBe("ppaction://hlinkshowjump?jump=nextslide");
    expect(node["@_tooltip"]).toBe("Next slide");
    expect(node["@_highlightClick"]).toBe("1");
    expect(node["a:snd"]).toEqual({ "@_r:embed": "rId30" });
  });
});
