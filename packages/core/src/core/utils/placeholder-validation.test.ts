import { describe, it, expect } from "vitest";
import {
  isValidPlaceholderType,
  normalizePlaceholderType,
  getValidPlaceholderTypes,
} from "./placeholder-validation";

// ---------------------------------------------------------------------------
// isValidPlaceholderType
// ---------------------------------------------------------------------------

describe("isValidPlaceholderType", () => {
  it("returns true for core OOXML placeholder types", () => {
    const coreTypes = [
      "body", "chart", "clipArt", "ctrTitle", "dgm", "dt",
      "ftr", "hdr", "media", "obj", "pic", "sldImg",
      "sldNum", "subTitle", "tbl", "title",
    ];
    for (const t of coreTypes) {
      expect(isValidPlaceholderType(t)).toBe(true);
    }
  });

  it("returns true for extended placeholder types", () => {
    const extendedTypes = [
      "half", "qtr", "txAndClipArt", "txAndChart", "txAndMedia",
      "txAndObj", "txAndTwoObj", "txOverObj", "objAndTx",
      "twoObj", "twoObjAndObj", "twoObjAndTx", "twoObjOverTx",
      "objOverTx", "twoColTx", "fourObj",
    ];
    for (const t of extendedTypes) {
      expect(isValidPlaceholderType(t)).toBe(true);
    }
  });

  it("returns false for invalid placeholder types", () => {
    expect(isValidPlaceholderType("unknown")).toBe(false);
    expect(isValidPlaceholderType("")).toBe(false);
    expect(isValidPlaceholderType("header")).toBe(false);
    expect(isValidPlaceholderType("TITLE")).toBe(false); // case-sensitive
  });

  it("returns false for undefined-like strings", () => {
    expect(isValidPlaceholderType("undefined")).toBe(false);
    expect(isValidPlaceholderType("null")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizePlaceholderType
// ---------------------------------------------------------------------------

describe("normalizePlaceholderType", () => {
  it('returns "body" for undefined', () => {
    expect(normalizePlaceholderType(undefined)).toBe("body");
  });

  it('returns "body" for empty string', () => {
    expect(normalizePlaceholderType("")).toBe("body");
  });

  it('returns "body" for whitespace-only', () => {
    expect(normalizePlaceholderType("   ")).toBe("body");
  });

  it("lowercases the type", () => {
    expect(normalizePlaceholderType("Title")).toBe("title");
    expect(normalizePlaceholderType("BODY")).toBe("body");
  });

  it("trims whitespace", () => {
    expect(normalizePlaceholderType("  title  ")).toBe("title");
  });

  it("passes through valid types unchanged (after normalization)", () => {
    expect(normalizePlaceholderType("ctrTitle")).toBe("ctrtitle");
    expect(normalizePlaceholderType("sldNum")).toBe("sldnum");
  });
});

// ---------------------------------------------------------------------------
// getValidPlaceholderTypes
// ---------------------------------------------------------------------------

describe("getValidPlaceholderTypes", () => {
  it("returns a Set", () => {
    const types = getValidPlaceholderTypes();
    expect(types).toBeInstanceOf(Set);
  });

  it("contains core types", () => {
    const types = getValidPlaceholderTypes();
    expect(types.has("title")).toBe(true);
    expect(types.has("body")).toBe(true);
    expect(types.has("sldNum")).toBe(true);
  });

  it("returns the same set on multiple calls (immutable)", () => {
    const a = getValidPlaceholderTypes();
    const b = getValidPlaceholderTypes();
    expect(a).toBe(b);
  });

  it("has at least 20 entries", () => {
    const types = getValidPlaceholderTypes();
    expect(types.size).toBeGreaterThanOrEqual(20);
  });
});
