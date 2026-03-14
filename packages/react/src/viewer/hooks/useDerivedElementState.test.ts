import { describe, it, expect } from "vitest";
import {
  buildElementLookup,
  computeEffectiveSelectedIds,
  resolveActiveLayout,
  computeMasterViewElements,
} from "./useDerivedElementState";
import type {
  PptxElement,
  PptxSlideMaster,
  PptxSlideLayout,
} from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeElement(id: string): PptxElement {
  return { id, type: "shape", x: 0, y: 0, width: 100, height: 50 } as PptxElement;
}

// ---------------------------------------------------------------------------
// buildElementLookup
// ---------------------------------------------------------------------------

describe("buildElementLookup", () => {
  it("returns empty map for empty inputs", () => {
    const result = buildElementLookup([], []);
    expect(result.size).toBe(0);
  });

  it("includes template elements", () => {
    const tpl = [makeElement("t1"), makeElement("t2")];
    const result = buildElementLookup(tpl, []);
    expect(result.size).toBe(2);
    expect(result.get("t1")).toBe(tpl[0]);
    expect(result.get("t2")).toBe(tpl[1]);
  });

  it("includes slide elements", () => {
    const slide = [makeElement("s1")];
    const result = buildElementLookup([], slide);
    expect(result.size).toBe(1);
    expect(result.get("s1")).toBe(slide[0]);
  });

  it("slide elements override template elements with same id", () => {
    const tplEl = makeElement("dup");
    const slideEl = makeElement("dup");
    const result = buildElementLookup([tplEl], [slideEl]);
    expect(result.size).toBe(1);
    expect(result.get("dup")).toBe(slideEl);
  });

  it("merges both template and slide elements", () => {
    const tpl = [makeElement("t1")];
    const slide = [makeElement("s1"), makeElement("s2")];
    const result = buildElementLookup(tpl, slide);
    expect(result.size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// computeEffectiveSelectedIds
// ---------------------------------------------------------------------------

describe("computeEffectiveSelectedIds", () => {
  it("returns selectedElementIds when non-empty", () => {
    const result = computeEffectiveSelectedIds("el1", ["el2", "el3"]);
    expect(result).toEqual(["el2", "el3"]);
  });

  it("wraps selectedElementId in array when selectedElementIds is empty", () => {
    const result = computeEffectiveSelectedIds("el1", []);
    expect(result).toEqual(["el1"]);
  });

  it("returns empty array when both are null/empty", () => {
    const result = computeEffectiveSelectedIds(null, []);
    expect(result).toEqual([]);
  });

  it("prefers selectedElementIds even if selectedElementId is null", () => {
    const result = computeEffectiveSelectedIds(null, ["el1"]);
    expect(result).toEqual(["el1"]);
  });
});

// ---------------------------------------------------------------------------
// resolveActiveLayout
// ---------------------------------------------------------------------------

describe("resolveActiveLayout", () => {
  it("returns undefined when activeLayoutIndex is null", () => {
    const master = {
      path: "master.xml",
      layouts: [{ path: "layout1.xml" } as PptxSlideLayout],
    } as PptxSlideMaster;
    expect(resolveActiveLayout(master, null)).toBeUndefined();
  });

  it("returns undefined when activeMaster is undefined", () => {
    expect(resolveActiveLayout(undefined, 0)).toBeUndefined();
  });

  it("returns undefined when activeMaster has no layouts", () => {
    const master = { path: "master.xml" } as PptxSlideMaster;
    expect(resolveActiveLayout(master, 0)).toBeUndefined();
  });

  it("returns the layout at the specified index", () => {
    const layout0 = { path: "layout0.xml" } as PptxSlideLayout;
    const layout1 = { path: "layout1.xml" } as PptxSlideLayout;
    const master = {
      path: "master.xml",
      layouts: [layout0, layout1],
    } as PptxSlideMaster;
    expect(resolveActiveLayout(master, 1)).toBe(layout1);
  });

  it("returns undefined for out-of-bounds index", () => {
    const master = {
      path: "master.xml",
      layouts: [{ path: "layout0.xml" } as PptxSlideLayout],
    } as PptxSlideMaster;
    expect(resolveActiveLayout(master, 5)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// computeMasterViewElements
// ---------------------------------------------------------------------------

describe("computeMasterViewElements", () => {
  it("returns empty array when both are undefined", () => {
    expect(computeMasterViewElements(undefined, undefined)).toEqual([]);
  });

  it("returns layout elements when layout is defined", () => {
    const elements = [makeElement("l1"), makeElement("l2")];
    const layout = { path: "layout.xml", elements } as PptxSlideLayout;
    const master = {
      path: "master.xml",
      elements: [makeElement("m1")],
    } as PptxSlideMaster;
    expect(computeMasterViewElements(master, layout)).toBe(elements);
  });

  it("returns master elements when layout is undefined", () => {
    const elements = [makeElement("m1")];
    const master = {
      path: "master.xml",
      elements,
    } as PptxSlideMaster;
    expect(computeMasterViewElements(master, undefined)).toBe(elements);
  });

  it("returns empty array when layout has no elements", () => {
    const layout = { path: "layout.xml" } as PptxSlideLayout;
    expect(computeMasterViewElements(undefined, layout)).toEqual([]);
  });

  it("returns empty array when master has no elements", () => {
    const master = { path: "master.xml" } as PptxSlideMaster;
    expect(computeMasterViewElements(master, undefined)).toEqual([]);
  });
});
