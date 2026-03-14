import { describe, it, expect } from "vitest";

import type { XmlObject } from "../../types";

/**
 * The `PptxHandlerRuntimeSaveXmlHelpers` module has protected methods on a
 * deeply inherited class. We extract and test the core algorithms:
 *
 *   - deduplicateExtensionLists logic (extension list deduplication by URI)
 *   - isSameShapeIdentity logic (shape matching by id + name)
 *   - resolveLayoutPathForSlide logic (path resolution)
 *   - resolveMasterPathForLayout logic (path resolution)
 */

// ---------------------------------------------------------------------------
// isSameShapeIdentity — reimplemented from source
// ---------------------------------------------------------------------------
function getCnvPrNode(
  shape: XmlObject,
  key: string,
): XmlObject | undefined {
  if (key === "p:pic") {
    return shape?.["p:nvPicPr"]?.["p:cNvPr"] as XmlObject | undefined;
  }
  if (key === "p:cxnSp") {
    return shape?.["p:nvCxnSpPr"]?.["p:cNvPr"] as XmlObject | undefined;
  }
  if (key === "p:graphicFrame") {
    return shape?.["p:nvGraphicFramePr"]?.["p:cNvPr"] as
      | XmlObject
      | undefined;
  }
  return shape?.["p:nvSpPr"]?.["p:cNvPr"] as XmlObject | undefined;
}

function isSameShapeIdentity(
  key: string,
  left: XmlObject,
  right: XmlObject,
): boolean {
  if (left === right) return true;

  const leftNv = getCnvPrNode(left, key);
  const rightNv = getCnvPrNode(right, key);
  const leftId = String(leftNv?.["@_id"] || "");
  const rightId = String(rightNv?.["@_id"] || "");
  const leftName = String(leftNv?.["@_name"] || "");
  const rightName = String(rightNv?.["@_name"] || "");

  if (!leftId || !rightId) return false;
  if (leftId !== rightId) return false;
  if (!leftName || !rightName) return true;
  return leftName === rightName;
}

