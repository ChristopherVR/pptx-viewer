import { describe, it, expect } from "vitest";
import {
  cloneTextStyle,
  cloneShapeStyle,
  cloneSlideTransition,
  cloneElementAnimation,
  cloneChartData,
  cloneSmartArtData,
  cloneXmlObject,
} from "./clone";
import type {
  TextStyle,
  ShapeStyle,
  PptxSlideTransition,
  PptxElementAnimation,
  PptxChartData,
  PptxSmartArtData,
  XmlObject,
} from "pptx-viewer-core";

describe("cloneTextStyle", () => {
  it("returns undefined for undefined input", () => {
    expect(cloneTextStyle(undefined)).toBeUndefined();
  });

  it("creates a shallow copy of a text style", () => {
    const style: TextStyle = { bold: true, fontSize: 24 } as TextStyle;
    const cloned = cloneTextStyle(style);
    expect(cloned).toEqual(style);
    expect(cloned).not.toBe(style);
  });

  it("does not share reference with original", () => {
    const style: TextStyle = { italic: true } as TextStyle;
    const cloned = cloneTextStyle(style)!;
    (cloned as Record<string, unknown>).italic = false;
    expect((style as Record<string, unknown>).italic).toBe(true);
  });

  it("preserves all properties", () => {
    const style = {
      bold: true,
      italic: false,
      fontSize: 18,
      fontFamily: "Arial",
    } as unknown as TextStyle;
    const cloned = cloneTextStyle(style);
    expect(cloned).toEqual(style);
  });

  it("handles empty style object", () => {
    const style = {} as TextStyle;
    const cloned = cloneTextStyle(style);
    expect(cloned).toEqual({});
    expect(cloned).not.toBe(style);
  });
});

describe("cloneShapeStyle", () => {
  it("returns undefined for undefined input", () => {
    expect(cloneShapeStyle(undefined)).toBeUndefined();
  });

  it("creates a shallow copy of a shape style", () => {
    const style: ShapeStyle = {
      fillColor: "#FF0000",
    } as ShapeStyle;
    const cloned = cloneShapeStyle(style);
    expect(cloned).toEqual(style);
    expect(cloned).not.toBe(style);
  });

  it("deep-clones gradient stops", () => {
    const style = {
      fillColor: "#000",
      fillGradientStops: [
        { position: 0, color: "#000" },
        { position: 100, color: "#FFF" },
      ],
    } as unknown as ShapeStyle;
    const cloned = cloneShapeStyle(style)!;
    expect(cloned.fillGradientStops).toEqual(style.fillGradientStops);
    expect(cloned.fillGradientStops).not.toBe(style.fillGradientStops);
    expect(cloned.fillGradientStops![0]).not.toBe(style.fillGradientStops![0]);
  });

  it("handles style without gradient stops", () => {
    const style = { fillColor: "#00FF00" } as ShapeStyle;
    const cloned = cloneShapeStyle(style)!;
    expect(cloned.fillGradientStops).toBeUndefined();
  });

  it("handles empty style", () => {
    const style = {} as ShapeStyle;
    const cloned = cloneShapeStyle(style);
    expect(cloned).toEqual({ fillGradientStops: undefined });
  });
});

describe("cloneSlideTransition", () => {
  it("returns undefined for undefined input", () => {
    expect(cloneSlideTransition(undefined)).toBeUndefined();
  });

  it("creates a shallow copy", () => {
    const transition: PptxSlideTransition = {
      type: "fade",
      duration: 500,
    } as PptxSlideTransition;
    const cloned = cloneSlideTransition(transition);
    expect(cloned).toEqual(transition);
    expect(cloned).not.toBe(transition);
  });

  it("mutation of clone does not affect original", () => {
    const transition = {
      type: "push",
      duration: 300,
    } as PptxSlideTransition;
    const cloned = cloneSlideTransition(transition)!;
    (cloned as Record<string, unknown>).duration = 999;
    expect(transition.duration).toBe(300);
  });
});

