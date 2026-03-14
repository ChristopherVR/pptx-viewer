import { describe, it, expect } from "vitest";
import {
  ensureArrayValue,
  snapToGridValue,
  shouldRenderFallbackLabel,
} from "./geometry-image";
import type { PptxElement } from "pptx-viewer-core";
import { GRID_SIZE } from "../constants";

describe("ensureArrayValue", () => {
  it("returns empty array for undefined", () => {
    expect(ensureArrayValue(undefined)).toEqual([]);
  });

  it("returns empty array for null", () => {
    expect(ensureArrayValue(null)).toEqual([]);
  });

  it("wraps a single value in an array", () => {
    expect(ensureArrayValue("hello")).toEqual(["hello"]);
  });

  it("wraps a single number in an array", () => {
    expect(ensureArrayValue(42)).toEqual([42]);
  });

  it("passes through an existing array unchanged", () => {
    const arr = [1, 2, 3];
    expect(ensureArrayValue(arr)).toBe(arr);
  });

  it("passes through an empty array", () => {
    const arr: string[] = [];
    expect(ensureArrayValue(arr)).toBe(arr);
  });

  it("wraps a single object in an array", () => {
    const obj = { x: 1 };
    expect(ensureArrayValue(obj)).toEqual([obj]);
  });

  it("returns empty array for false-y value 0 (number wraps)", () => {
    // 0 is falsy, so ensureArrayValue(0) should return []
    expect(ensureArrayValue(0 as unknown as undefined)).toEqual([]);
  });
});

describe("snapToGridValue", () => {
  it("returns original value when grid snap is disabled", () => {
    expect(snapToGridValue(13, false)).toBe(13);
  });

  it("snaps to nearest grid value when enabled", () => {
    // GRID_SIZE is 8
    expect(snapToGridValue(10, true)).toBe(GRID_SIZE); // rounds to 8
  });

  it("snaps exact grid multiples to themselves", () => {
    expect(snapToGridValue(16, true)).toBe(16);
  });

  it("rounds to nearest grid line", () => {
    // 12 is halfway between 8 and 16; Math.round(12/8)*8 = Math.round(1.5)*8 = 2*8 = 16
    expect(snapToGridValue(12, true)).toBe(16);
  });

  it("snaps 0 to 0", () => {
    expect(snapToGridValue(0, true)).toBe(0);
  });

  it("snaps negative values to nearest grid line", () => {
    // -10: Math.round(-10/8)*8 = Math.round(-1.25)*8 = -1*8 = -8
    expect(snapToGridValue(-10, true)).toBe(-8);
  });

  it("handles large values", () => {
    expect(snapToGridValue(1000, true)).toBe(1000); // 1000/8 = 125 (exact)
  });

  it("snaps values just above grid point down", () => {
    // 9: Math.round(9/8)*8 = Math.round(1.125)*8 = 1*8 = 8
    expect(snapToGridValue(9, true)).toBe(8);
  });
});

function makeEl(type: string, extras: Record<string, unknown> = {}): PptxElement {
  return {
    id: "test-1",
    type,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    ...extras,
  } as unknown as PptxElement;
}

describe("shouldRenderFallbackLabel", () => {
  it("returns false when element is a text element", () => {
    expect(shouldRenderFallbackLabel(makeEl("text"), true)).toBe(false);
  });

  it("returns false for shape elements", () => {
    expect(shouldRenderFallbackLabel(makeEl("shape"), false)).toBe(false);
  });

  it("returns false for connector elements", () => {
    expect(shouldRenderFallbackLabel(makeEl("connector"), false)).toBe(false);
  });

  it("returns false for picture elements", () => {
    expect(shouldRenderFallbackLabel(makeEl("picture"), false)).toBe(false);
  });

  it("returns false for image elements", () => {
    expect(shouldRenderFallbackLabel(makeEl("image"), false)).toBe(false);
  });

  it("returns false for table elements", () => {
    expect(shouldRenderFallbackLabel(makeEl("table"), false)).toBe(false);
  });

  it("returns false for media elements", () => {
    expect(shouldRenderFallbackLabel(makeEl("media"), false)).toBe(false);
  });

  it("returns false for contentPart elements", () => {
    expect(shouldRenderFallbackLabel(makeEl("contentPart"), false)).toBe(false);
  });

  it("returns false for model3d elements", () => {
    expect(shouldRenderFallbackLabel(makeEl("model3d"), false)).toBe(false);
  });

  it("returns true for chart elements", () => {
    expect(shouldRenderFallbackLabel(makeEl("chart"), false)).toBe(true);
  });

  it("returns true for smartArt elements", () => {
    expect(shouldRenderFallbackLabel(makeEl("smartArt"), false)).toBe(true);
  });

  it("returns true for unknown elements", () => {
    expect(shouldRenderFallbackLabel(makeEl("unknown"), false)).toBe(true);
  });

  it("returns true for OLE element without preview image", () => {
    expect(shouldRenderFallbackLabel(makeEl("ole"), false)).toBe(true);
  });

  it("returns false for OLE element with previewImageData", () => {
    const el = makeEl("ole", { previewImageData: "data:image/png;base64,..." });
    expect(shouldRenderFallbackLabel(el, false)).toBe(false);
  });

  it("returns false for OLE element with previewImage", () => {
    const el = makeEl("ole", { previewImage: "data:image/png;base64,..." });
    expect(shouldRenderFallbackLabel(el, false)).toBe(false);
  });
});
