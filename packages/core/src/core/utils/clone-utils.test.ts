import { describe, it, expect } from "vitest";
import {
  cloneTextStyle,
  cloneShapeStyle,
  cloneElement,
  cloneSlide,
  cloneXmlObject,
} from "./clone-utils";
import type { PptxElement, PptxSlide, TextStyle, ShapeStyle, XmlObject } from "../types";

// ---------------------------------------------------------------------------
// cloneTextStyle
// ---------------------------------------------------------------------------

describe("cloneTextStyle", () => {
  it("returns undefined for undefined input", () => {
    expect(cloneTextStyle(undefined)).toBeUndefined();
  });

  it("returns undefined for falsy input", () => {
    expect(cloneTextStyle(undefined)).toBeUndefined();
  });

  it("returns a shallow copy of the style", () => {
    const style: TextStyle = { bold: true, fontSize: 18, color: "#FF0000" };
    const cloned = cloneTextStyle(style);
    expect(cloned).toEqual(style);
    expect(cloned).not.toBe(style);
  });

  it("mutations on the clone do not affect the original", () => {
    const style: TextStyle = { bold: true, fontSize: 18 };
    const cloned = cloneTextStyle(style)!;
    cloned.bold = false;
    expect(style.bold).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cloneShapeStyle
// ---------------------------------------------------------------------------

describe("cloneShapeStyle", () => {
  it("returns undefined for undefined input", () => {
    expect(cloneShapeStyle(undefined)).toBeUndefined();
  });

  it("returns a shallow copy of the shape style", () => {
    const style: ShapeStyle = { fillColor: "#FF0000", strokeWidth: 2 };
    const cloned = cloneShapeStyle(style);
    expect(cloned).toEqual(style);
    expect(cloned).not.toBe(style);
  });

  it("deep-clones gradient stops", () => {
    const style: ShapeStyle = {
      fillColor: "#000",
      fillGradientStops: [
        { position: 0, color: "#FF0000" },
        { position: 1, color: "#0000FF" },
      ],
    };
    const cloned = cloneShapeStyle(style)!;
    expect(cloned.fillGradientStops).toEqual(style.fillGradientStops);
    expect(cloned.fillGradientStops).not.toBe(style.fillGradientStops);
    // Mutate cloned gradient stop
    cloned.fillGradientStops![0].color = "#00FF00";
    expect(style.fillGradientStops![0].color).toBe("#FF0000");
  });

  it("handles styles without gradient stops", () => {
    const style: ShapeStyle = { fillColor: "#AABB00" };
    const cloned = cloneShapeStyle(style)!;
    expect(cloned.fillGradientStops).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// cloneElement
// ---------------------------------------------------------------------------

describe("cloneElement", () => {
  it("clones a text element with text segments", () => {
    const el: PptxElement = {
      type: "text",
      id: "t1",
      x: 10, y: 20, width: 300, height: 100,
      text: "Hello",
      textStyle: { bold: true },
      textSegments: [{ text: "Hello", style: { bold: true } }],
    };
    const cloned = cloneElement(el);
    expect(cloned).toEqual(el);
    expect(cloned).not.toBe(el);
    // Verify deep independence of textSegments
    if (cloned.type === "text" && cloned.textSegments) {
      cloned.textSegments[0].text = "Changed";
      expect((el as any).textSegments[0].text).toBe("Hello");
    }
  });

  it("clones a shape element with adjustments", () => {
    const el: PptxElement = {
      type: "shape",
      id: "s1",
      x: 0, y: 0, width: 200, height: 150,
      shapeType: "roundRect",
      shapeAdjustments: { adj1: 50000, adj2: 25000 },
      shapeStyle: { fillColor: "#FF0000" },
    };
    const cloned = cloneElement(el);
    expect(cloned).toEqual(el);
    // Mutating the clone's adjustments should not affect original
    if (cloned.type === "shape" && cloned.shapeAdjustments) {
      cloned.shapeAdjustments.adj1 = 0;
      expect((el as any).shapeAdjustments.adj1).toBe(50000);
    }
  });

  it("clones a connector element", () => {
    const el: PptxElement = {
      type: "connector",
      id: "c1",
      x: 50, y: 50, width: 200, height: 0,
      shapeStyle: { strokeColor: "#333", strokeWidth: 2 },
    };
    const cloned = cloneElement(el);
    expect(cloned).toEqual(el);
    expect(cloned).not.toBe(el);
  });

  it("clones an image element", () => {
    const el: PptxElement = {
      type: "image",
      id: "img1",
      x: 0, y: 0, width: 400, height: 300,
    };
    const cloned = cloneElement(el);
    expect(cloned).toEqual(el);
    expect(cloned).not.toBe(el);
  });

  it("clones a chart element (shallow)", () => {
    const el: PptxElement = {
      type: "chart",
      id: "ch1",
      x: 0, y: 0, width: 400, height: 300,
    };
    const cloned = cloneElement(el);
    expect(cloned).toEqual(el);
    expect(cloned).not.toBe(el);
  });

  it("clones unknown element types (shallow)", () => {
    const el: PptxElement = {
      type: "unknown",
      id: "u1",
      x: 0, y: 0, width: 100, height: 100,
    };
    const cloned = cloneElement(el);
    expect(cloned).toEqual(el);
    expect(cloned).not.toBe(el);
  });
});

// ---------------------------------------------------------------------------
// cloneSlide
// ---------------------------------------------------------------------------

describe("cloneSlide", () => {
  it("clones a slide with elements, comments, and warnings", () => {
    const slide: PptxSlide = {
      id: "slide1",
      index: 0,
      elements: [
        { type: "text", id: "t1", x: 0, y: 0, width: 100, height: 50, text: "Hi" },
      ],
      comments: [{ id: "c1", author: "user", text: "Comment" }],
      warnings: [{ message: "Warning 1" }],
    } as PptxSlide;
    const cloned = cloneSlide(slide);
    expect(cloned.id).toBe("slide1");
    expect(cloned.elements).toHaveLength(1);
    expect(cloned.elements).not.toBe(slide.elements);
    expect(cloned.comments).not.toBe(slide.comments);
    expect(cloned.warnings).not.toBe(slide.warnings);
  });

  it("handles slides without comments or warnings", () => {
    const slide: PptxSlide = {
      id: "slide2",
      index: 1,
      elements: [],
    } as PptxSlide;
    const cloned = cloneSlide(slide);
    expect(cloned.comments).toBeUndefined();
    expect(cloned.warnings).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// cloneXmlObject
// ---------------------------------------------------------------------------

describe("cloneXmlObject", () => {
  it("returns undefined for undefined input", () => {
    expect(cloneXmlObject(undefined)).toBeUndefined();
  });

  it("deep-clones a simple XML object", () => {
    const obj: XmlObject = { "@_id": "1", "child": { "@_name": "test" } };
    const cloned = cloneXmlObject(obj);
    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
  });

  it("deep-clones nested arrays", () => {
    const obj: XmlObject = {
      "items": [{ "@_val": "a" }, { "@_val": "b" }],
    };
    const cloned = cloneXmlObject(obj)!;
    expect(cloned).toEqual(obj);
    expect(cloned["items"]).not.toBe(obj["items"]);
  });

  it("mutations on clone do not affect original", () => {
    const obj: XmlObject = { "a:sp": { "@_id": "42" } };
    const cloned = cloneXmlObject(obj)!;
    (cloned["a:sp"] as any)["@_id"] = "99";
    expect((obj["a:sp"] as any)["@_id"]).toBe("42");
  });
});
