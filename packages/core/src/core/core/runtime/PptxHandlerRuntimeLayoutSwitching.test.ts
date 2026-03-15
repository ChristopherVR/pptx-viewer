import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PptxSlide, PptxLayoutOption, XmlObject, PptxElement } from "../../types";
import type { PlaceholderInfo } from "./PptxHandlerRuntimeTypes";

// ── Extracted logic matching PptxHandlerRuntimeLoadPipeline ──────────

function resolvePath(base: string, relative: string): string {
  const baseParts = base.split("/").filter(Boolean);
  const relParts = relative.split("/");
  if (baseParts.length > 0 && !base.endsWith("/")) {
    baseParts.pop();
  }
  for (const part of relParts) {
    if (part === "..") {
      baseParts.pop();
    } else if (part !== ".") {
      baseParts.push(part);
    }
  }
  return baseParts.join("/");
}

function findLayoutPathForSlide(
  slidePath: string,
  slideRelsMap: Map<string, Map<string, string>>,
): string | undefined {
  const slideRels = slideRelsMap.get(slidePath);
  if (!slideRels) return undefined;
  for (const [, target] of slideRels.entries()) {
    if (target.includes("slideLayout")) {
      const slideDir = slidePath.substring(0, slidePath.lastIndexOf("/") + 1);
      return target.startsWith("..")
        ? resolvePath(slideDir, target)
        : "ppt/" + target.replace("../", "");
    }
  }
  return undefined;
}

function findMasterPathForLayout(
  layoutPath: string,
  slideRelsMap: Map<string, Map<string, string>>,
): string | undefined {
  const layoutRels = slideRelsMap.get(layoutPath);
  if (!layoutRels) return undefined;
  for (const [, target] of layoutRels.entries()) {
    if (target.includes("slideMaster")) {
      const layoutDir = layoutPath.substring(
        0,
        layoutPath.lastIndexOf("/") + 1,
      );
      return target.startsWith("..")
        ? resolvePath(layoutDir, target)
        : "ppt/" + target.replace("../", "");
    }
  }
  return undefined;
}

function findMasterPathForSlide(
  slidePath: string,
  slideRelsMap: Map<string, Map<string, string>>,
): string | undefined {
  const layoutPath = findLayoutPathForSlide(slidePath, slideRelsMap);
  if (!layoutPath) return undefined;
  return findMasterPathForLayout(layoutPath, slideRelsMap);
}

