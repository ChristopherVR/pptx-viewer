import { describe, it, expect } from "vitest";
import {
  matchMorphElements,
  matchMorphElementsFull,
  generateMorphAnimations,
  generateUnmatchedFadeOutAnimations,
  generateUnmatchedFadeInAnimations,
  generateTextMorphAnimations,
  generateFullMorphTransition,
  parseHexColor,
  lerpColor,
  rgbaToHex,
  parseSvgPath,
  serializeSvgPath,
  equalizePaths,
  interpolatePaths,
  tokenizeText,
  matchTextTokens,
  buildColorInterpolationProps,
  buildStrokeInterpolationProps,
  getElementMorphName,
  MORPH_EASING,
} from "./morph-transition";
import type {
  MorphPair,
  MorphMode,
  RgbaColor,
  SvgPathCommand,
} from "./morph-transition";
import type { PptxElement, PptxSlide } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeElement(
  overrides: Partial<PptxElement> & { id: string; type: PptxElement["type"] },
): PptxElement {
  return {
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    ...overrides,
  } as PptxElement;
}

function makeSlide(elements: PptxElement[]): PptxSlide {
  return {
    id: "slide-1",
    elements,
  } as PptxSlide;
}

// ==========================================================================
// parseHexColor
// ==========================================================================