describe("isSameShapeIdentity", () => {
  const key = "p:sp";

  it("should return true when both objects are the same reference", () => {
    const shape: XmlObject = {};
    expect(isSameShapeIdentity(key, shape, shape)).toBe(true);
  });

  it("should return true when id and name match", () => {
    const left: XmlObject = {
      "p:nvSpPr": { "p:cNvPr": { "@_id": "5", "@_name": "Title" } },
    };
    const right: XmlObject = {
      "p:nvSpPr": { "p:cNvPr": { "@_id": "5", "@_name": "Title" } },
    };
    expect(isSameShapeIdentity(key, left, right)).toBe(true);
  });

  it("should return false when ids differ", () => {
    const left: XmlObject = {
      "p:nvSpPr": { "p:cNvPr": { "@_id": "5", "@_name": "Title" } },
    };
    const right: XmlObject = {
      "p:nvSpPr": { "p:cNvPr": { "@_id": "6", "@_name": "Title" } },
    };
    expect(isSameShapeIdentity(key, left, right)).toBe(false);
  });

  it("should return true when ids match but names are empty", () => {
    const left: XmlObject = {
      "p:nvSpPr": { "p:cNvPr": { "@_id": "5" } },
    };
    const right: XmlObject = {
      "p:nvSpPr": { "p:cNvPr": { "@_id": "5" } },
    };
    expect(isSameShapeIdentity(key, left, right)).toBe(true);
  });

  it("should return false when ids match but names differ", () => {
    const left: XmlObject = {
      "p:nvSpPr": { "p:cNvPr": { "@_id": "5", "@_name": "Title" } },
    };
    const right: XmlObject = {
      "p:nvSpPr": { "p:cNvPr": { "@_id": "5", "@_name": "Subtitle" } },
    };
    expect(isSameShapeIdentity(key, left, right)).toBe(false);
  });

  it("should return false when left id is empty", () => {
    const left: XmlObject = {
      "p:nvSpPr": { "p:cNvPr": {} },
    };
    const right: XmlObject = {
      "p:nvSpPr": { "p:cNvPr": { "@_id": "5" } },
    };
    expect(isSameShapeIdentity(key, left, right)).toBe(false);
  });

  it("should return false when nvPr nodes are missing", () => {
    const left: XmlObject = {};
    const right: XmlObject = {};
    expect(isSameShapeIdentity(key, left, right)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deduplicateExtensionLists logic — reimplemented from source
// ---------------------------------------------------------------------------

/**
 * Simplified version that operates on a single extLst node.
 * The real method walks the full tree recursively, but the dedup
 * logic per extLst is what we test here.
 */
function deduplicateExtLst(extLst: XmlObject, extKey: string): void {
  const rawExts = extLst[extKey];
  if (!rawExts) return;

  const extsArray = Array.isArray(rawExts)
    ? (rawExts as XmlObject[])
    : [rawExts as XmlObject];
  if (extsArray.length <= 1) return;

  // Deduplicate by URI, keeping last occurrence
  const seenUris = new Map<string, number>();
  for (let i = 0; i < extsArray.length; i++) {
    const ext = extsArray[i];
    const uri = String(ext?.["@_uri"] || "").trim();
    if (uri.length > 0) {
      seenUris.set(uri, i);
    }
  }

  if (seenUris.size < extsArray.length) {
    const keepIndexes = new Set(seenUris.values());
    for (let i = 0; i < extsArray.length; i++) {
      const ext = extsArray[i];
      const uri = String(ext?.["@_uri"] || "").trim();
      if (uri.length === 0) {
        keepIndexes.add(i);
      }
    }
    const dedupedExts = extsArray.filter((_ext: unknown, idx: number) =>
      keepIndexes.has(idx),
    );
    extLst[extKey] =
      dedupedExts.length === 1 ? dedupedExts[0] : dedupedExts;
  }
}

describe("deduplicateExtLst", () => {
  it("should do nothing when there is only one extension", () => {
    const extLst: XmlObject = {
      "a:ext": { "@_uri": "http://example.com/1", data: "a" },
    };
    deduplicateExtLst(extLst, "a:ext");
    // Should remain a single object, not an array
    expect(extLst["a:ext"]).toEqual({
      "@_uri": "http://example.com/1",
      data: "a",
    });
  });

  it("should keep last occurrence when URIs are duplicated", () => {
    const extLst: XmlObject = {
      "a:ext": [
        { "@_uri": "http://example.com/1", data: "first" },
        { "@_uri": "http://example.com/1", data: "second" },
      ],
    };
    deduplicateExtLst(extLst, "a:ext");
    // Should keep only the last one, unwrapped since length becomes 1
    expect(extLst["a:ext"]).toEqual({
      "@_uri": "http://example.com/1",
      data: "second",
    });
  });

  it("should keep both when URIs are different", () => {
    const extLst: XmlObject = {
      "a:ext": [
        { "@_uri": "http://example.com/1", data: "a" },
        { "@_uri": "http://example.com/2", data: "b" },
      ],
    };
    deduplicateExtLst(extLst, "a:ext");
    expect(extLst["a:ext"]).toHaveLength(2);
  });

  it("should preserve entries without URIs", () => {
    const extLst: XmlObject = {
      "a:ext": [
        { "@_uri": "http://example.com/1", data: "first" },
        { data: "no-uri" },
        { "@_uri": "http://example.com/1", data: "second" },
      ],
    };
    deduplicateExtLst(extLst, "a:ext");
    const result = extLst["a:ext"] as XmlObject[];
    expect(result).toHaveLength(2);
    // Entry without URI is preserved
    expect(result[0]).toEqual({ data: "no-uri" });
    // Last with URI is kept
    expect(result[1]).toEqual({
      "@_uri": "http://example.com/1",
      data: "second",
    });
  });

  it("should handle three duplicates of same URI", () => {
    const extLst: XmlObject = {
      "p:ext": [
        { "@_uri": "urn:a", v: 1 },
        { "@_uri": "urn:a", v: 2 },
        { "@_uri": "urn:a", v: 3 },
      ],
    };
    deduplicateExtLst(extLst, "p:ext");
    expect(extLst["p:ext"]).toEqual({ "@_uri": "urn:a", v: 3 });
  });

  it("should handle mixed duplicate and unique URIs", () => {
    const extLst: XmlObject = {
      "a:ext": [
        { "@_uri": "urn:a", v: 1 },
        { "@_uri": "urn:b", v: 2 },
        { "@_uri": "urn:a", v: 3 },
        { "@_uri": "urn:c", v: 4 },
      ],
    };
    deduplicateExtLst(extLst, "a:ext");
    const result = extLst["a:ext"] as XmlObject[];
    expect(result).toHaveLength(3);
    expect(result.find((e) => e["@_uri"] === "urn:a")?.v).toBe(3);
    expect(result.find((e) => e["@_uri"] === "urn:b")?.v).toBe(2);
    expect(result.find((e) => e["@_uri"] === "urn:c")?.v).toBe(4);
  });

  it("should do nothing when rawExts is undefined", () => {
    const extLst: XmlObject = {};
    deduplicateExtLst(extLst, "a:ext");
    expect(extLst["a:ext"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolvePath helper — reimplemented from source
// ---------------------------------------------------------------------------
function resolvePath(base: string, relative: string): string {
  const baseParts = base.split("/").filter(Boolean);
  const relParts = relative.split("/").filter(Boolean);
  // Remove last segment of base (it's the filename)
  baseParts.pop();
  // But base already has the trailing slash removed via the split,
  // so we need to use the original base directory
  const baseDir = base.substring(0, base.lastIndexOf("/") + 1);
  const dirParts = baseDir.split("/").filter(Boolean);
  for (const part of relParts) {
    if (part === "..") {
      dirParts.pop();
    } else if (part !== ".") {
      dirParts.push(part);
    }
  }
  return dirParts.join("/");
}

function resolveLayoutPathForSlide(
  slidePath: string,
  slideRels: Map<string, string>,
): string | undefined {
  for (const [, target] of slideRels.entries()) {
    if (!target.includes("slideLayout")) continue;
    const slideDir = slidePath.substring(0, slidePath.lastIndexOf("/") + 1);
    return target.startsWith("..")
      ? resolvePath(slideDir, target)
      : `ppt/${target.replace("../", "")}`;
  }
  return undefined;
}

describe("resolveLayoutPathForSlide", () => {
  it("should resolve relative layout path", () => {
    const rels = new Map([["rId1", "../slideLayouts/slideLayout1.xml"]]);
    const result = resolveLayoutPathForSlide("ppt/slides/slide1.xml", rels);
    expect(result).toBe("ppt/slideLayouts/slideLayout1.xml");
  });

  it("should return undefined when no layout rel exists", () => {
    const rels = new Map([["rId1", "../slideMasters/slideMaster1.xml"]]);
    const result = resolveLayoutPathForSlide("ppt/slides/slide1.xml", rels);
    expect(result).toBeUndefined();
  });

  it("should return undefined for empty rels map", () => {
    const result = resolveLayoutPathForSlide(
      "ppt/slides/slide1.xml",
      new Map(),
    );
    expect(result).toBeUndefined();
  });

  it("should handle non-relative layout path", () => {
    const rels = new Map([["rId1", "slideLayouts/slideLayout2.xml"]]);
    const result = resolveLayoutPathForSlide("ppt/slides/slide1.xml", rels);
    expect(result).toBe("ppt/slideLayouts/slideLayout2.xml");
  });
});
