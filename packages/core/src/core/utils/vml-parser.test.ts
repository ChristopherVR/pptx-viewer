import { describe, it, expect } from "vitest";
import {
  VML_SHAPE_TAGS,
  parseVmlElement,
  parseVmlElements,
} from "./vml-parser";
import type { XmlObject } from "../types";

// ---------------------------------------------------------------------------
// VML_SHAPE_TAGS
// ---------------------------------------------------------------------------

describe("VML_SHAPE_TAGS", () => {
  it("contains v:shape", () => {
    expect(VML_SHAPE_TAGS.has("v:shape")).toBe(true);
  });

  it("contains v:rect", () => {
    expect(VML_SHAPE_TAGS.has("v:rect")).toBe(true);
  });

  it("contains v:oval", () => {
    expect(VML_SHAPE_TAGS.has("v:oval")).toBe(true);
  });

  it("contains v:line", () => {
    expect(VML_SHAPE_TAGS.has("v:line")).toBe(true);
  });

  it("contains v:roundrect", () => {
    expect(VML_SHAPE_TAGS.has("v:roundrect")).toBe(true);
  });

  it("contains v:group", () => {
    expect(VML_SHAPE_TAGS.has("v:group")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseVmlElement — v:rect
// ---------------------------------------------------------------------------

describe("parseVmlElement - v:rect", () => {
  it("parses a basic rect with style position and size", () => {
    const node: XmlObject = {
      "@_style": "position:absolute;left:100pt;top:50pt;width:200pt;height:100pt",
    };
    const el = parseVmlElement("v:rect", node, "test-", 0);
    expect(el).not.toBeNull();
    expect(el!.type).toBe("shape");
    expect(el!.x).toBeGreaterThan(0);
    expect(el!.y).toBeGreaterThan(0);
    expect(el!.width).toBeGreaterThan(0);
    expect(el!.height).toBeGreaterThan(0);
  });

  it("assigns rect shapeType for v:rect tag", () => {
    const node: XmlObject = {
      "@_style": "left:0;top:0;width:100pt;height:50pt",
    };
    const el = parseVmlElement("v:rect", node, "test-", 0);
    expect(el).not.toBeNull();
    expect((el as any).shapeType).toBe("rect");
  });

  it("generates correct element id from prefix and index", () => {
    const node: XmlObject = {
      "@_style": "left:0;top:0;width:100pt;height:50pt",
    };
    const el = parseVmlElement("v:rect", node, "slide-", 3);
    expect(el).not.toBeNull();
    expect(el!.id).toBe("slide-vml-3");
  });

  it("extracts fill color from fillcolor attribute", () => {
    const node: XmlObject = {
      "@_style": "left:0;top:0;width:100pt;height:50pt",
      "@_fillcolor": "#ff0000",
    };
    const el = parseVmlElement("v:rect", node, "test-", 0);
    expect(el).not.toBeNull();
    expect((el as any).shapeStyle.fillColor).toBe("#ff0000");
    expect((el as any).shapeStyle.fillMode).toBe("solid");
  });

  it("sets fillMode to none when filled is false", () => {
    const node: XmlObject = {
      "@_style": "left:0;top:0;width:100pt;height:50pt",
      "@_filled": "f",
    };
    const el = parseVmlElement("v:rect", node, "test-", 0);
    expect(el).not.toBeNull();
    expect((el as any).shapeStyle.fillMode).toBe("none");
  });

  it("sets strokeWidth to 0 when stroked is false", () => {
    const node: XmlObject = {
      "@_style": "left:0;top:0;width:100pt;height:50pt",
      "@_stroked": "false",
    };
    const el = parseVmlElement("v:rect", node, "test-", 0);
    expect(el).not.toBeNull();
    expect((el as any).shapeStyle.strokeWidth).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// parseVmlElement — v:oval
// ---------------------------------------------------------------------------

describe("parseVmlElement - v:oval", () => {
  it("maps v:oval to ellipse shapeType", () => {
    const node: XmlObject = {
      "@_style": "left:10pt;top:20pt;width:80pt;height:80pt",
    };
    const el = parseVmlElement("v:oval", node, "test-", 0);
    expect(el).not.toBeNull();
    expect((el as any).shapeType).toBe("ellipse");
  });
});

// ---------------------------------------------------------------------------
// parseVmlElement — v:line
// ---------------------------------------------------------------------------

describe("parseVmlElement - v:line", () => {
  it("parses line from/to coordinates", () => {
    const node: XmlObject = {
      "@_from": "0pt,0pt",
      "@_to": "100pt,50pt",
    };
    const el = parseVmlElement("v:line", node, "test-", 0);
    expect(el).not.toBeNull();
    expect((el as any).shapeType).toBe("line");
    expect(el!.width).toBeGreaterThan(0);
    expect(el!.height).toBeGreaterThan(0);
  });

  it("handles line with pixel coordinates", () => {
    const node: XmlObject = {
      "@_from": "10,20",
      "@_to": "200,100",
    };
    const el = parseVmlElement("v:line", node, "test-", 0);
    expect(el).not.toBeNull();
    expect(el!.x).toBe(10);
    expect(el!.y).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// parseVmlElement — v:roundrect
// ---------------------------------------------------------------------------

describe("parseVmlElement - v:roundrect", () => {
  it("maps v:roundrect to roundRect shapeType", () => {
    const node: XmlObject = {
      "@_style": "left:0;top:0;width:100pt;height:50pt",
    };
    const el = parseVmlElement("v:roundrect", node, "test-", 0);
    expect(el).not.toBeNull();
    expect((el as any).shapeType).toBe("roundRect");
  });

  it("extracts arc size as shape adjustment", () => {
    const node: XmlObject = {
      "@_style": "left:0;top:0;width:100pt;height:50pt",
      "@_arcsize": "0.2",
    };
    const el = parseVmlElement("v:roundrect", node, "test-", 0);
    expect(el).not.toBeNull();
    expect((el as any).shapeAdjustments).toBeDefined();
    expect((el as any).shapeAdjustments.adj).toBe(10000); // 0.2 * 50000
  });
});

// ---------------------------------------------------------------------------
// parseVmlElement — v:shape with rotation and flip
// ---------------------------------------------------------------------------

describe("parseVmlElement - rotation and flip", () => {
  it("extracts rotation from style", () => {
    const node: XmlObject = {
      "@_style": "left:0;top:0;width:100pt;height:50pt;rotation:45",
    };
    const el = parseVmlElement("v:rect", node, "test-", 0);
    expect(el).not.toBeNull();
    expect(el!.rotation).toBe(45);
  });

  it("extracts horizontal flip from style", () => {
    const node: XmlObject = {
      "@_style": "left:0;top:0;width:100pt;height:50pt;flip:x",
    };
    const el = parseVmlElement("v:rect", node, "test-", 0);
    expect(el).not.toBeNull();
    expect(el!.flipHorizontal).toBe(true);
  });

  it("extracts vertical flip from style", () => {
    const node: XmlObject = {
      "@_style": "left:0;top:0;width:100pt;height:50pt;flip:y",
    };
    const el = parseVmlElement("v:rect", node, "test-", 0);
    expect(el).not.toBeNull();
    expect(el!.flipVertical).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseVmlElement — v:shape with textbox
// ---------------------------------------------------------------------------

describe("parseVmlElement - textbox", () => {
  it("extracts text from v:textbox child", () => {
    const node: XmlObject = {
      "@_style": "left:0;top:0;width:100pt;height:50pt",
      "v:textbox": {
        "div": {
          "#text": "Hello World",
        },
      },
    };
    const el = parseVmlElement("v:rect", node, "test-", 0);
    expect(el).not.toBeNull();
    expect((el as any).text).toBe("Hello World");
    expect((el as any).textSegments).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// parseVmlElements
// ---------------------------------------------------------------------------

describe("parseVmlElements", () => {
  it("returns empty array for container with no VML tags", () => {
    const container = { "p:sp": {} };
    expect(parseVmlElements(container)).toEqual([]);
  });

  it("parses multiple rect elements", () => {
    const container = {
      "v:rect": [
        { "@_style": "left:0;top:0;width:100pt;height:50pt" },
        { "@_style": "left:100pt;top:0;width:100pt;height:50pt" },
      ],
    };
    const elements = parseVmlElements(container, "bulk-");
    expect(elements).toHaveLength(2);
    expect(elements[0].id).toBe("bulk-vml-0");
    expect(elements[1].id).toBe("bulk-vml-1");
  });

  it("parses single element (not in array)", () => {
    const container = {
      "v:oval": {
        "@_style": "left:10pt;top:20pt;width:80pt;height:80pt",
      },
    };
    const elements = parseVmlElements(container);
    expect(elements).toHaveLength(1);
    expect((elements[0] as any).shapeType).toBe("ellipse");
  });

  it("skips elements that fail to parse", () => {
    // v:group with no children should return null
    const container = {
      "v:group": {
        "@_style": "left:0;top:0;width:100pt;height:50pt",
      },
    };
    const elements = parseVmlElements(container);
    expect(elements).toHaveLength(0);
  });

  it("mixes different VML tag types", () => {
    const container = {
      "v:rect": {
        "@_style": "left:0;top:0;width:100pt;height:50pt",
      },
      "v:oval": {
        "@_style": "left:0;top:0;width:80pt;height:80pt",
      },
    };
    const elements = parseVmlElements(container, "mix-");
    expect(elements).toHaveLength(2);
  });

  it("uses empty string as default idPrefix", () => {
    const container = {
      "v:rect": {
        "@_style": "left:0;top:0;width:50pt;height:50pt",
      },
    };
    const elements = parseVmlElements(container);
    expect(elements[0].id).toBe("vml-0");
  });
});