describe("parseHexColor", () => {
  it("parses 6-digit hex", () => {
    const c = parseHexColor("#FF8800");
    expect(c).toEqual({ r: 255, g: 136, b: 0, a: 1 });
  });

  it("parses 6-digit hex without #", () => {
    const c = parseHexColor("FF8800");
    expect(c).toEqual({ r: 255, g: 136, b: 0, a: 1 });
  });

  it("parses 3-digit shorthand hex", () => {
    const c = parseHexColor("#F80");
    expect(c).toEqual({ r: 255, g: 136, b: 0, a: 1 });
  });

  it("parses 8-digit hex with alpha", () => {
    const c = parseHexColor("#FF880080");
    expect(c).not.toBeNull();
    expect(c!.r).toBe(255);
    expect(c!.g).toBe(136);
    expect(c!.b).toBe(0);
    expect(c!.a).toBeCloseTo(128 / 255, 2);
  });

  it("parses 4-digit shorthand with alpha", () => {
    const c = parseHexColor("#F808");
    expect(c).not.toBeNull();
    expect(c!.r).toBe(255);
    expect(c!.g).toBe(136);
    expect(c!.b).toBe(0);
    expect(c!.a).toBeCloseTo(136 / 255, 2);
  });

  it("returns null for undefined", () => {
    expect(parseHexColor(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseHexColor("")).toBeNull();
  });

  it("returns null for invalid hex", () => {
    expect(parseHexColor("#ZZZZZZ")).toBeNull();
  });

  it("returns null for wrong length", () => {
    expect(parseHexColor("#12345")).toBeNull();
  });
});

// ==========================================================================
// lerpColor
// ==========================================================================

describe("lerpColor", () => {
  const black: RgbaColor = { r: 0, g: 0, b: 0, a: 1 };
  const white: RgbaColor = { r: 255, g: 255, b: 255, a: 1 };

  it("returns from color at t=0", () => {
    expect(lerpColor(black, white, 0)).toBe("rgba(0, 0, 0, 1)");
  });

  it("returns to color at t=1", () => {
    expect(lerpColor(black, white, 1)).toBe("rgba(255, 255, 255, 1)");
  });

  it("returns midpoint at t=0.5", () => {
    const result = lerpColor(black, white, 0.5);
    expect(result).toBe("rgba(128, 128, 128, 1)");
  });

  it("clamps t below 0", () => {
    expect(lerpColor(black, white, -1)).toBe("rgba(0, 0, 0, 1)");
  });

  it("clamps t above 1", () => {
    expect(lerpColor(black, white, 2)).toBe("rgba(255, 255, 255, 1)");
  });

  it("interpolates alpha channel", () => {
    const from = { r: 0, g: 0, b: 0, a: 0 };
    const to = { r: 0, g: 0, b: 0, a: 1 };
    const result = lerpColor(from, to, 0.5);
    expect(result).toBe("rgba(0, 0, 0, 0.5)");
  });
});

// ==========================================================================
// rgbaToHex
// ==========================================================================

describe("rgbaToHex", () => {
  it("converts opaque color to 6-digit hex", () => {
    expect(rgbaToHex({ r: 255, g: 136, b: 0, a: 1 })).toBe("#ff8800");
  });

  it("converts color with alpha to 8-digit hex", () => {
    const result = rgbaToHex({ r: 255, g: 0, b: 0, a: 0.5 });
    expect(result).toBe("#ff000080");
  });

  it("converts black", () => {
    expect(rgbaToHex({ r: 0, g: 0, b: 0, a: 1 })).toBe("#000000");
  });

  it("converts white", () => {
    expect(rgbaToHex({ r: 255, g: 255, b: 255, a: 1 })).toBe("#ffffff");
  });
});

// ==========================================================================
// SVG path parsing
// ==========================================================================

describe("parseSvgPath", () => {
  it("parses simple M L Z path", () => {
    const cmds = parseSvgPath("M0 0 L100 0 L100 100 Z");
    expect(cmds.length).toBe(4);
    expect(cmds[0]).toEqual({ type: "M", values: [0, 0] });
    expect(cmds[1]).toEqual({ type: "L", values: [100, 0] });
    expect(cmds[2]).toEqual({ type: "L", values: [100, 100] });
    expect(cmds[3]).toEqual({ type: "Z", values: [] });
  });

  it("parses cubic bezier commands", () => {
    const cmds = parseSvgPath("M0 0 C10 20 30 40 50 60");
    expect(cmds.length).toBe(2);
    expect(cmds[1]).toEqual({ type: "C", values: [10, 20, 30, 40, 50, 60] });
  });

  it("handles negative values", () => {
    const cmds = parseSvgPath("M-10 -20 L-30 -40");
    expect(cmds[0].values).toEqual([-10, -20]);
    expect(cmds[1].values).toEqual([-30, -40]);
  });

  it("handles decimal values", () => {
    const cmds = parseSvgPath("M0.5 1.5 L2.25 3.75");
    expect(cmds[0].values).toEqual([0.5, 1.5]);
    expect(cmds[1].values).toEqual([2.25, 3.75]);
  });

  it("returns empty array for empty string", () => {
    expect(parseSvgPath("")).toEqual([]);
  });

  it("returns empty array for undefined-like input", () => {
    expect(parseSvgPath(null as unknown as string)).toEqual([]);
  });

  it("handles lowercase (relative) commands", () => {
    const cmds = parseSvgPath("m0 0 l10 10 z");
    expect(cmds.length).toBe(3);
    expect(cmds[0].type).toBe("m");
    expect(cmds[1].type).toBe("l");
  });
});

describe("serializeSvgPath", () => {
  it("serializes commands back to string", () => {
    const cmds: SvgPathCommand[] = [
      { type: "M", values: [0, 0] },
      { type: "L", values: [100, 50] },
      { type: "Z", values: [] },
    ];
    const result = serializeSvgPath(cmds);
    expect(result).toBe("M0 0 L100 50 Z");
  });

  it("rounds to 2 decimal places", () => {
    const cmds: SvgPathCommand[] = [
      { type: "M", values: [1.23456, 7.89012] },
    ];
    const result = serializeSvgPath(cmds);
    expect(result).toBe("M1.23 7.89");
  });
});

// ==========================================================================
// SVG path equalisation
// ==========================================================================

describe("equalizePaths", () => {
  it("returns null for empty input", () => {
    expect(equalizePaths([], [{ type: "M", values: [0, 0] }])).toBeNull();
    expect(equalizePaths([{ type: "M", values: [0, 0] }], [])).toBeNull();
  });

  it("keeps same-length paths unchanged", () => {
    const a: SvgPathCommand[] = [
      { type: "M", values: [0, 0] },
      { type: "L", values: [100, 100] },
      { type: "Z", values: [] },
    ];
    const b: SvgPathCommand[] = [
      { type: "M", values: [10, 10] },
      { type: "L", values: [200, 200] },
      { type: "Z", values: [] },
    ];
    const result = equalizePaths(a, b);
    expect(result).not.toBeNull();
    expect(result![0].length).toBe(3);
    expect(result![1].length).toBe(3);
  });

  it("pads shorter path to match longer", () => {
    const a: SvgPathCommand[] = [
      { type: "M", values: [0, 0] },
      { type: "L", values: [100, 0] },
      { type: "Z", values: [] },
    ];
    const b: SvgPathCommand[] = [
      { type: "M", values: [0, 0] },
      { type: "L", values: [50, 0] },
      { type: "L", values: [100, 50] },
      { type: "L", values: [100, 100] },
      { type: "Z", values: [] },
    ];
    const result = equalizePaths(a, b);
    expect(result).not.toBeNull();
    expect(result![0].length).toBe(result![1].length);
  });

  it("promotes L to C when paired with C", () => {
    const a: SvgPathCommand[] = [
      { type: "M", values: [0, 0] },
      { type: "L", values: [100, 100] },
    ];
    const b: SvgPathCommand[] = [
      { type: "M", values: [0, 0] },
      { type: "C", values: [10, 20, 30, 40, 100, 100] },
    ];
    const result = equalizePaths(a, b);
    expect(result).not.toBeNull();
    // The L should have been converted to C with 6 values
    expect(result![0][1].type).toBe("C");
    expect(result![0][1].values.length).toBe(6);
  });

  it("equalises value counts by padding with zeros", () => {
    const a: SvgPathCommand[] = [
      { type: "M", values: [0, 0] },
    ];
    const b: SvgPathCommand[] = [
      { type: "M", values: [0, 0, 10, 20] },
    ];
    const result = equalizePaths(a, b);
    expect(result).not.toBeNull();
    expect(result![0][0].values.length).toBe(4);
    expect(result![1][0].values.length).toBe(4);
  });
});

// ==========================================================================
// SVG path interpolation
// ==========================================================================

describe("interpolatePaths", () => {
  it("returns from path at t=0", () => {
    const from: SvgPathCommand[] = [
      { type: "M", values: [0, 0] },
      { type: "L", values: [100, 0] },
    ];
    const to: SvgPathCommand[] = [
      { type: "M", values: [50, 50] },
      { type: "L", values: [200, 100] },
    ];
    const result = interpolatePaths(from, to, 0);
    expect(result[0].values).toEqual([0, 0]);
    expect(result[1].values).toEqual([100, 0]);
  });

  it("returns to path at t=1", () => {
    const from: SvgPathCommand[] = [
      { type: "M", values: [0, 0] },
      { type: "L", values: [100, 0] },
    ];
    const to: SvgPathCommand[] = [
      { type: "M", values: [50, 50] },
      { type: "L", values: [200, 100] },
    ];
    const result = interpolatePaths(from, to, 1);
    expect(result[0].values).toEqual([50, 50]);
    expect(result[1].values).toEqual([200, 100]);
  });

  it("returns midpoint at t=0.5", () => {
    const from: SvgPathCommand[] = [
      { type: "M", values: [0, 0] },
    ];
    const to: SvgPathCommand[] = [
      { type: "M", values: [100, 200] },
    ];
    const result = interpolatePaths(from, to, 0.5);
    expect(result[0].values[0]).toBeCloseTo(50);
    expect(result[0].values[1]).toBeCloseTo(100);
  });

  it("clamps t below 0", () => {
    const from: SvgPathCommand[] = [{ type: "M", values: [0, 0] }];
    const to: SvgPathCommand[] = [{ type: "M", values: [100, 100] }];
    const result = interpolatePaths(from, to, -1);
    expect(result[0].values).toEqual([0, 0]);
  });

  it("clamps t above 1", () => {
    const from: SvgPathCommand[] = [{ type: "M", values: [0, 0] }];
    const to: SvgPathCommand[] = [{ type: "M", values: [100, 100] }];
    const result = interpolatePaths(from, to, 2);
    expect(result[0].values).toEqual([100, 100]);
  });

  it("preserves command types from 'to' array", () => {
    const from: SvgPathCommand[] = [
      { type: "M", values: [0, 0] },
      { type: "Z", values: [] },
    ];
    const to: SvgPathCommand[] = [
      { type: "M", values: [10, 10] },
      { type: "Z", values: [] },
    ];
    const result = interpolatePaths(from, to, 0.5);
    expect(result[1].type).toBe("Z");
  });
});

// ==========================================================================
// getElementMorphName
// ==========================================================================

describe("getElementMorphName", () => {
  it("returns !! prefixed text as morph name", () => {
    const el = makeElement({ id: "a", type: "text", text: "!!hero" });
    expect(getElementMorphName(el)).toBe("!!hero");
  });

  it("trims whitespace around !! name", () => {
    const el = makeElement({ id: "a", type: "text", text: "  !!title  " });
    expect(getElementMorphName(el)).toBe("!!title");
  });

  it("returns undefined for text without !! prefix", () => {
    const el = makeElement({ id: "a", type: "text", text: "Hello World" });
    expect(getElementMorphName(el)).toBeUndefined();
  });

  it("returns undefined for shape element without text", () => {
    const el = makeElement({ id: "a", type: "shape" });
    expect(getElementMorphName(el)).toBeUndefined();
  });

  it("returns undefined for image element", () => {
    const el = makeElement({ id: "a", type: "image" });
    expect(getElementMorphName(el)).toBeUndefined();
  });

  it("returns undefined for empty text", () => {
    const el = makeElement({ id: "a", type: "text", text: "" });
    expect(getElementMorphName(el)).toBeUndefined();
  });
});

// ==========================================================================
// matchMorphElements
// ==========================================================================

describe("matchMorphElements", () => {
  it("should match elements by !! naming convention", () => {
    const from = makeSlide([
      makeElement({ id: "a", type: "text", text: "!!title", x: 10, y: 10 }),
    ]);
    const to = makeSlide([
      makeElement({ id: "b", type: "text", text: "!!title", x: 50, y: 50 }),
    ]);
    const pairs = matchMorphElements(from, to);
    expect(pairs.length).toBe(1);
    expect(pairs[0].fromElement.id).toBe("a");
    expect(pairs[0].toElement.id).toBe("b");
  });

  it("should match elements by ID when names do not match", () => {
    const from = makeSlide([
      makeElement({ id: "elem1", type: "shape", x: 0, y: 0 }),
    ]);
    const to = makeSlide([
      makeElement({ id: "elem1", type: "shape", x: 100, y: 100 }),
    ]);
    const pairs = matchMorphElements(from, to);
    expect(pairs.length).toBe(1);
    expect(pairs[0].fromElement.id).toBe("elem1");
    expect(pairs[0].toElement.id).toBe("elem1");
  });

  it("should match by type and proximity as third pass", () => {
    const from = makeSlide([
      makeElement({ id: "a", type: "shape", x: 10, y: 10 }),
    ]);
    const to = makeSlide([
      makeElement({ id: "b", type: "shape", x: 20, y: 20 }),
    ]);
    const pairs = matchMorphElements(from, to);
    expect(pairs.length).toBe(1);
    expect(pairs[0].fromElement.id).toBe("a");
    expect(pairs[0].toElement.id).toBe("b");
  });

  it("should not match by proximity when distance exceeds 300px", () => {
    const from = makeSlide([
      makeElement({ id: "a", type: "shape", x: 0, y: 0 }),
    ]);
    const to = makeSlide([
      makeElement({ id: "b", type: "shape", x: 500, y: 500 }),
    ]);
    const pairs = matchMorphElements(from, to);
    expect(pairs.length).toBe(0);
  });

  it("should not match elements of different types by proximity", () => {
    const from = makeSlide([
      makeElement({ id: "a", type: "shape", x: 10, y: 10 }),
    ]);
    const to = makeSlide([
      makeElement({ id: "b", type: "image", x: 15, y: 15 }),
    ]);
    const pairs = matchMorphElements(from, to);
    expect(pairs.length).toBe(0);
  });

  it("should prefer !! naming over ID matching", () => {
    const from = makeSlide([
      makeElement({
        id: "shared",
        type: "text",
        text: "!!hero",
        x: 0,
        y: 0,
      }),
    ]);
    const to = makeSlide([
      makeElement({
        id: "different",
        type: "text",
        text: "!!hero",
        x: 50,
        y: 50,
      }),
      makeElement({
        id: "shared",
        type: "text",
        text: "other",
        x: 100,
        y: 100,
      }),
    ]);
    const pairs = matchMorphElements(from, to);
    const heroPair = pairs.find((p) => p.fromElement.id === "shared");
    expect(heroPair).toBeDefined();
    expect(heroPair!.toElement.id).toBe("different");
  });

  it("should return empty array when both slides have no elements", () => {
    const from = makeSlide([]);
    const to = makeSlide([]);
    expect(matchMorphElements(from, to)).toEqual([]);
  });

  it("should handle unmatched elements on both slides", () => {
    const from = makeSlide([
      makeElement({ id: "a", type: "shape", x: 0, y: 0 }),
    ]);
    const to = makeSlide([
      makeElement({ id: "b", type: "image", x: 500, y: 500 }),
    ]);
    const pairs = matchMorphElements(from, to);
    expect(pairs.length).toBe(0);
  });

  it("should match multiple elements in order", () => {
    const from = makeSlide([
      makeElement({ id: "a", type: "text", text: "!!first", x: 10, y: 10 }),
      makeElement({ id: "b", type: "text", text: "!!second", x: 10, y: 100 }),
    ]);
    const to = makeSlide([
      makeElement({ id: "c", type: "text", text: "!!second", x: 50, y: 100 }),
      makeElement({ id: "d", type: "text", text: "!!first", x: 50, y: 10 }),
    ]);
    const pairs = matchMorphElements(from, to);
    expect(pairs.length).toBe(2);
    expect(pairs[0].fromElement.id).toBe("a");
    expect(pairs[0].toElement.id).toBe("d");
    expect(pairs[1].fromElement.id).toBe("b");
    expect(pairs[1].toElement.id).toBe("c");
  });

  it("should not double-match elements", () => {
    const from = makeSlide([
      makeElement({ id: "a", type: "shape", x: 10, y: 10 }),
      makeElement({ id: "b", type: "shape", x: 15, y: 15 }),
    ]);
    const to = makeSlide([
      makeElement({ id: "c", type: "shape", x: 12, y: 12 }),
    ]);
    const pairs = matchMorphElements(from, to);
    // Only one element on the to-side, so only one pair
    expect(pairs.length).toBe(1);
  });
});

// ==========================================================================
// matchMorphElementsFull
// ==========================================================================

describe("matchMorphElementsFull", () => {
  it("returns unmatched from elements", () => {
    const from = makeSlide([
      makeElement({ id: "a", type: "shape", x: 0, y: 0 }),
      makeElement({ id: "b", type: "shape", x: 500, y: 500 }),
    ]);
    const to = makeSlide([
      makeElement({ id: "a", type: "shape", x: 10, y: 10 }),
    ]);
    const result = matchMorphElementsFull(from, to);
    expect(result.pairs.length).toBe(1);
    expect(result.unmatchedFrom.length).toBe(1);
    expect(result.unmatchedFrom[0].id).toBe("b");
    expect(result.unmatchedTo.length).toBe(0);
  });

  it("returns unmatched to elements", () => {
    const from = makeSlide([
      makeElement({ id: "a", type: "shape", x: 0, y: 0 }),
    ]);
    const to = makeSlide([
      makeElement({ id: "a", type: "shape", x: 10, y: 10 }),
      makeElement({ id: "c", type: "image", x: 200, y: 200 }),
    ]);
    const result = matchMorphElementsFull(from, to);
    expect(result.pairs.length).toBe(1);
    expect(result.unmatchedFrom.length).toBe(0);
    expect(result.unmatchedTo.length).toBe(1);
    expect(result.unmatchedTo[0].id).toBe("c");
  });

  it("returns all elements as unmatched when no matches found", () => {
    const from = makeSlide([
      makeElement({ id: "a", type: "shape", x: 0, y: 0 }),
    ]);
    const to = makeSlide([
      makeElement({ id: "b", type: "image", x: 500, y: 500 }),
    ]);
    const result = matchMorphElementsFull(from, to);
    expect(result.pairs.length).toBe(0);
    expect(result.unmatchedFrom.length).toBe(1);
    expect(result.unmatchedTo.length).toBe(1);
  });
});

// ==========================================================================
// Text tokenization
// ==========================================================================

describe("tokenizeText", () => {
  it("tokenizes by character", () => {
    const el = makeElement({
      id: "a",
      type: "text",
      text: "Hello",
      textStyle: { fontSize: 24 },
    } as Partial<PptxElement> & { id: string; type: PptxElement["type"] });
    const tokens = tokenizeText(el, "character");
    expect(tokens.length).toBe(5);
    expect(tokens[0].text).toBe("H");
    expect(tokens[4].text).toBe("o");
    expect(tokens[0].fontSize).toBe(24);
  });

  it("tokenizes by word", () => {
    const el = makeElement({
      id: "a",
      type: "text",
      text: "Hello World",
      textStyle: { fontSize: 18 },
    } as Partial<PptxElement> & { id: string; type: PptxElement["type"] });
    const tokens = tokenizeText(el, "word");
    expect(tokens.length).toBe(2);
    expect(tokens[0].text).toBe("Hello");
    expect(tokens[1].text).toBe("World");
  });

  it("returns empty for non-text elements", () => {
    const el = makeElement({ id: "a", type: "image" });
    expect(tokenizeText(el, "word")).toEqual([]);
  });

  it("returns empty for element with no text", () => {
    const el = makeElement({ id: "a", type: "text" });
    expect(tokenizeText(el, "character")).toEqual([]);
  });

  it("assigns normalised x positions for characters", () => {
    const el = makeElement({
      id: "a",
      type: "text",
      text: "ABC",
    } as Partial<PptxElement> & { id: string; type: PptxElement["type"] });
    const tokens = tokenizeText(el, "character");
    expect(tokens[0].x).toBe(0);
    expect(tokens[1].x).toBe(0.5);
    expect(tokens[2].x).toBe(1);
  });

  it("handles single character", () => {
    const el = makeElement({
      id: "a",
      type: "text",
      text: "X",
    } as Partial<PptxElement> & { id: string; type: PptxElement["type"] });
    const tokens = tokenizeText(el, "character");
    expect(tokens.length).toBe(1);
    expect(tokens[0].x).toBe(0.5);
  });

  it("uses default font size when not specified", () => {
    const el = makeElement({
      id: "a",
      type: "text",
      text: "Hi",
    } as Partial<PptxElement> & { id: string; type: PptxElement["type"] });
    const tokens = tokenizeText(el, "word");
    expect(tokens[0].fontSize).toBe(14);
  });

  it("detects bold weight", () => {
    const el = makeElement({
      id: "a",
      type: "text",
      text: "Bold",
      textStyle: { bold: true },
    } as Partial<PptxElement> & { id: string; type: PptxElement["type"] });
    const tokens = tokenizeText(el, "word");
    expect(tokens[0].fontWeight).toBe("bold");
  });

  it("skips newlines in character mode", () => {
    const el = makeElement({
      id: "a",
      type: "text",
      text: "A\nB",
    } as Partial<PptxElement> & { id: string; type: PptxElement["type"] });
    const tokens = tokenizeText(el, "character");
    expect(tokens.length).toBe(2);
    expect(tokens[0].text).toBe("A");
    expect(tokens[1].text).toBe("B");
  });
});

// ==========================================================================
// matchTextTokens
// ==========================================================================

describe("matchTextTokens", () => {
  it("matches identical tokens by text", () => {
    const from = [
      { text: "Hello", x: 0, y: 0.5, fontSize: 14, fontWeight: "normal", color: "#000" },
      { text: "World", x: 1, y: 0.5, fontSize: 14, fontWeight: "normal", color: "#000" },
    ];
    const to = [
      { text: "Hello", x: 0.2, y: 0.5, fontSize: 18, fontWeight: "bold", color: "#F00" },
      { text: "World", x: 0.8, y: 0.5, fontSize: 18, fontWeight: "bold", color: "#F00" },
    ];
    const pairs = matchTextTokens(from, to);
    // Both matched
    const matched = pairs.filter((p) => p.from && p.to);
    expect(matched.length).toBe(2);
    expect(matched[0].from!.text).toBe("Hello");
    expect(matched[0].to!.text).toBe("Hello");
  });

  it("marks disappearing tokens with null to", () => {
    const from = [
      { text: "Gone", x: 0, y: 0.5, fontSize: 14, fontWeight: "normal", color: "#000" },
    ];
    const to: typeof from = [];
    const pairs = matchTextTokens(from, to);
    expect(pairs.length).toBe(1);
    expect(pairs[0].from).not.toBeNull();
    expect(pairs[0].to).toBeNull();
  });

  it("marks appearing tokens with null from", () => {
    const from: { text: string; x: number; y: number; fontSize: number; fontWeight: string; color: string }[] = [];
    const to = [
      { text: "New", x: 0, y: 0.5, fontSize: 14, fontWeight: "normal", color: "#000" },
    ];
    const pairs = matchTextTokens(from, to);
    expect(pairs.length).toBe(1);
    expect(pairs[0].from).toBeNull();
    expect(pairs[0].to).not.toBeNull();
  });

  it("handles partial overlap", () => {
    const from = [
      { text: "A", x: 0, y: 0.5, fontSize: 14, fontWeight: "normal", color: "#000" },
      { text: "B", x: 0.5, y: 0.5, fontSize: 14, fontWeight: "normal", color: "#000" },
      { text: "C", x: 1, y: 0.5, fontSize: 14, fontWeight: "normal", color: "#000" },
    ];
    const to = [
      { text: "B", x: 0.3, y: 0.5, fontSize: 14, fontWeight: "normal", color: "#000" },
      { text: "D", x: 0.7, y: 0.5, fontSize: 14, fontWeight: "normal", color: "#000" },
    ];
    const pairs = matchTextTokens(from, to);
    const matched = pairs.filter((p) => p.from && p.to);
    const disappeared = pairs.filter((p) => p.from && !p.to);
    // B matches by text; D gets proximity-matched with A or C.
    // At least 1 token is matched by text, and at least 1 from-token disappears.
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(disappeared.length).toBeGreaterThanOrEqual(1);
    // Total pairs = from count + appeared tokens
    expect(pairs.length).toBeGreaterThanOrEqual(from.length);
  });
});

// ==========================================================================
// buildColorInterpolationProps
// ==========================================================================

describe("buildColorInterpolationProps", () => {
  it("returns null when no fills present", () => {
    const a = makeElement({ id: "a", type: "text" });
    const b = makeElement({ id: "b", type: "text" });
    expect(buildColorInterpolationProps(a, b)).toBeNull();
  });

  it("returns null when fills are identical", () => {
    const a = makeElement({
      id: "a",
      type: "shape",
      shapeStyle: { fillColor: "#FF0000" },
    } as Partial<PptxElement> & { id: string; type: PptxElement["type"] });
    const b = makeElement({
      id: "b",
      type: "shape",
      shapeStyle: { fillColor: "#FF0000" },
    } as Partial<PptxElement> & { id: string; type: PptxElement["type"] });
    expect(buildColorInterpolationProps(a, b)).toBeNull();
  });

  it("returns color strings when fills differ", () => {
    const a = makeElement({
      id: "a",
      type: "shape",
      shapeStyle: { fillColor: "#FF0000" },
    } as Partial<PptxElement> & { id: string; type: PptxElement["type"] });
    const b = makeElement({
      id: "b",
      type: "shape",
      shapeStyle: { fillColor: "#0000FF" },
    } as Partial<PptxElement> & { id: string; type: PptxElement["type"] });
    const result = buildColorInterpolationProps(a, b);
    expect(result).not.toBeNull();
    expect(result!.fromBg).toContain("rgba");
    expect(result!.toBg).toContain("rgba");
  });
});

// ==========================================================================
// buildStrokeInterpolationProps
// ==========================================================================

describe("buildStrokeInterpolationProps", () => {
  it("returns null when no strokes present", () => {
    const a = makeElement({ id: "a", type: "text" });
    const b = makeElement({ id: "b", type: "text" });
    expect(buildStrokeInterpolationProps(a, b)).toBeNull();
  });

  it("returns null when strokes are identical", () => {
    const a = makeElement({
      id: "a",
      type: "shape",
      shapeStyle: { strokeColor: "#000", strokeWidth: 2 },
    } as Partial<PptxElement> & { id: string; type: PptxElement["type"] });
    const b = makeElement({
      id: "b",
      type: "shape",
      shapeStyle: { strokeColor: "#000", strokeWidth: 2 },
    } as Partial<PptxElement> & { id: string; type: PptxElement["type"] });
    expect(buildStrokeInterpolationProps(a, b)).toBeNull();
  });

  it("returns stroke data when strokes differ", () => {
    const a = makeElement({
      id: "a",
      type: "shape",
      shapeStyle: { strokeColor: "#FF0000", strokeWidth: 1 },
    } as Partial<PptxElement> & { id: string; type: PptxElement["type"] });
    const b = makeElement({
      id: "b",
      type: "shape",
      shapeStyle: { strokeColor: "#0000FF", strokeWidth: 3 },
    } as Partial<PptxElement> & { id: string; type: PptxElement["type"] });
    const result = buildStrokeInterpolationProps(a, b);
    expect(result).not.toBeNull();
    expect(result!.fromWidth).toBe(1);
    expect(result!.toWidth).toBe(3);
  });
});

// ==========================================================================
// generateMorphAnimations (enhanced)
// ==========================================================================

describe("generateMorphAnimations", () => {
  it("should generate animation for each pair", () => {
    const pairs: MorphPair[] = [
      {
        fromElement: makeElement({
          id: "a",
          type: "shape",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
        }),
        toElement: makeElement({
          id: "b",
          type: "shape",
          x: 50,
          y: 50,
          width: 200,
          height: 100,
        }),
      },
    ];
    const anims = generateMorphAnimations(pairs, 1000);
    expect(anims.length).toBe(1);
    expect(anims[0].elementId).toBe("b");
  });

  it("should include translate transform from position delta", () => {
    const pairs: MorphPair[] = [
      {
        fromElement: makeElement({
          id: "a",
          type: "shape",
          x: 10,
          y: 20,
          width: 100,
          height: 50,
        }),
        toElement: makeElement({
          id: "b",
          type: "shape",
          x: 50,
          y: 70,
          width: 100,
          height: 50,
        }),
      },
    ];
    const anims = generateMorphAnimations(pairs, 500);
    expect(anims[0].keyframes).toContain("translate(-40px, -50px)");
  });

  it("should include scale transform from size delta", () => {
    const pairs: MorphPair[] = [
      {
        fromElement: makeElement({
          id: "a",
          type: "shape",
          x: 0,
          y: 0,
          width: 200,
          height: 100,
        }),
        toElement: makeElement({
          id: "b",
          type: "shape",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
        }),
      },
    ];
    const anims = generateMorphAnimations(pairs, 500);
    expect(anims[0].keyframes).toContain("scale(2, 2)");
  });

  it("should include rotation transform from rotation delta", () => {
    const pairs: MorphPair[] = [
      {
        fromElement: makeElement({
          id: "a",
          type: "shape",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          rotation: 45,
        }),
        toElement: makeElement({
          id: "b",
          type: "shape",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          rotation: 0,
        }),
      },
    ];
    const anims = generateMorphAnimations(pairs, 500);
    expect(anims[0].keyframes).toContain("rotate(45deg)");
  });

  it("should include duration in animation string", () => {
    const pairs: MorphPair[] = [
      {
        fromElement: makeElement({
          id: "a",
          type: "shape",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
        }),
        toElement: makeElement({
          id: "b",
          type: "shape",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
        }),
      },
    ];
    const anims = generateMorphAnimations(pairs, 750);
    expect(anims[0].animation).toContain("750ms");
  });

  it("should use morph-specific cubic-bezier easing", () => {
    const pairs: MorphPair[] = [
      {
        fromElement: makeElement({
          id: "a",
          type: "shape",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
        }),
        toElement: makeElement({
          id: "b",
          type: "shape",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
        }),
      },
    ];
    const anims = generateMorphAnimations(pairs, 500);
    expect(anims[0].animation).toContain(MORPH_EASING);
  });

  it("should return empty array for empty pairs", () => {
    expect(generateMorphAnimations([], 500)).toEqual([]);
  });

  it("should generate unique keyframe names for each pair", () => {
    const pairs: MorphPair[] = [
      {
        fromElement: makeElement({
          id: "a",
          type: "shape",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
        }),
        toElement: makeElement({
          id: "b",
          type: "shape",
          x: 50,
          y: 50,
          width: 100,
          height: 50,
        }),
      },
      {
        fromElement: makeElement({
          id: "c",
          type: "shape",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
        }),
        toElement: makeElement({
          id: "d",
          type: "shape",
          x: 50,
          y: 50,
          width: 100,
          height: 50,
        }),
      },
    ];
    const anims = generateMorphAnimations(pairs, 500);
    const name0 = anims[0].animation.split(" ")[0];
    const name1 = anims[1].animation.split(" ")[0];
    expect(name0).not.toBe(name1);
  });

  it("should handle opacity in keyframes", () => {
    const pairs: MorphPair[] = [
      {
        fromElement: makeElement({
          id: "a",
          type: "shape",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          opacity: 0.5,
        }),
        toElement: makeElement({
          id: "b",
          type: "shape",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          opacity: 1,
        }),
      },
    ];
    const anims = generateMorphAnimations(pairs, 500);
    expect(anims[0].keyframes).toContain("opacity: 0.5");
    expect(anims[0].keyframes).toContain("opacity: 1");
  });

  it("should include background-color for fill color changes", () => {
    const pairs: MorphPair[] = [
      {
        fromElement: makeElement({
          id: "a",
          type: "shape",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          shapeStyle: { fillColor: "#FF0000" },
        } as Partial<PptxElement> & { id: string; type: PptxElement["type"] }),
        toElement: makeElement({
          id: "b",
          type: "shape",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          shapeStyle: { fillColor: "#0000FF" },
        } as Partial<PptxElement> & { id: string; type: PptxElement["type"] }),
      },
    ];
    const anims = generateMorphAnimations(pairs, 500);
    expect(anims[0].keyframes).toContain("background-color:");
  });

  it("should include outline for stroke changes", () => {
    const pairs: MorphPair[] = [
      {
        fromElement: makeElement({
          id: "a",
          type: "shape",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          shapeStyle: { strokeColor: "#FF0000", strokeWidth: 1 },
        } as Partial<PptxElement> & { id: string; type: PptxElement["type"] }),
        toElement: makeElement({
          id: "b",
          type: "shape",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          shapeStyle: { strokeColor: "#0000FF", strokeWidth: 3 },
        } as Partial<PptxElement> & { id: string; type: PptxElement["type"] }),
      },
    ];
    const anims = generateMorphAnimations(pairs, 500);
    expect(anims[0].keyframes).toContain("outline:");
  });
});

// ==========================================================================
// Unmatched element animations
// ==========================================================================

describe("generateUnmatchedFadeOutAnimations", () => {
  it("generates fade-out animations for each element", () => {
    const elements = [
      makeElement({ id: "a", type: "shape" }),
      makeElement({ id: "b", type: "text" }),
    ];
    const anims = generateUnmatchedFadeOutAnimations(elements, 500, 0);
    expect(anims.length).toBe(2);
    expect(anims[0].keyframes).toContain("opacity: 0");
    expect(anims[0].animation).toContain(MORPH_EASING);
  });

  it("preserves element opacity in from state", () => {
    const elements = [makeElement({ id: "a", type: "shape", opacity: 0.8 })];
    const anims = generateUnmatchedFadeOutAnimations(elements, 500, 0);
    expect(anims[0].keyframes).toContain("opacity: 0.8");
  });

  it("returns empty array for empty input", () => {
    expect(generateUnmatchedFadeOutAnimations([], 500, 0)).toEqual([]);
  });
});

describe("generateUnmatchedFadeInAnimations", () => {
  it("generates fade-in animations for each element", () => {
    const elements = [makeElement({ id: "a", type: "shape" })];
    const anims = generateUnmatchedFadeInAnimations(elements, 500, 0);
    expect(anims.length).toBe(1);
    expect(anims[0].keyframes).toContain("opacity: 0");
    expect(anims[0].keyframes).toContain("opacity: 1");
  });

  it("uses target element opacity in to state", () => {
    const elements = [makeElement({ id: "a", type: "shape", opacity: 0.6 })];
    const anims = generateUnmatchedFadeInAnimations(elements, 500, 0);
    expect(anims[0].keyframes).toContain("opacity: 0.6");
  });
});

// ==========================================================================
// Text morph animation generation
// ==========================================================================

describe("generateTextMorphAnimations", () => {
  it("generates per-token animations for word mode", () => {
    const pair: MorphPair = {
      fromElement: makeElement({
        id: "a",
        type: "text",
        text: "Hello World",
        textStyle: { fontSize: 14 },
      } as Partial<PptxElement> & { id: string; type: PptxElement["type"] }),
      toElement: makeElement({
        id: "b",
        type: "text",
        text: "Hello World",
        textStyle: { fontSize: 24 },
      } as Partial<PptxElement> & { id: string; type: PptxElement["type"] }),
    };
    const anims = generateTextMorphAnimations(pair, 500, "word", 0);
    expect(anims.length).toBeGreaterThanOrEqual(2);
  });

  it("generates per-character animations for character mode", () => {
    const pair: MorphPair = {
      fromElement: makeElement({
        id: "a",
        type: "text",
        text: "AB",
        textStyle: { fontSize: 14 },
      } as Partial<PptxElement> & { id: string; type: PptxElement["type"] }),
      toElement: makeElement({
        id: "b",
        type: "text",
        text: "AB",
        textStyle: { fontSize: 24 },
      } as Partial<PptxElement> & { id: string; type: PptxElement["type"] }),
    };
    const anims = generateTextMorphAnimations(pair, 500, "character", 0);
    expect(anims.length).toBe(2);
  });

  it("returns empty for non-text elements", () => {
    const pair: MorphPair = {
      fromElement: makeElement({ id: "a", type: "image" }),
      toElement: makeElement({ id: "b", type: "image" }),
    };
    const anims = generateTextMorphAnimations(pair, 500, "word", 0);
    expect(anims.length).toBe(0);
  });

  it("handles appearing text with fade-in animations", () => {
    const pair: MorphPair = {
      fromElement: makeElement({
        id: "a",
        type: "text",
        text: "A",
        textStyle: { fontSize: 14 },
      } as Partial<PptxElement> & { id: string; type: PptxElement["type"] }),
      toElement: makeElement({
        id: "b",
        type: "text",
        text: "A B",
        textStyle: { fontSize: 14 },
      } as Partial<PptxElement> & { id: string; type: PptxElement["type"] }),
    };
    const anims = generateTextMorphAnimations(pair, 500, "word", 0);
    // "A" matches, "B" is new so should have fade-in
    const fadeInAnims = anims.filter((a) => a.keyframes.includes("opacity: 0") && a.keyframes.includes("opacity: 1"));
    expect(fadeInAnims.length).toBeGreaterThanOrEqual(1);
  });

  it("handles disappearing text with fade-out animations", () => {
    const pair: MorphPair = {
      fromElement: makeElement({
        id: "a",
        type: "text",
        text: "A B",
        textStyle: { fontSize: 14 },
      } as Partial<PptxElement> & { id: string; type: PptxElement["type"] }),
      toElement: makeElement({
        id: "b",
        type: "text",
        text: "A",
        textStyle: { fontSize: 14 },
      } as Partial<PptxElement> & { id: string; type: PptxElement["type"] }),
    };
    const anims = generateTextMorphAnimations(pair, 500, "word", 0);
    const fadeOutAnims = anims.filter(
      (a) =>
        a.keyframes.includes("from { opacity: 1; }") &&
        a.keyframes.includes("to { opacity: 0; }"),
    );
    expect(fadeOutAnims.length).toBeGreaterThanOrEqual(1);
  });
});

// ==========================================================================
// generateFullMorphTransition
// ==========================================================================

describe("generateFullMorphTransition", () => {
  it("generates complete animation set for object mode", () => {
    const from = makeSlide([
      makeElement({ id: "a", type: "shape", x: 0, y: 0 }),
      makeElement({ id: "only-from", type: "text", x: 200, y: 200 }),
    ]);
    const to = makeSlide([
      makeElement({ id: "a", type: "shape", x: 100, y: 100 }),
      makeElement({ id: "only-to", type: "image", x: 300, y: 300 }),
    ]);
    const anims = generateFullMorphTransition(from, to, 800, "object");
    // Should have: 1 pair animation + 1 fade-out + 1 fade-in
    expect(anims.length).toBe(3);
  });

  it("includes text morph animations in word mode", () => {
    const from = makeSlide([
      makeElement({
        id: "t1",
        type: "text",
        text: "Hello World",
        textStyle: { fontSize: 14 },
        x: 0,
        y: 0,
      } as Partial<PptxElement> & { id: string; type: PptxElement["type"] }),
    ]);
    const to = makeSlide([
      makeElement({
        id: "t1",
        type: "text",
        text: "Hello World",
        textStyle: { fontSize: 24 },
        x: 50,
        y: 50,
      } as Partial<PptxElement> & { id: string; type: PptxElement["type"] }),
    ]);
    const anims = generateFullMorphTransition(from, to, 800, "word");
    // Should have: 1 pair animation + 2 text token animations (Hello, World)
    expect(anims.length).toBeGreaterThanOrEqual(3);
  });

  it("includes text morph animations in character mode", () => {
    const from = makeSlide([
      makeElement({
        id: "t1",
        type: "text",
        text: "AB",
        textStyle: { fontSize: 14 },
        x: 0,
        y: 0,
      } as Partial<PptxElement> & { id: string; type: PptxElement["type"] }),
    ]);
    const to = makeSlide([
      makeElement({
        id: "t1",
        type: "text",
        text: "AB",
        textStyle: { fontSize: 24 },
        x: 50,
        y: 50,
      } as Partial<PptxElement> & { id: string; type: PptxElement["type"] }),
    ]);
    const anims = generateFullMorphTransition(from, to, 800, "character");
    // Should have: 1 pair animation + 2 character animations
    expect(anims.length).toBeGreaterThanOrEqual(3);
  });

  it("returns only fade animations when no elements match", () => {
    const from = makeSlide([
      makeElement({ id: "a", type: "shape", x: 0, y: 0 }),
    ]);
    const to = makeSlide([
      makeElement({ id: "b", type: "image", x: 500, y: 500 }),
    ]);
    const anims = generateFullMorphTransition(from, to, 500);
    // 0 pair animations + 1 fade-out + 1 fade-in
    expect(anims.length).toBe(2);
    const fadeOutAnims = anims.filter((a) => a.keyframes.includes("fadeout"));
    const fadeInAnims = anims.filter((a) => a.keyframes.includes("fadein"));
    expect(fadeOutAnims.length).toBe(1);
    expect(fadeInAnims.length).toBe(1);
  });

  it("returns empty for empty slides", () => {
    const from = makeSlide([]);
    const to = makeSlide([]);
    const anims = generateFullMorphTransition(from, to, 500);
    expect(anims.length).toBe(0);
  });

  it("defaults to object mode", () => {
    const from = makeSlide([
      makeElement({ id: "a", type: "shape", x: 0, y: 0 }),
    ]);
    const to = makeSlide([
      makeElement({ id: "a", type: "shape", x: 100, y: 100 }),
    ]);
    const anims = generateFullMorphTransition(from, to, 500);
    // Object mode: 1 pair animation, no text animations
    expect(anims.length).toBe(1);
  });
});

// ==========================================================================
// MORPH_EASING constant
// ==========================================================================

describe("MORPH_EASING", () => {
  it("is a cubic-bezier string", () => {
    expect(MORPH_EASING).toMatch(/^cubic-bezier\(/);
  });
});
