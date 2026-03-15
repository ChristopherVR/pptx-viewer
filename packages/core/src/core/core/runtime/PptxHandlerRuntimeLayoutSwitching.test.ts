import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PptxSlide, PptxLayoutOption, XmlObject } from "../../types";

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