function getAvailableLayoutsForSlide(
  slideIndex: number,
  slides: PptxSlide[],
  slideRelsMap: Map<string, Map<string, string>>,
  layoutXmlMap: Map<string, XmlObject>,
  allLayoutOptions: PptxLayoutOption[],
): PptxLayoutOption[] {
  const slide = slides[slideIndex];
  if (!slide) return [];

  const slidePath = slide.id;
  const masterPath = findMasterPathForSlide(slidePath, slideRelsMap);

  if (!masterPath) {
    return allLayoutOptions;
  }

  const masterRels = slideRelsMap.get(masterPath);
  if (!masterRels) {
    return allLayoutOptions;
  }

  const masterLayoutPaths = new Set<string>();
  for (const [, target] of masterRels.entries()) {
    if (target.includes("slideLayout")) {
      const masterDir = masterPath.substring(
        0,
        masterPath.lastIndexOf("/") + 1,
      );
      const resolved = target.startsWith("..")
        ? resolvePath(masterDir, target)
        : "ppt/" + target.replace("../", "");
      masterLayoutPaths.add(resolved);
    }
  }

  const options: PptxLayoutOption[] = [];
  for (const lp of masterLayoutPaths) {
    const xmlObj = layoutXmlMap.get(lp);
    if (xmlObj) {
      const sldLayout = (xmlObj as XmlObject)["p:sldLayout"] as
        | XmlObject
        | undefined;
      const name =
        String(sldLayout?.["p:cSld"]?.["@_name"] || "").trim() || lp;
      const type =
        sldLayout?.["@_type"] != null
          ? String(sldLayout["@_type"]).trim()
          : undefined;
      options.push({ path: lp, name, ...(type ? { type } : {}) });
    }
  }
  return options;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("Layout switching logic (GAP-E4)", () => {
  let slideRelsMap: Map<string, Map<string, string>>;
  let layoutXmlMap: Map<string, XmlObject>;
  let slides: PptxSlide[];
  let allLayouts: PptxLayoutOption[];

  beforeEach(() => {
    slideRelsMap = new Map();
    layoutXmlMap = new Map();

    // Slide 1 -> layout 1 -> master 1
    slideRelsMap.set(
      "ppt/slides/slide1.xml",
      new Map([
        ["rId1", "../slideLayouts/slideLayout1.xml"],
        ["rId2", "../notesSlides/notesSlide1.xml"],
      ]),
    );

    // Layout 1 -> master 1
    slideRelsMap.set(
      "ppt/slideLayouts/slideLayout1.xml",
      new Map([["rId1", "../slideMasters/slideMaster1.xml"]]),
    );

    // Layout 2 -> master 1
    slideRelsMap.set(
      "ppt/slideLayouts/slideLayout2.xml",
      new Map([["rId1", "../slideMasters/slideMaster1.xml"]]),
    );

    // Layout 3 -> master 2 (different master)
    slideRelsMap.set(
      "ppt/slideLayouts/slideLayout3.xml",
      new Map([["rId1", "../slideMasters/slideMaster2.xml"]]),
    );

    // Master 1 has layouts 1 and 2
    slideRelsMap.set(
      "ppt/slideMasters/slideMaster1.xml",
      new Map([
        ["rId1", "../slideLayouts/slideLayout1.xml"],
        ["rId2", "../slideLayouts/slideLayout2.xml"],
        ["rId3", "../theme/theme1.xml"],
      ]),
    );

    // Master 2 has layout 3
    slideRelsMap.set(
      "ppt/slideMasters/slideMaster2.xml",
      new Map([
        ["rId1", "../slideLayouts/slideLayout3.xml"],
        ["rId2", "../theme/theme1.xml"],
      ]),
    );

    // Layout XML data
    layoutXmlMap.set("ppt/slideLayouts/slideLayout1.xml", {
      "p:sldLayout": {
        "@_type": "title",
        "p:cSld": { "@_name": "Title Slide" },
      },
    });
    layoutXmlMap.set("ppt/slideLayouts/slideLayout2.xml", {
      "p:sldLayout": {
        "@_type": "obj",
        "p:cSld": { "@_name": "Title and Content" },
      },
    });
    layoutXmlMap.set("ppt/slideLayouts/slideLayout3.xml", {
      "p:sldLayout": {
        "@_type": "blank",
        "p:cSld": { "@_name": "Blank" },
      },
    });

    slides = [
      {
        id: "ppt/slides/slide1.xml",
        rId: "rId2",
        slideNumber: 1,
        elements: [],
      },
    ];

    allLayouts = [
      { path: "ppt/slideLayouts/slideLayout1.xml", name: "Title Slide", type: "title" },
      { path: "ppt/slideLayouts/slideLayout2.xml", name: "Title and Content", type: "obj" },
      { path: "ppt/slideLayouts/slideLayout3.xml", name: "Blank", type: "blank" },
    ];
  });

  describe("findLayoutPathForSlide", () => {
    it("resolves layout path from slide rels", () => {
      const result = findLayoutPathForSlide(
        "ppt/slides/slide1.xml",
        slideRelsMap,
      );
      expect(result).toBe("ppt/slideLayouts/slideLayout1.xml");
    });

    it("returns undefined when slide has no rels", () => {
      const result = findLayoutPathForSlide(
        "ppt/slides/nonexistent.xml",
        slideRelsMap,
      );
      expect(result).toBeUndefined();
    });

    it("returns undefined when slide rels have no layout reference", () => {
      slideRelsMap.set(
        "ppt/slides/slide2.xml",
        new Map([["rId1", "../notesSlides/notesSlide2.xml"]]),
      );
      const result = findLayoutPathForSlide(
        "ppt/slides/slide2.xml",
        slideRelsMap,
      );
      expect(result).toBeUndefined();
    });
  });

  describe("findMasterPathForSlide", () => {
    it("follows slide -> layout -> master chain", () => {
      const result = findMasterPathForSlide(
        "ppt/slides/slide1.xml",
        slideRelsMap,
      );
      expect(result).toBe("ppt/slideMasters/slideMaster1.xml");
    });

    it("returns undefined when layout has no master rel", () => {
      slideRelsMap.set(
        "ppt/slideLayouts/slideLayout1.xml",
        new Map([["rId1", "../theme/theme1.xml"]]),
      );
      const result = findMasterPathForSlide(
        "ppt/slides/slide1.xml",
        slideRelsMap,
      );
      expect(result).toBeUndefined();
    });
  });

  describe("getAvailableLayoutsForSlide", () => {
    it("returns layouts scoped to the slide's master", () => {
      const layouts = getAvailableLayoutsForSlide(
        0,
        slides,
        slideRelsMap,
        layoutXmlMap,
        allLayouts,
      );
      expect(layouts).toHaveLength(2);
      expect(layouts.map((l) => l.name)).toEqual([
        "Title Slide",
        "Title and Content",
      ]);
    });

    it("excludes layouts from other masters", () => {
      const layouts = getAvailableLayoutsForSlide(
        0,
        slides,
        slideRelsMap,
        layoutXmlMap,
        allLayouts,
      );
      const paths = layouts.map((l) => l.path);
      expect(paths).not.toContain("ppt/slideLayouts/slideLayout3.xml");
    });

    it("returns empty array for invalid slide index", () => {
      const layouts = getAvailableLayoutsForSlide(
        99,
        slides,
        slideRelsMap,
        layoutXmlMap,
        allLayouts,
      );
      expect(layouts).toHaveLength(0);
    });

    it("falls back to all layouts when master is unknown", () => {
      slideRelsMap.set(
        "ppt/slides/slide1.xml",
        new Map([["rId1", "../notesSlides/notesSlide1.xml"]]),
      );
      const layouts = getAvailableLayoutsForSlide(
        0,
        slides,
        slideRelsMap,
        layoutXmlMap,
        allLayouts,
      );
      expect(layouts).toEqual(allLayouts);
    });

    it("includes type when layout has @_type attribute", () => {
      const layouts = getAvailableLayoutsForSlide(
        0,
        slides,
        slideRelsMap,
        layoutXmlMap,
        allLayouts,
      );
      expect(layouts[0].type).toBe("title");
      expect(layouts[1].type).toBe("obj");
    });

    it("falls back to path when layout has no name", () => {
      layoutXmlMap.set("ppt/slideLayouts/slideLayout1.xml", {
        "p:sldLayout": { "p:cSld": {} },
      });
      const layouts = getAvailableLayoutsForSlide(
        0,
        slides,
        slideRelsMap,
        layoutXmlMap,
        allLayouts,
      );
      expect(layouts[0].name).toBe("ppt/slideLayouts/slideLayout1.xml");
    });
  });

  describe("slide .rels update logic", () => {
    it("computes correct relative target from slide to layout", () => {
      const layoutPath = "ppt/slideLayouts/slideLayout3.xml";
      const relativeTarget =
        "../slideLayouts/" + layoutPath.split("/").pop();
      expect(relativeTarget).toBe("../slideLayouts/slideLayout3.xml");
    });

    it("preserves existing relationship structure when updating target", () => {
      const relsMap = new Map([
        ["rId1", "../slideLayouts/slideLayout1.xml"],
        ["rId2", "../notesSlides/notesSlide1.xml"],
      ]);

      // Simulate updating the layout rel
      for (const [rId, target] of relsMap.entries()) {
        if (target.includes("slideLayout")) {
          relsMap.set(rId, "../slideLayouts/slideLayout2.xml");
          break;
        }
      }

      expect(relsMap.get("rId1")).toBe("../slideLayouts/slideLayout2.xml");
      expect(relsMap.get("rId2")).toBe("../notesSlides/notesSlide1.xml");
    });
  });

  describe("resolvePath", () => {
    it("resolves .. correctly", () => {
      expect(resolvePath("ppt/slides/slide1.xml", "../slideLayouts/slideLayout1.xml"))
        .toBe("ppt/slideLayouts/slideLayout1.xml");
    });

    it("resolves multiple .. segments", () => {
      expect(resolvePath("ppt/slides/slide1.xml", "../../slideLayouts/slideLayout1.xml"))
        .toBe("slideLayouts/slideLayout1.xml");
    });
  });
});

// ── Placeholder re-mapping tests ──────────────────────────────────────

const EMU_PER_PX = 9525;

/** Helper: build a placeholder info from a rawXml nvPr node. */
function readPlaceholderInfoFromNvPr(
  nvPr: XmlObject | undefined,
): PlaceholderInfo | null {
  if (!nvPr) return null;
  const ph = nvPr["p:ph"] as XmlObject | undefined;
  if (!ph) return null;
  const idx = ph["@_idx"];
  const type = ph["@_type"];
  const sz = ph["@_sz"];
  return {
    idx: idx !== undefined ? String(idx) : undefined,
    type: type !== undefined ? String(type).toLowerCase() : undefined,
    sz: sz !== undefined ? String(sz).toLowerCase() : undefined,
  };
}

/** Helper: extract placeholder info from an element's rawXml. */
function getElementPlaceholderInfo(
  element: PptxElement,
): PlaceholderInfo | null {
  const raw = element.rawXml;
  if (!raw) return null;
  const nvPr =
    (raw["p:nvSpPr"]?.["p:nvPr"] as XmlObject | undefined) ??
    (raw["p:nvPicPr"]?.["p:nvPr"] as XmlObject | undefined) ??
    (raw["p:nvGraphicFramePr"]?.["p:nvPr"] as XmlObject | undefined);
  return readPlaceholderInfoFromNvPr(nvPr);
}

/** Helper: build placeholder matching key. */
function buildPlaceholderMatchKey(phInfo: PlaceholderInfo): string {
  const type = phInfo.type || "body";
  if (phInfo.idx !== undefined) {
    return `${type}:${phInfo.idx}`;
  }
  return type;
}

/** Helper: extract layout placeholders with transforms. */
function extractLayoutPlaceholders(
  layoutXml: XmlObject,
): Array<{
  phInfo: PlaceholderInfo;
  xEmu: number;
  yEmu: number;
  cxEmu: number;
  cyEmu: number;
}> {
  const sldLayout = layoutXml["p:sldLayout"] as XmlObject | undefined;
  const spTree = sldLayout?.["p:cSld"]?.["p:spTree"] as XmlObject | undefined;
  if (!spTree) return [];

  const result: Array<{
    phInfo: PlaceholderInfo;
    xEmu: number;
    yEmu: number;
    cxEmu: number;
    cyEmu: number;
  }> = [];

  const rawShapes = spTree["p:sp"];
  const shapes = !rawShapes ? [] : Array.isArray(rawShapes) ? rawShapes : [rawShapes];
  for (const shape of shapes) {
    const nvPr = shape?.["p:nvSpPr"]?.["p:nvPr"] as XmlObject | undefined;
    const phInfo = readPlaceholderInfoFromNvPr(nvPr);
    if (!phInfo) continue;

    const spPr = shape["p:spPr"] as XmlObject | undefined;
    const xfrm = spPr?.["a:xfrm"] as XmlObject | undefined;
    const off = xfrm?.["a:off"] as XmlObject | undefined;
    const ext = xfrm?.["a:ext"] as XmlObject | undefined;

    const xEmu = off ? Number(off["@_x"] || 0) : 0;
    const yEmu = off ? Number(off["@_y"] || 0) : 0;
    const cxEmu = ext ? Number(ext["@_cx"] || 0) : 0;
    const cyEmu = ext ? Number(ext["@_cy"] || 0) : 0;

    result.push({ phInfo, xEmu, yEmu, cxEmu, cyEmu });
  }

  return result;
}

/** Helper: re-map elements to a new layout (mirrors runtime logic). */
function remapElementsToNewLayout(
  elements: PptxElement[],
  newLayoutXml: XmlObject,
): PptxElement[] {
  const layoutPlaceholders = extractLayoutPlaceholders(newLayoutXml);

  const layoutPhMap = new Map<
    string,
    {
      phInfo: PlaceholderInfo;
      xEmu: number;
      yEmu: number;
      cxEmu: number;
      cyEmu: number;
      matched: boolean;
    }
  >();
  for (const lp of layoutPlaceholders) {
    const key = buildPlaceholderMatchKey(lp.phInfo);
    layoutPhMap.set(key, { ...lp, matched: false });
  }

  const resultElements: PptxElement[] = [];

  for (const element of elements) {
    const phInfo = getElementPlaceholderInfo(element);

    if (!phInfo) {
      resultElements.push(element);
      continue;
    }

    const matchKey = buildPlaceholderMatchKey(phInfo);
    const layoutPh = layoutPhMap.get(matchKey);

    let resolvedLayoutPh = layoutPh;
    if (!resolvedLayoutPh && phInfo.type) {
      for (const [, lp] of layoutPhMap.entries()) {
        if (!lp.matched && lp.phInfo.type === phInfo.type) {
          resolvedLayoutPh = lp;
          break;
        }
      }
    }

    if (resolvedLayoutPh) {
      resolvedLayoutPh.matched = true;
      const updatedElement = { ...element };
      if (resolvedLayoutPh.cxEmu > 0 && resolvedLayoutPh.cyEmu > 0) {
        updatedElement.x = Math.round(resolvedLayoutPh.xEmu / EMU_PER_PX);
        updatedElement.y = Math.round(resolvedLayoutPh.yEmu / EMU_PER_PX);
        updatedElement.width = Math.round(resolvedLayoutPh.cxEmu / EMU_PER_PX);
        updatedElement.height = Math.round(resolvedLayoutPh.cyEmu / EMU_PER_PX);
      }
      resultElements.push(updatedElement);
    }
    // Else: no match -- drop placeholder element
  }

  // Add empty placeholders from the new layout that were not matched
  const skipTypes = new Set(["dt", "ftr", "sldnum", "hdr"]);
  for (const [, lp] of layoutPhMap) {
    if (lp.matched) continue;
    if (lp.phInfo.type && skipTypes.has(lp.phInfo.type)) continue;
    if (lp.cxEmu <= 0 || lp.cyEmu <= 0) continue;

    const element: PptxElement = {
      type: "text" as const,
      id: `ph-${lp.phInfo.type || "content"}-${lp.phInfo.idx || "0"}`,
      x: Math.round(lp.xEmu / EMU_PER_PX),
      y: Math.round(lp.yEmu / EMU_PER_PX),
      width: Math.round(lp.cxEmu / EMU_PER_PX),
      height: Math.round(lp.cyEmu / EMU_PER_PX),
      text: "",
    };
    resultElements.push(element);
  }

  return resultElements;
}

/** Helper: create a text element with a placeholder rawXml. */
function makePhElement(
  id: string,
  phType: string | undefined,
  phIdx: string | undefined,
  xPx: number,
  yPx: number,
  wPx: number,
  hPx: number,
  text: string = "Hello",
): PptxElement {
  const phNode: XmlObject = {};
  if (phType) phNode["@_type"] = phType;
  if (phIdx !== undefined) phNode["@_idx"] = phIdx;

  return {
    type: "text" as const,
    id,
    x: xPx,
    y: yPx,
    width: wPx,
    height: hPx,
    text,
    rawXml: {
      "p:nvSpPr": {
        "p:cNvPr": { "@_id": "1", "@_name": "Title 1" },
        "p:cNvSpPr": {},
        "p:nvPr": { "p:ph": phNode },
      },
      "p:spPr": {},
      "p:txBody": {
        "a:bodyPr": {},
        "a:p": { "a:r": { "a:t": text } },
      },
    },
  };
}

/** Helper: create a non-placeholder element. */
function makeNonPhElement(
  id: string,
  xPx: number,
  yPx: number,
  wPx: number,
  hPx: number,
): PptxElement {
  return {
    type: "shape" as const,
    id,
    x: xPx,
    y: yPx,
    width: wPx,
    height: hPx,
    rawXml: {
      "p:nvSpPr": {
        "p:cNvPr": { "@_id": "99", "@_name": "Freeform" },
        "p:cNvSpPr": {},
        "p:nvPr": {},
      },
      "p:spPr": {},
    },
  };
}

/** Helper: build a layout XML with placeholders. */
function makeLayoutXml(
  placeholders: Array<{
    phType?: string;
    phIdx?: string;
    xEmu: number;
    yEmu: number;
    cxEmu: number;
    cyEmu: number;
  }>,
): XmlObject {
  const shapes = placeholders.map((ph) => {
    const phNode: XmlObject = {};
    if (ph.phType) phNode["@_type"] = ph.phType;
    if (ph.phIdx !== undefined) phNode["@_idx"] = ph.phIdx;
    return {
      "p:nvSpPr": {
        "p:cNvPr": { "@_id": "1", "@_name": "PH" },
        "p:cNvSpPr": {},
        "p:nvPr": { "p:ph": phNode },
      },
      "p:spPr": {
        "a:xfrm": {
          "a:off": { "@_x": String(ph.xEmu), "@_y": String(ph.yEmu) },
          "a:ext": { "@_cx": String(ph.cxEmu), "@_cy": String(ph.cyEmu) },
        },
      },
    };
  });
  return {
    "p:sldLayout": {
      "p:cSld": {
        "@_name": "Test Layout",
        "p:spTree": {
          "p:sp": shapes.length === 1 ? shapes[0] : shapes,
        },
      },
    },
  };
}

describe("Placeholder re-mapping (GAP-E4 layout switching)", () => {
  it("matches placeholders by type and updates positions", () => {
    const titleEl = makePhElement("t1", "title", undefined, 10, 10, 100, 50, "My Title");
    const bodyEl = makePhElement("b1", "body", undefined, 10, 70, 100, 200, "Body text");

    const newLayout = makeLayoutXml([
      { phType: "title", xEmu: 190500, yEmu: 95250, cxEmu: 7620000, cyEmu: 1143000 },
      { phType: "body", xEmu: 190500, yEmu: 1524000, cxEmu: 7620000, cyEmu: 3429000 },
    ]);

    const result = remapElementsToNewLayout([titleEl, bodyEl], newLayout);

    expect(result).toHaveLength(2);

    // Title should be repositioned
    const title = result.find((e) => e.id === "t1")!;
    expect(title.text).toBe("My Title"); // content preserved
    expect(title.x).toBe(Math.round(190500 / EMU_PER_PX));
    expect(title.y).toBe(Math.round(95250 / EMU_PER_PX));
    expect(title.width).toBe(Math.round(7620000 / EMU_PER_PX));
    expect(title.height).toBe(Math.round(1143000 / EMU_PER_PX));

    // Body should be repositioned
    const body = result.find((e) => e.id === "b1")!;
    expect(body.text).toBe("Body text"); // content preserved
    expect(body.x).toBe(Math.round(190500 / EMU_PER_PX));
    expect(body.y).toBe(Math.round(1524000 / EMU_PER_PX));
  });

  it("removes placeholder elements that don't exist in new layout", () => {
    const titleEl = makePhElement("t1", "title", undefined, 10, 10, 100, 50, "Title");
    const subtitleEl = makePhElement("s1", "subTitle", undefined, 10, 70, 100, 50, "Subtitle");

    // New layout only has title, no subtitle
    const newLayout = makeLayoutXml([
      { phType: "title", xEmu: 100000, yEmu: 100000, cxEmu: 5000000, cyEmu: 1000000 },
    ]);

    const result = remapElementsToNewLayout([titleEl, subtitleEl], newLayout);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t1");
    expect(result[0].text).toBe("Title");
  });

  it("adds empty placeholders from new layout that are missing in slide", () => {
    const titleEl = makePhElement("t1", "title", undefined, 10, 10, 100, 50, "Title");

    // New layout has title AND body
    const newLayout = makeLayoutXml([
      { phType: "title", xEmu: 100000, yEmu: 100000, cxEmu: 5000000, cyEmu: 1000000 },
      { phType: "body", xEmu: 100000, yEmu: 1500000, cxEmu: 5000000, cyEmu: 3000000 },
    ]);

    const result = remapElementsToNewLayout([titleEl], newLayout);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("t1"); // existing title kept
    const newBody = result[1];
    expect(newBody.text).toBe(""); // empty placeholder
    expect(newBody.x).toBe(Math.round(100000 / EMU_PER_PX));
    expect(newBody.width).toBe(Math.round(5000000 / EMU_PER_PX));
  });

  it("keeps non-placeholder elements at their current positions", () => {
    const titleEl = makePhElement("t1", "title", undefined, 10, 10, 100, 50);
    const freeform = makeNonPhElement("f1", 300, 400, 150, 80);

    const newLayout = makeLayoutXml([
      { phType: "title", xEmu: 200000, yEmu: 200000, cxEmu: 4000000, cyEmu: 800000 },
    ]);

    const result = remapElementsToNewLayout([titleEl, freeform], newLayout);

    expect(result).toHaveLength(2);
    // Non-placeholder should be unchanged
    const kept = result.find((e) => e.id === "f1")!;
    expect(kept.x).toBe(300);
    expect(kept.y).toBe(400);
    expect(kept.width).toBe(150);
    expect(kept.height).toBe(80);
  });

  it("matches by type+idx when idx is present", () => {
    const body1 = makePhElement("b1", "body", "1", 10, 10, 100, 100, "Left");
    const body2 = makePhElement("b2", "body", "2", 200, 10, 100, 100, "Right");

    const newLayout = makeLayoutXml([
      { phType: "body", phIdx: "1", xEmu: 50000, yEmu: 50000, cxEmu: 3000000, cyEmu: 2000000 },
      { phType: "body", phIdx: "2", xEmu: 4000000, yEmu: 50000, cxEmu: 3000000, cyEmu: 2000000 },
    ]);

    const result = remapElementsToNewLayout([body1, body2], newLayout);

    expect(result).toHaveLength(2);
    const left = result.find((e) => e.id === "b1")!;
    expect(left.text).toBe("Left");
    expect(left.x).toBe(Math.round(50000 / EMU_PER_PX));

    const right = result.find((e) => e.id === "b2")!;
    expect(right.text).toBe("Right");
    expect(right.x).toBe(Math.round(4000000 / EMU_PER_PX));
  });

  it("falls back to type-only match when idx doesn't match", () => {
    const body1 = makePhElement("b1", "body", "1", 10, 10, 100, 100, "Content");

    // New layout has body with idx=5 (different idx)
    const newLayout = makeLayoutXml([
      { phType: "body", phIdx: "5", xEmu: 100000, yEmu: 100000, cxEmu: 6000000, cyEmu: 3000000 },
    ]);

    const result = remapElementsToNewLayout([body1], newLayout);

    // Should still match by type fallback
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("b1");
    expect(result[0].text).toBe("Content");
    expect(result[0].x).toBe(Math.round(100000 / EMU_PER_PX));
  });

  it("skips footer/date-time/slide-number when adding empty placeholders", () => {
    const newLayout = makeLayoutXml([
      { phType: "title", xEmu: 100000, yEmu: 100000, cxEmu: 5000000, cyEmu: 1000000 },
      { phType: "ftr", xEmu: 100000, yEmu: 6000000, cxEmu: 2000000, cyEmu: 300000 },
      { phType: "dt", xEmu: 3000000, yEmu: 6000000, cxEmu: 2000000, cyEmu: 300000 },
      { phType: "sldNum", xEmu: 6000000, yEmu: 6000000, cxEmu: 1000000, cyEmu: 300000 },
    ]);

    const result = remapElementsToNewLayout([], newLayout);

    // Only title should be added; ftr/dt/sldNum are skipped
    expect(result).toHaveLength(1);
    expect(result[0].id).toContain("title");
  });

  it("handles empty elements array", () => {
    const newLayout = makeLayoutXml([
      { phType: "title", xEmu: 100000, yEmu: 100000, cxEmu: 5000000, cyEmu: 1000000 },
    ]);

    const result = remapElementsToNewLayout([], newLayout);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("");
  });

  it("handles layout with no placeholders", () => {
    const titleEl = makePhElement("t1", "title", undefined, 10, 10, 100, 50, "Title");
    const freeform = makeNonPhElement("f1", 300, 400, 150, 80);

    const blankLayout: XmlObject = {
      "p:sldLayout": {
        "p:cSld": { "@_name": "Blank", "p:spTree": {} },
      },
    };

    const result = remapElementsToNewLayout([titleEl, freeform], blankLayout);

    // Placeholder dropped, non-placeholder kept
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("f1");
  });

  it("handles element without rawXml as non-placeholder", () => {
    const noRawXml: PptxElement = {
      type: "shape" as const,
      id: "no-raw",
      x: 50,
      y: 50,
      width: 200,
      height: 100,
    };

    const newLayout = makeLayoutXml([
      { phType: "title", xEmu: 100000, yEmu: 100000, cxEmu: 5000000, cyEmu: 1000000 },
    ]);

    const result = remapElementsToNewLayout([noRawXml], newLayout);

    // Element without rawXml is treated as non-placeholder, kept as-is
    expect(result).toHaveLength(2); // 1 kept + 1 empty title added
    expect(result[0].id).toBe("no-raw");
    expect(result[0].x).toBe(50);
  });
});