describe("cloneElementAnimation", () => {
  it("creates a shallow copy", () => {
    const animation: PptxElementAnimation = {
      effect: "fadeIn",
      duration: 500,
    } as unknown as PptxElementAnimation;
    const cloned = cloneElementAnimation(animation);
    expect(cloned).toEqual(animation);
    expect(cloned).not.toBe(animation);
  });

  it("mutation of clone does not affect original", () => {
    const animation = {
      effect: "spin",
      duration: 1000,
    } as unknown as PptxElementAnimation;
    const cloned = cloneElementAnimation(animation);
    (cloned as Record<string, unknown>).duration = 0;
    expect((animation as Record<string, unknown>).duration).toBe(1000);
  });
});

describe("cloneChartData", () => {
  it("returns undefined for undefined input", () => {
    expect(cloneChartData(undefined)).toBeUndefined();
  });

  it("deep-clones categories and series values", () => {
    const data: PptxChartData = {
      type: "bar",
      categories: ["A", "B", "C"],
      series: [
        { name: "S1", values: [1, 2, 3] },
        { name: "S2", values: [4, 5, 6] },
      ],
    } as unknown as PptxChartData;
    const cloned = cloneChartData(data)!;
    expect(cloned).toEqual(data);
    expect(cloned.categories).not.toBe(data.categories);
    expect(cloned.series).not.toBe(data.series);
    expect(cloned.series[0].values).not.toBe(data.series[0].values);
  });

  it("handles data with empty arrays", () => {
    const data = {
      type: "line",
      categories: [],
      series: [],
    } as unknown as PptxChartData;
    const cloned = cloneChartData(data)!;
    expect(cloned.categories).toEqual([]);
    expect(cloned.series).toEqual([]);
  });

  it("mutation of cloned series does not affect original", () => {
    const data = {
      categories: ["X"],
      series: [{ name: "S1", values: [10] }],
    } as unknown as PptxChartData;
    const cloned = cloneChartData(data)!;
    cloned.series[0].values[0] = 999;
    expect((data.series as Array<{ values: number[] }>)[0].values[0]).toBe(10);
  });
});

describe("cloneSmartArtData", () => {
  it("returns undefined for undefined input", () => {
    expect(cloneSmartArtData(undefined)).toBeUndefined();
  });

  it("deep-clones nodes", () => {
    const data: PptxSmartArtData = {
      layout: "basicBlockList",
      nodes: [
        { text: "A", id: "1" },
        { text: "B", id: "2" },
      ],
    } as unknown as PptxSmartArtData;
    const cloned = cloneSmartArtData(data)!;
    expect(cloned).toEqual(data);
    expect(cloned.nodes).not.toBe(data.nodes);
    expect(cloned.nodes[0]).not.toBe(data.nodes[0]);
  });

  it("handles data with empty nodes", () => {
    const data = { layout: "process", nodes: [] } as unknown as PptxSmartArtData;
    const cloned = cloneSmartArtData(data)!;
    expect(cloned.nodes).toEqual([]);
  });
});

describe("cloneXmlObject", () => {
  it("returns undefined for undefined input", () => {
    expect(cloneXmlObject(undefined)).toBeUndefined();
  });

  it("deep-clones nested object", () => {
    const obj: XmlObject = {
      tag: "root",
      attrs: { id: "1" },
      children: [{ tag: "child", attrs: {} }],
    } as unknown as XmlObject;
    const cloned = cloneXmlObject(obj)!;
    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
  });

  it("handles simple object", () => {
    const obj = { value: "test" } as unknown as XmlObject;
    const cloned = cloneXmlObject(obj)!;
    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
  });

  it("returns undefined for objects that cannot be serialised", () => {
    // Circular reference
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const result = cloneXmlObject(obj as unknown as XmlObject);
    expect(result).toBeUndefined();
  });
});
