import { describe, it, expect } from "vitest";
import type { XmlObject } from "../../types";

// ---------------------------------------------------------------------------
// Extracted from PptxHandlerRuntimeSlideMasters — pure helper functions
// ---------------------------------------------------------------------------

/**
 * Resolve a relative path against a base path.
 * Extracted from PptxHandlerRuntime.resolvePath.
 */
function resolvePath(base: string, relative: string): string {
  const baseParts = base.split("/").filter(Boolean);
  const relParts = relative.split("/");

  // Remove filename from base if present
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

/**
 * Resolve an image path relative to a slide path.
 * Extracted from PptxHandlerRuntime.resolveImagePath.
 */
function resolveImagePath(slidePath: string, target: string): string {
  const slideDir = slidePath.substring(0, slidePath.lastIndexOf("/") + 1);
  return target.startsWith("..")
    ? resolvePath(slideDir, target)
    : target.startsWith("/")
      ? target.substring(1)
      : slideDir + target;
}

/**
 * Extract placeholder type+idx from all shapes in a shape tree.
 * Extracted from PptxHandlerRuntime.extractPlaceholderList.
 */
function extractPlaceholderList(
  spTree: XmlObject | undefined,
): Array<{ type: string; idx?: string }> {
  if (!spTree) return [];
  const shapes = ensureArray(spTree["p:sp"]);
  const result: Array<{ type: string; idx?: string }> = [];
  for (const sp of shapes) {
    const nvPr = sp?.["p:nvSpPr"]?.["p:nvPr"] as XmlObject | undefined;
    const ph = nvPr?.["p:ph"] as XmlObject | undefined;
    if (!ph) continue;
    const type = String(ph["@_type"] || "body").trim();
    const idx = ph["@_idx"] != null ? String(ph["@_idx"]) : undefined;
    result.push({ type, idx });
  }
  return result;
}

function ensureArray(value: unknown): XmlObject[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value as XmlObject];
}

// ---------------------------------------------------------------------------
// resolvePath
// ---------------------------------------------------------------------------
describe("resolvePath", () => {
  it("should resolve a sibling file in the same directory", () => {
    expect(resolvePath("ppt/slides/slide1.xml", "slide2.xml")).toBe(
      "ppt/slides/slide2.xml",
    );
  });

  it("should resolve a parent-relative path with ..", () => {
    expect(
      resolvePath("ppt/slides/slide1.xml", "../slideLayouts/slideLayout1.xml"),
    ).toBe("ppt/slideLayouts/slideLayout1.xml");
  });

  it("should resolve double parent traversal", () => {
    expect(
      resolvePath("ppt/slides/slide1.xml", "../../theme/theme1.xml"),
    ).toBe("theme/theme1.xml");
  });

  it("should resolve current directory reference with .", () => {
    expect(resolvePath("ppt/slides/slide1.xml", "./image.png")).toBe(
      "ppt/slides/image.png",
    );
  });

  it("should handle a trailing slash in base as a directory", () => {
    expect(resolvePath("ppt/slides/", "slide2.xml")).toBe(
      "ppt/slides/slide2.xml",
    );
  });

  it("should handle deeply nested path with multiple .. traversals", () => {
    expect(
      resolvePath(
        "ppt/a/b/c/file.xml",
        "../../../media/image1.png",
      ),
    ).toBe("ppt/media/image1.png");
  });

  it("should resolve a simple relative path with no traversals", () => {
    expect(resolvePath("file.xml", "other.xml")).toBe("other.xml");
  });
});

// ---------------------------------------------------------------------------
// resolveImagePath
// ---------------------------------------------------------------------------
describe("resolveImagePath", () => {
  it("should resolve a parent-relative image path", () => {
    expect(
      resolveImagePath("ppt/slides/slide1.xml", "../media/image1.png"),
    ).toBe("ppt/media/image1.png");
  });

  it("should resolve a same-directory image path", () => {
    expect(
      resolveImagePath("ppt/slides/slide1.xml", "image.png"),
    ).toBe("ppt/slides/image.png");
  });

  it("should strip leading slash from absolute target", () => {
    expect(
      resolveImagePath("ppt/slides/slide1.xml", "/ppt/media/image1.png"),
    ).toBe("ppt/media/image1.png");
  });

  it("should handle target starting with ../.. correctly", () => {
    expect(
      resolveImagePath("ppt/slides/slide1.xml", "../../docProps/thumbnail.jpeg"),
    ).toBe("docProps/thumbnail.jpeg");
  });

  it("should handle slide path with deep nesting", () => {
    expect(
      resolveImagePath("ppt/slides/folder/slide1.xml", "../media/pic.png"),
    ).toBe("ppt/slides/media/pic.png");
  });
});

// ---------------------------------------------------------------------------
// extractPlaceholderList
// ---------------------------------------------------------------------------
describe("extractPlaceholderList", () => {
  it("should return empty array for undefined spTree", () => {
    expect(extractPlaceholderList(undefined)).toEqual([]);
  });

  it("should return empty array when spTree has no shapes", () => {
    expect(extractPlaceholderList({})).toEqual([]);
  });

  it("should extract a single placeholder with type and idx", () => {
    const spTree: XmlObject = {
      "p:sp": {
        "p:nvSpPr": {
          "p:nvPr": {
            "p:ph": { "@_type": "title", "@_idx": "0" },
          },
        },
      },
    };
    const result = extractPlaceholderList(spTree);
    expect(result).toEqual([{ type: "title", idx: "0" }]);
  });

  it("should extract multiple placeholders from array of shapes", () => {
    const spTree: XmlObject = {
      "p:sp": [
        {
          "p:nvSpPr": {
            "p:nvPr": { "p:ph": { "@_type": "title", "@_idx": "0" } },
          },
        },
        {
          "p:nvSpPr": {
            "p:nvPr": { "p:ph": { "@_type": "body", "@_idx": "1" } },
          },
        },
      ],
    };
    const result = extractPlaceholderList(spTree);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: "title", idx: "0" });
    expect(result[1]).toEqual({ type: "body", idx: "1" });
  });

  it("should default type to 'body' when @_type is missing", () => {
    const spTree: XmlObject = {
      "p:sp": {
        "p:nvSpPr": {
          "p:nvPr": { "p:ph": { "@_idx": "5" } },
        },
      },
    };
    const result = extractPlaceholderList(spTree);
    expect(result).toEqual([{ type: "body", idx: "5" }]);
  });

  it("should set idx to undefined when @_idx is missing", () => {
    const spTree: XmlObject = {
      "p:sp": {
        "p:nvSpPr": {
          "p:nvPr": { "p:ph": { "@_type": "dt" } },
        },
      },
    };
    const result = extractPlaceholderList(spTree);
    expect(result).toEqual([{ type: "dt", idx: undefined }]);
  });

  it("should skip shapes without p:ph element", () => {
    const spTree: XmlObject = {
      "p:sp": [
        {
          "p:nvSpPr": {
            "p:nvPr": { "p:ph": { "@_type": "title" } },
          },
        },
        {
          "p:nvSpPr": {
            "p:nvPr": {},
          },
        },
        {
          "p:nvSpPr": {},
        },
      ],
    };
    const result = extractPlaceholderList(spTree);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("title");
  });

  it("should handle numeric idx values", () => {
    const spTree: XmlObject = {
      "p:sp": {
        "p:nvSpPr": {
          "p:nvPr": { "p:ph": { "@_type": "ftr", "@_idx": 10 } },
        },
      },
    };
    const result = extractPlaceholderList(spTree);
    expect(result).toEqual([{ type: "ftr", idx: "10" }]);
  });
});
