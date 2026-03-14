/**
 * Tests for PptxHandlerRuntimeSaveShapeXml:
 *   - createInkShapeXml logic (ink path token parsing, shape XML generation)
 *   - buildGroupShapeXml logic (group structure, child categorization)
 */
import { describe, it, expect } from "vitest";

import type { XmlObject } from "../../types";

const EMU_PER_PX = 9525;

// ---------------------------------------------------------------------------
// Ink path token parsing — reimplemented from createInkShapeXml
// ---------------------------------------------------------------------------
function parseInkPathTokens(
  svgPath: string,
): { moveTo: { x: number; y: number }[]; lineTo: { x: number; y: number }[] } {
  const moveToList: { x: number; y: number }[] = [];
  const lnToList: { x: number; y: number }[] = [];
  const tokens = svgPath.match(/[ML]\s*[\d.eE+-]+\s+[\d.eE+-]+/g);
  if (tokens) {
    for (const token of tokens) {
      const parts = token.trim().split(/\s+/);
      const cmd = parts[0];
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      if (cmd === "M") {
        moveToList.push({ x, y });
      } else if (cmd === "L") {
        lnToList.push({ x, y });
      }
    }
  }
  return { moveTo: moveToList, lineTo: lnToList };
}

function buildInkShapeXml(el: {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  inkPaths: string[];
  inkColors?: string[];
  inkWidths?: number[];
  inkOpacities?: number[];
}): XmlObject {
  const offX = String(Math.round(el.x * EMU_PER_PX));
  const offY = String(Math.round(el.y * EMU_PER_PX));
  const extCx = String(Math.round(Math.max(el.width, 1) * EMU_PER_PX));
  const extCy = String(Math.round(Math.max(el.height, 1) * EMU_PER_PX));

  const xmlPaths: XmlObject[] = el.inkPaths.map((svgPath) => {
    const moveToList: XmlObject[] = [];
    const lnToList: XmlObject[] = [];
    const tokens = svgPath.match(/[ML]\s*[\d.eE+-]+\s+[\d.eE+-]+/g);
    if (tokens) {
      for (const token of tokens) {
        const parts = token.trim().split(/\s+/);
        const cmd = parts[0];
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        const pt = {
          "@_x": String(Math.round(x * EMU_PER_PX)),
          "@_y": String(Math.round(y * EMU_PER_PX)),
        };
        if (cmd === "M") moveToList.push({ "a:pt": pt });
        else if (cmd === "L") lnToList.push({ "a:pt": pt });
      }
    }
    const pathXml: XmlObject = {
      "@_w": extCx,
      "@_h": extCy,
      "@_stroke": "1",
      "@_fill": "none",
    };
    if (moveToList.length > 0) {
      pathXml["a:moveTo"] = moveToList.length === 1 ? moveToList[0] : moveToList;
    }
    if (lnToList.length > 0) {
      pathXml["a:lnTo"] = lnToList.length === 1 ? lnToList[0] : lnToList;
    }
    return pathXml;
  });

  const strokeColor = el.inkColors?.[0] ?? "#000000";
  const strokeWidth = el.inkWidths?.[0] ?? 2;
  const strokeOpacity = el.inkOpacities?.[0] ?? 1;
  const cleanColor = strokeColor.replace("#", "");

  return {
    "p:nvSpPr": {
      "p:cNvPr": { "@_id": "0", "@_name": el.id },
      "p:cNvSpPr": {},
      "p:nvPr": {},
    },
    "p:spPr": {
      "a:xfrm": {
        "a:off": { "@_x": offX, "@_y": offY },
        "a:ext": { "@_cx": extCx, "@_cy": extCy },
      },
      "a:custGeom": {
        "a:avLst": {},
        "a:gdLst": {},
        "a:ahLst": {},
        "a:cxnLst": {},
        "a:rect": { "@_l": "0", "@_t": "0", "@_r": extCx, "@_b": extCy },
        "a:pathLst": {
          "a:path": xmlPaths.length === 1 ? xmlPaths[0] : xmlPaths,
        },
      },
      "a:noFill": {},
      "a:ln": {
        "@_w": String(Math.round(strokeWidth * EMU_PER_PX)),
        "@_cap": "rnd",
        "a:solidFill": {
          "a:srgbClr": {
            "@_val": cleanColor,
            ...(strokeOpacity < 1
              ? {
                  "a:alpha": {
                    "@_val": String(Math.round(strokeOpacity * 100000)),
                  },
                }
              : {}),
          },
        },
        "a:round": {},
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Tests: parseInkPathTokens
// ---------------------------------------------------------------------------
describe("parseInkPathTokens", () => {
  it("should parse M and L commands", () => {
    const result = parseInkPathTokens("M 10 20 L 30 40 L 50 60");
    expect(result.moveTo).toEqual([{ x: 10, y: 20 }]);
    expect(result.lineTo).toEqual([
      { x: 30, y: 40 },
      { x: 50, y: 60 },
    ]);
  });

  it("should handle multiple M commands", () => {
    const result = parseInkPathTokens("M 0 0 M 100 200");
    expect(result.moveTo).toHaveLength(2);
    expect(result.lineTo).toHaveLength(0);
  });

  it("should return empty arrays for non-matching path", () => {
    const result = parseInkPathTokens("C 10 20 30 40 50 60");
    expect(result.moveTo).toHaveLength(0);
    expect(result.lineTo).toHaveLength(0);
  });

  it("should handle empty string", () => {
    const result = parseInkPathTokens("");
    expect(result.moveTo).toHaveLength(0);
    expect(result.lineTo).toHaveLength(0);
  });

  it("should parse floating-point coordinates", () => {
    const result = parseInkPathTokens("M 1.5 2.75 L 3.25 4.125");
    expect(result.moveTo[0]).toEqual({ x: 1.5, y: 2.75 });
    expect(result.lineTo[0]).toEqual({ x: 3.25, y: 4.125 });
  });
});

// ---------------------------------------------------------------------------
// Tests: buildInkShapeXml
// ---------------------------------------------------------------------------
describe("buildInkShapeXml", () => {
  it("should create basic ink shape with correct transform", () => {
    const result = buildInkShapeXml({
      id: "ink1",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      inkPaths: ["M 0 0 L 10 10"],
    });

    const spPr = result["p:spPr"] as XmlObject;
    const xfrm = spPr["a:xfrm"] as XmlObject;
    expect((xfrm["a:off"] as XmlObject)["@_x"]).toBe(
      String(Math.round(10 * EMU_PER_PX)),
    );
    expect((xfrm["a:off"] as XmlObject)["@_y"]).toBe(
      String(Math.round(20 * EMU_PER_PX)),
    );
  });

  it("should set element id and name", () => {
    const result = buildInkShapeXml({
      id: "myInk",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      inkPaths: ["M 0 0"],
    });
    const nvSpPr = result["p:nvSpPr"] as XmlObject;
    expect((nvSpPr["p:cNvPr"] as XmlObject)["@_name"]).toBe("myInk");
  });

  it("should use default stroke color #000000 when inkColors is undefined", () => {
    const result = buildInkShapeXml({
      id: "ink1",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      inkPaths: ["M 0 0"],
    });
    const ln = (result["p:spPr"] as XmlObject)["a:ln"] as XmlObject;
    const fill = ln["a:solidFill"] as XmlObject;
    expect((fill["a:srgbClr"] as XmlObject)["@_val"]).toBe("000000");
  });

  it("should strip # from custom ink color", () => {
    const result = buildInkShapeXml({
      id: "ink1",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      inkPaths: ["M 0 0"],
      inkColors: ["#FF0000"],
    });
    const ln = (result["p:spPr"] as XmlObject)["a:ln"] as XmlObject;
    const fill = ln["a:solidFill"] as XmlObject;
    expect((fill["a:srgbClr"] as XmlObject)["@_val"]).toBe("FF0000");
  });

  it("should include alpha when opacity is less than 1", () => {
    const result = buildInkShapeXml({
      id: "ink1",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      inkPaths: ["M 0 0"],
      inkOpacities: [0.5],
    });
    const ln = (result["p:spPr"] as XmlObject)["a:ln"] as XmlObject;
    const srgb = (ln["a:solidFill"] as XmlObject)["a:srgbClr"] as XmlObject;
    expect(srgb["a:alpha"]).toBeDefined();
    expect((srgb["a:alpha"] as XmlObject)["@_val"]).toBe(
      String(Math.round(0.5 * 100000)),
    );
  });

  it("should not include alpha when opacity is 1", () => {
    const result = buildInkShapeXml({
      id: "ink1",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      inkPaths: ["M 0 0"],
      inkOpacities: [1],
    });
    const ln = (result["p:spPr"] as XmlObject)["a:ln"] as XmlObject;
    const srgb = (ln["a:solidFill"] as XmlObject)["a:srgbClr"] as XmlObject;
    expect(srgb["a:alpha"]).toBeUndefined();
  });

  it("should clamp width to minimum 1 for zero-width elements", () => {
    const result = buildInkShapeXml({
      id: "ink1",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      inkPaths: ["M 0 0"],
    });
    const spPr = result["p:spPr"] as XmlObject;
    const ext = (spPr["a:xfrm"] as XmlObject)["a:ext"] as XmlObject;
    expect(ext["@_cx"]).toBe(String(Math.round(1 * EMU_PER_PX)));
    expect(ext["@_cy"]).toBe(String(Math.round(1 * EMU_PER_PX)));
  });

  it("should unwrap single path (no array wrapper)", () => {
    const result = buildInkShapeXml({
      id: "ink1",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      inkPaths: ["M 0 0 L 5 5"],
    });
    const custGeom = (result["p:spPr"] as XmlObject)["a:custGeom"] as XmlObject;
    const pathLst = custGeom["a:pathLst"] as XmlObject;
    // Single path should not be wrapped in an array
    expect(Array.isArray(pathLst["a:path"])).toBe(false);
  });

  it("should keep array for multiple paths", () => {
    const result = buildInkShapeXml({
      id: "ink1",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      inkPaths: ["M 0 0 L 5 5", "M 1 1 L 2 2"],
    });
    const custGeom = (result["p:spPr"] as XmlObject)["a:custGeom"] as XmlObject;
    const pathLst = custGeom["a:pathLst"] as XmlObject;
    expect(Array.isArray(pathLst["a:path"])).toBe(true);
    expect((pathLst["a:path"] as XmlObject[]).length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Group shape child categorization — reimplemented from buildGroupShapeXml
// ---------------------------------------------------------------------------
describe("buildGroupShapeXml child categorization", () => {
  function categorizeChildren(
    children: Array<{
      type: string;
      rawXml?: XmlObject;
    }>,
  ): { shapes: XmlObject[]; pics: XmlObject[]; connectors: XmlObject[] } {
    const shapes: XmlObject[] = [];
    const pics: XmlObject[] = [];
    const connectors: XmlObject[] = [];

    for (const child of children) {
      const xml = child.rawXml;
      if (!xml) continue;

      if (child.type === "picture" || child.type === "image") {
        pics.push(xml);
      } else if (child.type === "connector") {
        connectors.push(xml);
      } else {
        shapes.push(xml);
      }
    }
    return { shapes, pics, connectors };
  }

  it("should categorize shape children", () => {
    const children = [
      { type: "text", rawXml: { name: "text1" } as XmlObject },
      { type: "shape", rawXml: { name: "shape1" } as XmlObject },
    ];
    const result = categorizeChildren(children);
    expect(result.shapes).toHaveLength(2);
    expect(result.pics).toHaveLength(0);
    expect(result.connectors).toHaveLength(0);
  });

  it("should categorize picture children", () => {
    const children = [
      { type: "picture", rawXml: { name: "pic1" } as XmlObject },
      { type: "image", rawXml: { name: "img1" } as XmlObject },
    ];
    const result = categorizeChildren(children);
    expect(result.pics).toHaveLength(2);
    expect(result.shapes).toHaveLength(0);
  });

  it("should categorize connector children", () => {
    const children = [
      { type: "connector", rawXml: { name: "conn1" } as XmlObject },
    ];
    const result = categorizeChildren(children);
    expect(result.connectors).toHaveLength(1);
  });

  it("should skip children without rawXml", () => {
    const children = [{ type: "text" }, { type: "shape" }];
    const result = categorizeChildren(children);
    expect(result.shapes).toHaveLength(0);
    expect(result.pics).toHaveLength(0);
    expect(result.connectors).toHaveLength(0);
  });
});
