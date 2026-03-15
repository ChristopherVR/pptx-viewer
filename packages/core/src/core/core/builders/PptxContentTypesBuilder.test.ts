import { describe, it, expect } from "vitest";
import { PptxContentTypesBuilder } from "./PptxContentTypesBuilder";
import type { XmlObject } from "../../types";

describe("PptxContentTypesBuilder", () => {
  const builder = new PptxContentTypesBuilder();

  const SLIDE_CT =
    "application/vnd.openxmlformats-officedocument.presentationml.slide+xml";
  const COMMENT_CT =
    "application/vnd.openxmlformats-officedocument.presentationml.comments+xml";
  const COMMENT_AUTHOR_CT =
    "application/vnd.openxmlformats-officedocument.presentationml.commentAuthors+xml";

  // ── applySlideAndMediaUpdates ────────────────────────────────────────

  describe("applySlideAndMediaUpdates", () => {
    it("adds slide override entries for new slides", () => {
      const contentTypes: XmlObject = {
        Types: {
          Default: [],
          Override: [],
        },
      };
      const result = builder.applySlideAndMediaUpdates({
        contentTypesData: contentTypes,
        slidePaths: ["ppt/slides/slide1.xml", "ppt/slides/slide2.xml"],
        usedMediaPaths: new Set(),
        slideContentType: SLIDE_CT,
      });
      const overrides = (result["Types"] as XmlObject)["Override"] as any[];
      expect(overrides).toHaveLength(2);
      expect(overrides[0]["@_PartName"]).toBe("/ppt/slides/slide1.xml");
      expect(overrides[0]["@_ContentType"]).toBe(SLIDE_CT);
      expect(overrides[1]["@_PartName"]).toBe("/ppt/slides/slide2.xml");
    });

    it("preserves existing non-slide overrides", () => {
      const contentTypes: XmlObject = {
        Types: {
          Default: [],
          Override: [
            {
              "@_PartName": "/ppt/presentation.xml",
              "@_ContentType": "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
            },
          ],
        },
      };
      const result = builder.applySlideAndMediaUpdates({
        contentTypesData: contentTypes,
        slidePaths: ["ppt/slides/slide1.xml"],
        usedMediaPaths: new Set(),
        slideContentType: SLIDE_CT,
      });
      const overrides = (result["Types"] as XmlObject)["Override"] as any[];
      expect(overrides).toHaveLength(2);
      // Non-slide override is preserved
      expect(overrides[0]["@_PartName"]).toBe("/ppt/presentation.xml");
    });

    it("does not duplicate existing slide overrides", () => {
      const contentTypes: XmlObject = {
        Types: {
          Default: [],
          Override: [
            {
              "@_PartName": "/ppt/slides/slide1.xml",
              "@_ContentType": SLIDE_CT,
            },
          ],
        },
      };
      const result = builder.applySlideAndMediaUpdates({
        contentTypesData: contentTypes,
        slidePaths: ["ppt/slides/slide1.xml"],
        usedMediaPaths: new Set(),
        slideContentType: SLIDE_CT,
      });
      const overrides = (result["Types"] as XmlObject)["Override"] as any[];
      // Should still be just one, not duplicated
      const slideOverrides = overrides.filter(
        (o: any) => o["@_ContentType"] === SLIDE_CT,
      );
      expect(slideOverrides).toHaveLength(1);
    });

    it("removes slide overrides for deleted slides", () => {
      const contentTypes: XmlObject = {
        Types: {
          Default: [],
          Override: [
            {
              "@_PartName": "/ppt/slides/slide1.xml",
              "@_ContentType": SLIDE_CT,
            },
            {
              "@_PartName": "/ppt/slides/slide2.xml",
              "@_ContentType": SLIDE_CT,
            },
          ],
        },
      };
      // Only slide1 remains active
      const result = builder.applySlideAndMediaUpdates({
        contentTypesData: contentTypes,
        slidePaths: ["ppt/slides/slide1.xml"],
        usedMediaPaths: new Set(),
        slideContentType: SLIDE_CT,
      });
      const overrides = (result["Types"] as XmlObject)["Override"] as any[];
      const slideOverrides = overrides.filter(
        (o: any) => o["@_ContentType"] === SLIDE_CT,
      );
      expect(slideOverrides).toHaveLength(1);
      expect(slideOverrides[0]["@_PartName"]).toBe("/ppt/slides/slide1.xml");
    });

    it("adds default content type for new media extensions (png)", () => {
      const contentTypes: XmlObject = {
        Types: {
          Default: [],
          Override: [],
        },
      };
      builder.applySlideAndMediaUpdates({
        contentTypesData: contentTypes,
        slidePaths: [],
        usedMediaPaths: new Set(["ppt/media/image1.png"]),
        slideContentType: SLIDE_CT,
      });
      const defaults = (contentTypes["Types"] as XmlObject)[
        "Default"
      ] as any[];
      const pngDefault = defaults.find(
        (d: any) => d["@_Extension"] === "png",
      );
      expect(pngDefault).toBeDefined();
      expect(pngDefault["@_ContentType"]).toBe("image/png");
    });

    it("adds default content types for multiple media formats", () => {
      const contentTypes: XmlObject = {
        Types: {
          Default: [],
          Override: [],
        },
      };
      builder.applySlideAndMediaUpdates({
        contentTypesData: contentTypes,
        slidePaths: [],
        usedMediaPaths: new Set([
          "ppt/media/image1.jpg",
          "ppt/media/video1.mp4",
          "ppt/media/audio1.mp3",
        ]),
        slideContentType: SLIDE_CT,
      });
      const defaults = (contentTypes["Types"] as XmlObject)[
        "Default"
      ] as any[];
      const exts = defaults.map((d: any) => d["@_Extension"]);
      expect(exts).toContain("jpg");
      expect(exts).toContain("mp4");
      expect(exts).toContain("mp3");
    });

    it("does not duplicate existing default extensions", () => {
      const contentTypes: XmlObject = {
        Types: {
          Default: [{ "@_Extension": "png", "@_ContentType": "image/png" }],
          Override: [],
        },
      };
      builder.applySlideAndMediaUpdates({
        contentTypesData: contentTypes,
        slidePaths: [],
        usedMediaPaths: new Set(["ppt/media/image1.png"]),
        slideContentType: SLIDE_CT,
      });
      const defaults = (contentTypes["Types"] as XmlObject)[
        "Default"
      ] as any[];
      const pngDefaults = defaults.filter(
        (d: any) => d["@_Extension"] === "png",
      );
      expect(pngDefaults).toHaveLength(1);
    });

    it("handles non-array Override (single entry) gracefully", () => {
      const contentTypes: XmlObject = {
        Types: {
          Default: [],
          Override: {
            "@_PartName": "/ppt/presentation.xml",
            "@_ContentType": "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
          },
        },
      };
      const result = builder.applySlideAndMediaUpdates({
        contentTypesData: contentTypes,
        slidePaths: ["ppt/slides/slide1.xml"],
        usedMediaPaths: new Set(),
        slideContentType: SLIDE_CT,
      });
      const overrides = (result["Types"] as XmlObject)["Override"] as any[];
      expect(Array.isArray(overrides)).toBe(true);
      expect(overrides.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── applyCommentUpdates ──────────────────────────────────────────────

  describe("applyCommentUpdates", () => {
    it("adds comment overrides for new comment paths", () => {
      const contentTypes: XmlObject = {
        Types: { Default: [], Override: [] },
      };
      builder.applyCommentUpdates({
        contentTypesData: contentTypes,
        activeCommentPaths: new Set(["/ppt/comments/comment1.xml"]),
        hasCommentAuthors: true,
        commentContentType: COMMENT_CT,
        commentAuthorContentType: COMMENT_AUTHOR_CT,
        commentAuthorsPartName: "/ppt/commentAuthors.xml",
      });
      const overrides = (contentTypes["Types"] as XmlObject)[
        "Override"
      ] as any[];
      const commentOverrides = overrides.filter(
        (o: any) => o["@_ContentType"] === COMMENT_CT,
      );
      expect(commentOverrides).toHaveLength(1);
      expect(commentOverrides[0]["@_PartName"]).toBe(
        "/ppt/comments/comment1.xml",
      );
    });

    it("adds commentAuthors override when hasCommentAuthors is true", () => {
      const contentTypes: XmlObject = {
        Types: { Default: [], Override: [] },
      };
      builder.applyCommentUpdates({
        contentTypesData: contentTypes,
        activeCommentPaths: new Set(),
        hasCommentAuthors: true,
        commentContentType: COMMENT_CT,
        commentAuthorContentType: COMMENT_AUTHOR_CT,
        commentAuthorsPartName: "/ppt/commentAuthors.xml",
      });
      const overrides = (contentTypes["Types"] as XmlObject)[
        "Override"
      ] as any[];
      const authorOverrides = overrides.filter(
        (o: any) => o["@_ContentType"] === COMMENT_AUTHOR_CT,
      );
      expect(authorOverrides).toHaveLength(1);
    });

    it("does not add commentAuthors when hasCommentAuthors is false", () => {
      const contentTypes: XmlObject = {
        Types: { Default: [], Override: [] },
      };
      builder.applyCommentUpdates({
        contentTypesData: contentTypes,
        activeCommentPaths: new Set(),
        hasCommentAuthors: false,
        commentContentType: COMMENT_CT,
        commentAuthorContentType: COMMENT_AUTHOR_CT,
        commentAuthorsPartName: "/ppt/commentAuthors.xml",
      });
      const overrides = (contentTypes["Types"] as XmlObject)[
        "Override"
      ] as any[];
      const authorOverrides = overrides.filter(
        (o: any) => o["@_ContentType"] === COMMENT_AUTHOR_CT,
      );
      expect(authorOverrides).toHaveLength(0);
    });

    it("removes orphaned comment overrides", () => {
      const contentTypes: XmlObject = {
        Types: {
          Default: [],
          Override: [
            {
              "@_PartName": "/ppt/comments/comment1.xml",
              "@_ContentType": COMMENT_CT,
            },
            {
              "@_PartName": "/ppt/comments/comment2.xml",
              "@_ContentType": COMMENT_CT,
            },
          ],
        },
      };
      // Only comment1 is active now
      builder.applyCommentUpdates({
        contentTypesData: contentTypes,
        activeCommentPaths: new Set(["/ppt/comments/comment1.xml"]),
        hasCommentAuthors: false,
        commentContentType: COMMENT_CT,
        commentAuthorContentType: COMMENT_AUTHOR_CT,
        commentAuthorsPartName: "/ppt/commentAuthors.xml",
      });
      const overrides = (contentTypes["Types"] as XmlObject)[
        "Override"
      ] as any[];
      const commentOverrides = overrides.filter(
        (o: any) => o["@_ContentType"] === COMMENT_CT,
      );
      expect(commentOverrides).toHaveLength(1);
      expect(commentOverrides[0]["@_PartName"]).toBe(
        "/ppt/comments/comment1.xml",
      );
    });
  });

  // ── applyOutputFormatOverride ────────────────────────────────────────

  describe("applyOutputFormatOverride", () => {
    it("does nothing for pptx format", () => {
      const contentTypes: XmlObject = {
        Types: {
          Default: [],
          Override: [
            {
              "@_PartName": "/ppt/presentation.xml",
              "@_ContentType":
                "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
            },
          ],
        },
      };
      builder.applyOutputFormatOverride(contentTypes, "pptx", false);
      const overrides = (contentTypes["Types"] as XmlObject)[
        "Override"
      ] as any[];
      expect(overrides[0]["@_ContentType"]).toBe(
        "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
      );
    });

    it("rewrites content type for ppsx format", () => {
      const contentTypes: XmlObject = {
        Types: {
          Default: [],
          Override: [
            {
              "@_PartName": "/ppt/presentation.xml",
              "@_ContentType":
                "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
            },
          ],
        },
      };
      builder.applyOutputFormatOverride(contentTypes, "ppsx", false);
      const overrides = (contentTypes["Types"] as XmlObject)[
        "Override"
      ] as any[];
      expect(overrides[0]["@_ContentType"]).toBe(
        "application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml",
      );
    });

    it("rewrites content type for pptm format", () => {
      const contentTypes: XmlObject = {
        Types: {
          Default: [],
          Override: [
            {
              "@_PartName": "/ppt/presentation.xml",
              "@_ContentType":
                "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
            },
          ],
        },
      };
      builder.applyOutputFormatOverride(contentTypes, "pptm", true);
      const overrides = (contentTypes["Types"] as XmlObject)[
        "Override"
      ] as any[];
      expect(overrides[0]["@_ContentType"]).toBe(
        "application/vnd.ms-powerpoint.presentation.macroEnabled.main+xml",
      );
    });

    it("adds vbaProject.bin override for pptm with VBA", () => {
      const contentTypes: XmlObject = {
        Types: {
          Default: [],
          Override: [
            {
              "@_PartName": "/ppt/presentation.xml",
              "@_ContentType":
                "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
            },
          ],
        },
      };
      builder.applyOutputFormatOverride(contentTypes, "pptm", true);
      const overrides = (contentTypes["Types"] as XmlObject)[
        "Override"
      ] as any[];
      const vbaOverride = overrides.find(
        (o: any) => o["@_PartName"] === "/ppt/vbaProject.bin",
      );
      expect(vbaOverride).toBeDefined();
      expect(vbaOverride["@_ContentType"]).toBe(
        "application/vnd.ms-office.vbaProject",
      );
    });

    it("does not duplicate vbaProject.bin if already present", () => {
      const contentTypes: XmlObject = {
        Types: {
          Default: [],
          Override: [
            {
              "@_PartName": "/ppt/presentation.xml",
              "@_ContentType":
                "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
            },
            {
              "@_PartName": "/ppt/vbaProject.bin",
              "@_ContentType": "application/vnd.ms-office.vbaProject",
            },
          ],
        },
      };
      builder.applyOutputFormatOverride(contentTypes, "pptm", true);
      const overrides = (contentTypes["Types"] as XmlObject)[
        "Override"
      ] as any[];
      const vbaOverrides = overrides.filter(
        (o: any) =>
          o["@_ContentType"] === "application/vnd.ms-office.vbaProject",
      );
      expect(vbaOverrides).toHaveLength(1);
    });

    it("does not add vbaProject.bin for pptm when hasVba is false", () => {
      const contentTypes: XmlObject = {
        Types: {
          Default: [],
          Override: [
            {
              "@_PartName": "/ppt/presentation.xml",
              "@_ContentType":
                "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
            },
          ],
        },
      };
      builder.applyOutputFormatOverride(contentTypes, "pptm", false);
      const overrides = (contentTypes["Types"] as XmlObject)[
        "Override"
      ] as any[];
      const vbaOverride = overrides.find(
        (o: any) => o["@_PartName"] === "/ppt/vbaProject.bin",
      );
      expect(vbaOverride).toBeUndefined();
    });
  });

  // ── applyCustomXmlUpdates ────────────────────────────────────────────

  describe("applyCustomXmlUpdates", () => {
    const CUSTOM_XML_PROPS_CT =
      "application/vnd.openxmlformats-officedocument.customXmlProperties+xml";

    it("adds override entries for custom XML properties parts", () => {
      const contentTypes: XmlObject = {
        Types: { Default: [], Override: [] },
      };
      builder.applyCustomXmlUpdates({
        contentTypesData: contentTypes,
        customXmlParts: [
          { id: "1", data: "<root/>", properties: "<ds:datastoreItem/>" },
          { id: "2", data: "<data/>", properties: "<ds:datastoreItem/>" },
        ],
      });
      const overrides = (contentTypes["Types"] as XmlObject)[
        "Override"
      ] as any[];
      const customXmlOverrides = overrides.filter(
        (o: any) => o["@_ContentType"] === CUSTOM_XML_PROPS_CT,
      );
      expect(customXmlOverrides).toHaveLength(2);
      expect(customXmlOverrides[0]["@_PartName"]).toBe(
        "/customXml/itemProps1.xml",
      );
      expect(customXmlOverrides[1]["@_PartName"]).toBe(
        "/customXml/itemProps2.xml",
      );
    });

    it("does not add overrides for parts without properties", () => {
      const contentTypes: XmlObject = {
        Types: { Default: [], Override: [] },
      };
      builder.applyCustomXmlUpdates({
        contentTypesData: contentTypes,
        customXmlParts: [
          { id: "1", data: "<root/>" },
        ],
      });
      const overrides = (contentTypes["Types"] as XmlObject)[
        "Override"
      ] as any[];
      expect(overrides).toHaveLength(0);
    });

    it("does not duplicate existing custom XML overrides", () => {
      const contentTypes: XmlObject = {
        Types: {
          Default: [],
          Override: [
            {
              "@_PartName": "/customXml/itemProps1.xml",
              "@_ContentType": CUSTOM_XML_PROPS_CT,
            },
          ],
        },
      };
      builder.applyCustomXmlUpdates({
        contentTypesData: contentTypes,
        customXmlParts: [
          { id: "1", data: "<root/>", properties: "<ds:datastoreItem/>" },
        ],
      });
      const overrides = (contentTypes["Types"] as XmlObject)[
        "Override"
      ] as any[];
      const customXmlOverrides = overrides.filter(
        (o: any) => o["@_ContentType"] === CUSTOM_XML_PROPS_CT,
      );
      expect(customXmlOverrides).toHaveLength(1);
    });

    it("does nothing when customXmlParts is empty", () => {
      const contentTypes: XmlObject = {
        Types: {
          Default: [],
          Override: [
            {
              "@_PartName": "/ppt/presentation.xml",
              "@_ContentType": "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
            },
          ],
        },
      };
      builder.applyCustomXmlUpdates({
        contentTypesData: contentTypes,
        customXmlParts: [],
      });
      const overrides = (contentTypes["Types"] as XmlObject)[
        "Override"
      ] as any[];
      expect(overrides).toHaveLength(1);
    });

    it("preserves existing non-custom-xml overrides", () => {
      const contentTypes: XmlObject = {
        Types: {
          Default: [],
          Override: [
            {
              "@_PartName": "/ppt/presentation.xml",
              "@_ContentType": "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
            },
          ],
        },
      };
      builder.applyCustomXmlUpdates({
        contentTypesData: contentTypes,
        customXmlParts: [
          { id: "1", data: "<root/>", properties: "<ds:datastoreItem/>" },
        ],
      });
      const overrides = (contentTypes["Types"] as XmlObject)[
        "Override"
      ] as any[];
      expect(overrides).toHaveLength(2);
      expect(overrides[0]["@_PartName"]).toBe("/ppt/presentation.xml");
      expect(overrides[1]["@_PartName"]).toBe("/customXml/itemProps1.xml");
    });
  });

  // ── normalizePartName edge cases ─────────────────────────────────────

  describe("part name normalization", () => {
    it("handles slide paths without leading slash", () => {
      const contentTypes: XmlObject = {
        Types: { Default: [], Override: [] },
      };
      builder.applySlideAndMediaUpdates({
        contentTypesData: contentTypes,
        slidePaths: ["ppt/slides/slide1.xml"],
        usedMediaPaths: new Set(),
        slideContentType: SLIDE_CT,
      });
      const overrides = (contentTypes["Types"] as XmlObject)[
        "Override"
      ] as any[];
      // Should normalize to /ppt/slides/slide1.xml
      expect(overrides[0]["@_PartName"]).toBe("/ppt/slides/slide1.xml");
    });

    it("handles slide paths with leading slash", () => {
      const contentTypes: XmlObject = {
        Types: { Default: [], Override: [] },
      };
      builder.applySlideAndMediaUpdates({
        contentTypesData: contentTypes,
        slidePaths: ["/ppt/slides/slide1.xml"],
        usedMediaPaths: new Set(),
        slideContentType: SLIDE_CT,
      });
      const overrides = (contentTypes["Types"] as XmlObject)[
        "Override"
      ] as any[];
      expect(overrides[0]["@_PartName"]).toBe("/ppt/slides/slide1.xml");
    });
  });
});
