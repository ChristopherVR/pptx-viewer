import { describe, it, expect } from "vitest";
import {
  PptxTemplateBackgroundService,
  type PptxTemplateBackgroundState,
} from "./PptxTemplateBackgroundService";
import type { XmlObject } from "../types";

function createState(
  layouts: Record<string, XmlObject> = {},
  masters: Record<string, XmlObject> = {},
): PptxTemplateBackgroundState {
  return {
    layoutXmlMap: new Map(Object.entries(layouts)),
    masterXmlMap: new Map(Object.entries(masters)),
  };
}

describe("PptxTemplateBackgroundService", () => {
  const service = new PptxTemplateBackgroundService();

  // ── setBackground ─────────────────────────────────────────────────

  describe("setBackground", () => {
    it("sets a solid background color on a slide layout", () => {
      const layoutXml: XmlObject = {
        "p:sldLayout": {
          "p:cSld": {},
        },
      };
      const state = createState({
        "ppt/slideLayouts/slideLayout1.xml": layoutXml,
      });

      service.setBackground(
        state,
        "ppt/slideLayouts/slideLayout1.xml",
        "#FF0000",
      );

      const cSld = (layoutXml["p:sldLayout"] as XmlObject)[
        "p:cSld"
      ] as XmlObject;
      expect(cSld["p:bg"]).toBeDefined();
      const bgPr = (cSld["p:bg"] as XmlObject)["p:bgPr"] as XmlObject;
      const solidFill = bgPr["a:solidFill"] as XmlObject;
      const srgbClr = solidFill["a:srgbClr"] as XmlObject;
      expect(srgbClr["@_val"]).toBe("FF0000");
    });

    it("sets a solid background color on a slide master", () => {
      const masterXml: XmlObject = {
        "p:sldMaster": {
          "p:cSld": {},
        },
      };
      const state = createState(
        {},
        { "ppt/slideMasters/slideMaster1.xml": masterXml },
      );

      service.setBackground(
        state,
        "ppt/slideMasters/slideMaster1.xml",
        "#00FF00",
      );

      const cSld = (masterXml["p:sldMaster"] as XmlObject)[
        "p:cSld"
      ] as XmlObject;
      expect(cSld["p:bg"]).toBeDefined();
    });

    it("removes background when color is transparent", () => {
      const layoutXml: XmlObject = {
        "p:sldLayout": {
          "p:cSld": {
            "p:bg": {
              "p:bgPr": { "a:solidFill": { "a:srgbClr": { "@_val": "FF0000" } } },
            },
          },
        },
      };
      const state = createState({
        "ppt/slideLayouts/slideLayout1.xml": layoutXml,
      });

      service.setBackground(
        state,
        "ppt/slideLayouts/slideLayout1.xml",
        "transparent",
      );

      const cSld = (layoutXml["p:sldLayout"] as XmlObject)[
        "p:cSld"
      ] as XmlObject;
      expect(cSld["p:bg"]).toBeUndefined();
    });

    it("removes background when color is undefined", () => {
      const layoutXml: XmlObject = {
        "p:sldLayout": {
          "p:cSld": {
            "p:bg": { "p:bgPr": {} },
          },
        },
      };
      const state = createState({
        "ppt/slideLayouts/slideLayout1.xml": layoutXml,
      });

      service.setBackground(
        state,
        "ppt/slideLayouts/slideLayout1.xml",
        undefined,
      );

      const cSld = (layoutXml["p:sldLayout"] as XmlObject)[
        "p:cSld"
      ] as XmlObject;
      expect(cSld["p:bg"]).toBeUndefined();
    });

    it("removes background when color is empty string", () => {
      const layoutXml: XmlObject = {
        "p:sldLayout": {
          "p:cSld": {
            "p:bg": { "p:bgPr": {} },
          },
        },
      };
      const state = createState({
        "ppt/slideLayouts/slideLayout1.xml": layoutXml,
      });

      service.setBackground(
        state,
        "ppt/slideLayouts/slideLayout1.xml",
        "",
      );

      const cSld = (layoutXml["p:sldLayout"] as XmlObject)[
        "p:cSld"
      ] as XmlObject;
      expect(cSld["p:bg"]).toBeUndefined();
    });

    it("does nothing for paths that are neither layout nor master", () => {
      const state = createState();
      // Should not throw
      service.setBackground(state, "ppt/slides/slide1.xml", "#FF0000");
    });

    it("does nothing when the XML object is not in the map", () => {
      const state = createState();
      // Should not throw even though the layout path doesn't exist in map
      service.setBackground(
        state,
        "ppt/slideLayouts/nonexistent.xml",
        "#FF0000",
      );
    });

    it("uppercases the hex color value", () => {
      const layoutXml: XmlObject = {
        "p:sldLayout": {
          "p:cSld": {},
        },
      };
      const state = createState({
        "ppt/slideLayouts/slideLayout1.xml": layoutXml,
      });

      service.setBackground(
        state,
        "ppt/slideLayouts/slideLayout1.xml",
        "#aabbcc",
      );

      const cSld = (layoutXml["p:sldLayout"] as XmlObject)[
        "p:cSld"
      ] as XmlObject;
      const bgPr = (cSld["p:bg"] as XmlObject)["p:bgPr"] as XmlObject;
      const solidFill = bgPr["a:solidFill"] as XmlObject;
      const srgbClr = solidFill["a:srgbClr"] as XmlObject;
      expect(srgbClr["@_val"]).toBe("AABBCC");
    });

    it("creates p:cSld if it does not exist", () => {
      const layoutXml: XmlObject = {
        "p:sldLayout": {},
      };
      const state = createState({
        "ppt/slideLayouts/slideLayout1.xml": layoutXml,
      });

      service.setBackground(
        state,
        "ppt/slideLayouts/slideLayout1.xml",
        "#FF0000",
      );

      const sldLayout = layoutXml["p:sldLayout"] as XmlObject;
      expect(sldLayout["p:cSld"]).toBeDefined();
      const cSld = sldLayout["p:cSld"] as XmlObject;
      expect(cSld["p:bg"]).toBeDefined();
    });
  });

  // ── getBackgroundColor ─────────────────────────────────────────────

  describe("getBackgroundColor", () => {
    it("returns the background color via the extractor function", () => {
      const layoutXml: XmlObject = {
        "p:sldLayout": {
          "p:cSld": {
            "p:bg": { "p:bgPr": { "a:solidFill": { "a:srgbClr": { "@_val": "FF0000" } } } },
          },
        },
      };
      const state = createState({
        "ppt/slideLayouts/slideLayout1.xml": layoutXml,
      });

      const result = service.getBackgroundColor(
        state,
        "ppt/slideLayouts/slideLayout1.xml",
        (_xmlObj, _rootTag) => "#FF0000",
      );
      expect(result).toBe("#FF0000");
    });

    it("returns undefined when the path is not a layout or master", () => {
      const state = createState();
      const result = service.getBackgroundColor(
        state,
        "ppt/slides/slide1.xml",
        () => "#FF0000",
      );
      expect(result).toBeUndefined();
    });

    it("returns undefined when the XML object is not in the map", () => {
      const state = createState();
      const result = service.getBackgroundColor(
        state,
        "ppt/slideLayouts/nonexistent.xml",
        () => "#FF0000",
      );
      expect(result).toBeUndefined();
    });

    it("passes the correct rootTag for layouts", () => {
      const layoutXml: XmlObject = { "p:sldLayout": {} };
      const state = createState({
        "ppt/slideLayouts/slideLayout1.xml": layoutXml,
      });

      let capturedRootTag: string | undefined;
      service.getBackgroundColor(
        state,
        "ppt/slideLayouts/slideLayout1.xml",
        (_xmlObj, rootTag) => {
          capturedRootTag = rootTag;
          return undefined;
        },
      );
      expect(capturedRootTag).toBe("p:sldLayout");
    });

    it("passes the correct rootTag for masters", () => {
      const masterXml: XmlObject = { "p:sldMaster": {} };
      const state = createState(
        {},
        { "ppt/slideMasters/slideMaster1.xml": masterXml },
      );

      let capturedRootTag: string | undefined;
      service.getBackgroundColor(
        state,
        "ppt/slideMasters/slideMaster1.xml",
        (_xmlObj, rootTag) => {
          capturedRootTag = rootTag;
          return undefined;
        },
      );
      expect(capturedRootTag).toBe("p:sldMaster");
    });
  });
});
