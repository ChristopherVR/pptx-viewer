import { describe, it, expect } from "vitest";
import { shapeParams } from "./ElementRenderer";
import type { PptxElement } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeElement(overrides: Partial<PptxElement> = {}): PptxElement {
  return {
    id: "el-1",
    type: "shape",
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    ...overrides,
  } as PptxElement;
}

// ---------------------------------------------------------------------------
// shapeParams
// ---------------------------------------------------------------------------

describe("shapeParams", () => {
  it("returns default fill and stroke colours when element has no shapeStyle", () => {
    const el = makeElement({ type: "text" } as Partial<PptxElement>);
    // text elements have shapeStyle via hasShapeProperties
    const result = shapeParams(el);
    // Should have fallback colours
    expect(result.fc).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(result.sc).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("returns hasFill=false when fillColor is undefined", () => {
    const el = makeElement({
      type: "shape",
      shapeStyle: { strokeWidth: 1, strokeColor: "#000000" },
    } as Partial<PptxElement>);
    const result = shapeParams(el);
    expect(result.hf).toBe(false);
  });

  it("returns hasFill=false when fillColor is transparent", () => {
    const el = makeElement({
      type: "shape",
      shapeStyle: { fillColor: "transparent" },
    } as Partial<PptxElement>);
    const result = shapeParams(el);
    expect(result.hf).toBe(false);
  });

  it("returns hasFill=true when fillColor is a solid colour", () => {
    const el = makeElement({
      type: "shape",
      shapeStyle: { fillColor: "#ff0000" },
    } as Partial<PptxElement>);
    const result = shapeParams(el);
    expect(result.hf).toBe(true);
  });

  it("returns strokeWidth clamped to 0 when negative or undefined", () => {
    const el = makeElement({
      type: "shape",
      shapeStyle: { strokeWidth: -5 },
    } as Partial<PptxElement>);
    const result = shapeParams(el);
    expect(result.sw).toBe(0);
  });

  it("returns the correct strokeWidth when positive", () => {
    const el = makeElement({
      type: "shape",
      shapeStyle: { strokeWidth: 3, strokeColor: "#aabbcc" },
    } as Partial<PptxElement>);
    const result = shapeParams(el);
    expect(result.sw).toBe(3);
  });

  it("normalizes fill colour with hash prefix", () => {
    const el = makeElement({
      type: "shape",
      shapeStyle: { fillColor: "#abcdef" },
    } as Partial<PptxElement>);
    const result = shapeParams(el);
    expect(result.fc).toBe("#abcdef");
  });

  it("returns fallback colours for non-shape element types without shapeStyle", () => {
    // image elements do not have shapeStyle via hasShapeProperties
    const el = makeElement({ type: "image" } as Partial<PptxElement>);
    const result = shapeParams(el);
    // Should use defaults since hasShapeProperties returns false for image
    expect(result.sw).toBe(0);
    expect(result.hf).toBe(false);
  });
});
