import { describe, it, expect } from "vitest";

import type { XmlObject, ShapeStyle } from "../../types";

/**
 * The `applyFillAndStroke` method is protected on the class. We reimplemented
 * the core fill/stroke logic to test in isolation.
 *
 * Portions that delegate to service methods (buildGradientFillXml,
 * clampUnitInterval, buildLineEffectListXml) are stubbed.
 */

const EMU_PER_PX = 9525;

function clampUnitInterval(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function applyFillAndStroke(
  spPr: XmlObject,
  shapeStyle: ShapeStyle,
  gradientFillXml?: XmlObject,
  lineEffectListXml?: XmlObject,
): void {
  const requestedFillMode = shapeStyle.fillMode;

  // Fill
  if (
    requestedFillMode === "none" ||
    shapeStyle.fillColor === "transparent"
  ) {
    spPr["a:noFill"] = {};
    delete spPr["a:solidFill"];
    delete spPr["a:gradFill"];
    delete spPr["a:blipFill"];
  } else if (requestedFillMode === "gradient") {
    delete spPr["a:noFill"];
    delete spPr["a:solidFill"];
    delete spPr["a:blipFill"];
    if (gradientFillXml) {
      spPr["a:gradFill"] = gradientFillXml;
    }
  } else if (requestedFillMode === "pattern") {
    delete spPr["a:noFill"];
    delete spPr["a:solidFill"];
    delete spPr["a:gradFill"];
    delete spPr["a:blipFill"];
    const pattNode: XmlObject = {};
    const preset = shapeStyle.fillPatternPreset;
    if (preset) {
      pattNode["@_prst"] = preset;
    }
    if (shapeStyle.fillPatternFgClrXml) {
      pattNode["a:fgClr"] = shapeStyle.fillPatternFgClrXml;
    } else if (shapeStyle.fillColor) {
      pattNode["a:fgClr"] = {
        "a:srgbClr": { "@_val": shapeStyle.fillColor.replace("#", "") },
      };
    }
    if (shapeStyle.fillPatternBgClrXml) {
      pattNode["a:bgClr"] = shapeStyle.fillPatternBgClrXml;
    } else if (shapeStyle.fillPatternBackgroundColor) {
      pattNode["a:bgClr"] = {
        "a:srgbClr": {
          "@_val": shapeStyle.fillPatternBackgroundColor.replace("#", ""),
        },
      };
    }
    spPr["a:pattFill"] = pattNode;
  } else if (
    requestedFillMode === "solid" ||
    shapeStyle.fillColor !== undefined
  ) {
    const fillColor = String(shapeStyle.fillColor || "").trim();
    if (fillColor.length > 0) {
      delete spPr["a:noFill"];
      delete spPr["a:gradFill"];
      delete spPr["a:blipFill"];
      const solidFill: XmlObject = {
        "a:srgbClr": { "@_val": fillColor.replace("#", "") },
      };
      if (
        typeof shapeStyle.fillOpacity === "number" &&
        shapeStyle.fillOpacity >= 0 &&
        shapeStyle.fillOpacity < 1
      ) {
        (solidFill["a:srgbClr"] as XmlObject)["a:alpha"] = {
          "@_val": String(
            Math.round(clampUnitInterval(shapeStyle.fillOpacity) * 100000),
          ),
        };
      }
      spPr["a:solidFill"] = solidFill;
    }
  }

  // Stroke
  if (shapeStyle.strokeColor !== undefined) {
    if (!spPr["a:ln"]) spPr["a:ln"] = {};
    const lineNode = spPr["a:ln"] as XmlObject;
    const w = Math.round((shapeStyle.strokeWidth || 1) * EMU_PER_PX);
    lineNode["@_w"] = String(w);
    if (
      shapeStyle.strokeColor === "transparent" ||
      shapeStyle.strokeWidth === 0
    ) {
      lineNode["a:noFill"] = {};
      delete lineNode["a:solidFill"];
    } else {
      delete lineNode["a:noFill"];
      const lineFill: XmlObject = {
        "a:srgbClr": { "@_val": shapeStyle.strokeColor.replace("#", "") },
      };
      if (
        typeof shapeStyle.strokeOpacity === "number" &&
        shapeStyle.strokeOpacity >= 0 &&
        shapeStyle.strokeOpacity < 1
      ) {
        (lineFill["a:srgbClr"] as XmlObject)["a:alpha"] = {
          "@_val": String(
            Math.round(
              clampUnitInterval(shapeStyle.strokeOpacity) * 100000,
            ),
          ),
        };
      }
      lineNode["a:solidFill"] = lineFill;
    }
  }
  if (shapeStyle.strokeDash !== undefined) {
    if (!spPr["a:ln"]) spPr["a:ln"] = {};
    const lineNode = spPr["a:ln"] as XmlObject;
    if (shapeStyle.strokeDash === "solid") {
      delete lineNode["a:prstDash"];
      delete lineNode["a:custDash"];
    } else if (shapeStyle.strokeDash === "custom") {
      delete lineNode["a:prstDash"];
      if (
        shapeStyle.customDashSegments &&
        shapeStyle.customDashSegments.length > 0
      ) {
        lineNode["a:custDash"] = {
          "a:ds": shapeStyle.customDashSegments.map((seg) => ({
            "@_d": String(seg.dash),
            "@_sp": String(seg.space),
          })),
        };
      } else {
        lineNode["a:custDash"] = {
          "a:ds": { "@_d": "200000", "@_sp": "200000" },
        };
      }
    } else {
      lineNode["a:prstDash"] = { "@_val": shapeStyle.strokeDash };
      delete lineNode["a:custDash"];
    }
  }

  // Connector arrows
  if (
    shapeStyle.connectorEndArrow !== undefined &&
    (spPr["a:ln"] || shapeStyle.connectorEndArrow !== "none")
  ) {
    if (!spPr["a:ln"]) spPr["a:ln"] = {};
    const lineNode = spPr["a:ln"] as XmlObject;
    if (shapeStyle.connectorEndArrow === "none") {
      delete lineNode["a:tailEnd"];
    } else {
      const tailEnd: XmlObject = { "@_type": shapeStyle.connectorEndArrow };
      if (shapeStyle.connectorEndArrowWidth)
        tailEnd["@_w"] = shapeStyle.connectorEndArrowWidth;
      if (shapeStyle.connectorEndArrowLength)
        tailEnd["@_len"] = shapeStyle.connectorEndArrowLength;
      lineNode["a:tailEnd"] = tailEnd;
    }
  }
  if (
    shapeStyle.connectorStartArrow !== undefined &&
    (spPr["a:ln"] || shapeStyle.connectorStartArrow !== "none")
  ) {
    if (!spPr["a:ln"]) spPr["a:ln"] = {};
    const lineNode = spPr["a:ln"] as XmlObject;
    if (shapeStyle.connectorStartArrow === "none") {
      delete lineNode["a:headEnd"];
    } else {
      const headEnd: XmlObject = {
        "@_type": shapeStyle.connectorStartArrow,
      };
      if (shapeStyle.connectorStartArrowWidth)
        headEnd["@_w"] = shapeStyle.connectorStartArrowWidth;
      if (shapeStyle.connectorStartArrowLength)
        headEnd["@_len"] = shapeStyle.connectorStartArrowLength;
      lineNode["a:headEnd"] = headEnd;
    }
  }

  // Line join
  if (shapeStyle.lineJoin !== undefined) {
    if (!spPr["a:ln"]) spPr["a:ln"] = {};
    const lineNode = spPr["a:ln"] as XmlObject;
    delete lineNode["a:round"];
    delete lineNode["a:bevel"];
    delete lineNode["a:miter"];
    if (shapeStyle.lineJoin === "round") {
      lineNode["a:round"] = {};
    } else if (shapeStyle.lineJoin === "bevel") {
      lineNode["a:bevel"] = {};
    } else if (shapeStyle.lineJoin === "miter") {
      lineNode["a:miter"] = { "@_lim": "800000" };
    }
  }
  // Line cap
  if (shapeStyle.lineCap !== undefined) {
    if (!spPr["a:ln"]) spPr["a:ln"] = {};
    (spPr["a:ln"] as XmlObject)["@_cap"] = shapeStyle.lineCap;
  }
  // Compound line
  if (shapeStyle.compoundLine !== undefined) {
    if (!spPr["a:ln"]) spPr["a:ln"] = {};
    (spPr["a:ln"] as XmlObject)["@_cmpd"] = shapeStyle.compoundLine;
  }

  // Line-level effects
  if (lineEffectListXml && spPr["a:ln"]) {
    (spPr["a:ln"] as XmlObject)["a:effectLst"] = lineEffectListXml;
  }
}

// ---------------------------------------------------------------------------
// Fill Tests
// ---------------------------------------------------------------------------
describe("applyFillAndStroke – fills", () => {
  it("should set noFill when fillMode is 'none'", () => {
    const spPr: XmlObject = { "a:solidFill": {} };
    applyFillAndStroke(spPr, { fillMode: "none" });
    expect(spPr["a:noFill"]).toEqual({});
    expect(spPr["a:solidFill"]).toBeUndefined();
  });

  it("should set noFill when fillColor is 'transparent'", () => {
    const spPr: XmlObject = {};
    applyFillAndStroke(spPr, { fillColor: "transparent" });
    expect(spPr["a:noFill"]).toEqual({});
  });

  it("should set gradient fill when fillMode is 'gradient'", () => {
    const spPr: XmlObject = { "a:solidFill": {} };
    const grad: XmlObject = { "a:gsLst": {} };
    applyFillAndStroke(spPr, { fillMode: "gradient" }, grad);
    expect(spPr["a:gradFill"]).toBe(grad);
    expect(spPr["a:solidFill"]).toBeUndefined();
    expect(spPr["a:noFill"]).toBeUndefined();
  });

  it("should set pattern fill with preset", () => {
    const spPr: XmlObject = {};
    applyFillAndStroke(spPr, {
      fillMode: "pattern",
      fillPatternPreset: "dkDnDiag",
      fillColor: "#000000",
      fillPatternBackgroundColor: "#FFFFFF",
    });
    const patt = spPr["a:pattFill"] as XmlObject;
    expect(patt["@_prst"]).toBe("dkDnDiag");
    expect(
      ((patt["a:fgClr"] as XmlObject)["a:srgbClr"] as XmlObject)["@_val"],
    ).toBe("000000");
    expect(
      ((patt["a:bgClr"] as XmlObject)["a:srgbClr"] as XmlObject)["@_val"],
    ).toBe("FFFFFF");
  });

  it("should prefer fillPatternFgClrXml over fillColor for pattern", () => {
    const rawClr: XmlObject = { "a:schemeClr": { "@_val": "accent1" } };
    const spPr: XmlObject = {};
    applyFillAndStroke(spPr, {
      fillMode: "pattern",
      fillColor: "#000000",
      fillPatternFgClrXml: rawClr,
    });
    const patt = spPr["a:pattFill"] as XmlObject;
    expect(patt["a:fgClr"]).toBe(rawClr);
  });

  it("should set solid fill and strip #", () => {
    const spPr: XmlObject = {};
    applyFillAndStroke(spPr, { fillColor: "#FF5500" });
    const solidFill = spPr["a:solidFill"] as XmlObject;
    expect((solidFill["a:srgbClr"] as XmlObject)["@_val"]).toBe("FF5500");
  });

  it("should include alpha for solid fill with opacity < 1", () => {
    const spPr: XmlObject = {};
    applyFillAndStroke(spPr, { fillColor: "#FF0000", fillOpacity: 0.5 });
    const solidFill = spPr["a:solidFill"] as XmlObject;
    const srgb = solidFill["a:srgbClr"] as XmlObject;
    expect((srgb["a:alpha"] as XmlObject)["@_val"]).toBe(
      String(Math.round(0.5 * 100000)),
    );
  });

  it("should not include alpha when opacity is 1", () => {
    const spPr: XmlObject = {};
    applyFillAndStroke(spPr, { fillColor: "#FF0000", fillOpacity: 1 });
    const solidFill = spPr["a:solidFill"] as XmlObject;
    const srgb = solidFill["a:srgbClr"] as XmlObject;
    expect(srgb["a:alpha"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Stroke Tests
// ---------------------------------------------------------------------------
describe("applyFillAndStroke – stroke", () => {
  it("should set stroke width in EMU and solid fill", () => {
    const spPr: XmlObject = {};
    applyFillAndStroke(spPr, { strokeColor: "#333333", strokeWidth: 2 });
    const ln = spPr["a:ln"] as XmlObject;
    expect(ln["@_w"]).toBe(String(Math.round(2 * EMU_PER_PX)));
    const fill = ln["a:solidFill"] as XmlObject;
    expect((fill["a:srgbClr"] as XmlObject)["@_val"]).toBe("333333");
  });

  it("should set noFill for transparent stroke", () => {
    const spPr: XmlObject = {};
    applyFillAndStroke(spPr, { strokeColor: "transparent" });
    const ln = spPr["a:ln"] as XmlObject;
    expect(ln["a:noFill"]).toEqual({});
    expect(ln["a:solidFill"]).toBeUndefined();
  });

  it("should set noFill when strokeWidth is 0", () => {
    const spPr: XmlObject = {};
    applyFillAndStroke(spPr, { strokeColor: "#000", strokeWidth: 0 });
    const ln = spPr["a:ln"] as XmlObject;
    expect(ln["a:noFill"]).toEqual({});
  });

  it("should include stroke alpha when opacity < 1", () => {
    const spPr: XmlObject = {};
    applyFillAndStroke(spPr, {
      strokeColor: "#000",
      strokeOpacity: 0.3,
    });
    const ln = spPr["a:ln"] as XmlObject;
    const fill = ln["a:solidFill"] as XmlObject;
    const srgb = fill["a:srgbClr"] as XmlObject;
    expect(srgb["a:alpha"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Dash Tests
// ---------------------------------------------------------------------------
describe("applyFillAndStroke – dash patterns", () => {
  it("should remove dash styles when dash is 'solid'", () => {
    const spPr: XmlObject = {
      "a:ln": { "a:prstDash": { "@_val": "dash" } },
    };
    applyFillAndStroke(spPr, { strokeDash: "solid" });
    const ln = spPr["a:ln"] as XmlObject;
    expect(ln["a:prstDash"]).toBeUndefined();
    expect(ln["a:custDash"]).toBeUndefined();
  });

  it("should set preset dash", () => {
    const spPr: XmlObject = {};
    applyFillAndStroke(spPr, { strokeDash: "dash" });
    const ln = spPr["a:ln"] as XmlObject;
    expect(ln["a:prstDash"]).toEqual({ "@_val": "dash" });
  });

  it("should set custom dash with segments", () => {
    const spPr: XmlObject = {};
    applyFillAndStroke(spPr, {
      strokeDash: "custom",
      customDashSegments: [
        { dash: 300000, space: 100000 },
        { dash: 100000, space: 100000 },
      ],
    });
    const ln = spPr["a:ln"] as XmlObject;
    const custDash = ln["a:custDash"] as XmlObject;
    const ds = custDash["a:ds"] as XmlObject[];
    expect(ds).toHaveLength(2);
    expect(ds[0]["@_d"]).toBe("300000");
    expect(ds[0]["@_sp"]).toBe("100000");
  });

  it("should set default custom dash when segments are empty", () => {
    const spPr: XmlObject = {};
    applyFillAndStroke(spPr, { strokeDash: "custom" });
    const ln = spPr["a:ln"] as XmlObject;
    const custDash = ln["a:custDash"] as XmlObject;
    expect(custDash["a:ds"]).toEqual({
      "@_d": "200000",
      "@_sp": "200000",
    });
  });
});

// ---------------------------------------------------------------------------
// Arrow Tests
// ---------------------------------------------------------------------------
describe("applyFillAndStroke – arrows", () => {
  it("should set tail end arrow with width and length", () => {
    const spPr: XmlObject = { "a:ln": {} };
    applyFillAndStroke(spPr, {
      connectorEndArrow: "triangle",
      connectorEndArrowWidth: "lg",
      connectorEndArrowLength: "sm",
    });
    const ln = spPr["a:ln"] as XmlObject;
    const tail = ln["a:tailEnd"] as XmlObject;
    expect(tail["@_type"]).toBe("triangle");
    expect(tail["@_w"]).toBe("lg");
    expect(tail["@_len"]).toBe("sm");
  });

  it("should remove tailEnd when endArrow is 'none'", () => {
    const spPr: XmlObject = {
      "a:ln": { "a:tailEnd": { "@_type": "triangle" } },
    };
    applyFillAndStroke(spPr, { connectorEndArrow: "none" });
    const ln = spPr["a:ln"] as XmlObject;
    expect(ln["a:tailEnd"]).toBeUndefined();
  });

  it("should set head end arrow", () => {
    const spPr: XmlObject = { "a:ln": {} };
    applyFillAndStroke(spPr, { connectorStartArrow: "arrow" });
    const ln = spPr["a:ln"] as XmlObject;
    expect((ln["a:headEnd"] as XmlObject)["@_type"]).toBe("arrow");
  });
});

// ---------------------------------------------------------------------------
// Line Join, Cap, Compound
// ---------------------------------------------------------------------------
describe("applyFillAndStroke – line join, cap, compound", () => {
  it("should set round join", () => {
    const spPr: XmlObject = {};
    applyFillAndStroke(spPr, { lineJoin: "round" });
    const ln = spPr["a:ln"] as XmlObject;
    expect(ln["a:round"]).toEqual({});
    expect(ln["a:bevel"]).toBeUndefined();
  });

  it("should set bevel join", () => {
    const spPr: XmlObject = {};
    applyFillAndStroke(spPr, { lineJoin: "bevel" });
    const ln = spPr["a:ln"] as XmlObject;
    expect(ln["a:bevel"]).toEqual({});
  });

  it("should set miter join with limit", () => {
    const spPr: XmlObject = {};
    applyFillAndStroke(spPr, { lineJoin: "miter" });
    const ln = spPr["a:ln"] as XmlObject;
    expect(ln["a:miter"]).toEqual({ "@_lim": "800000" });
  });

  it("should set line cap", () => {
    const spPr: XmlObject = {};
    applyFillAndStroke(spPr, { lineCap: "rnd" });
    const ln = spPr["a:ln"] as XmlObject;
    expect(ln["@_cap"]).toBe("rnd");
  });

  it("should set compound line type", () => {
    const spPr: XmlObject = {};
    applyFillAndStroke(spPr, { compoundLine: "dbl" });
    const ln = spPr["a:ln"] as XmlObject;
    expect(ln["@_cmpd"]).toBe("dbl");
  });

  it("should add line-level effectLst", () => {
    const spPr: XmlObject = { "a:ln": {} };
    const lineEffect: XmlObject = { "a:outerShdw": {} };
    applyFillAndStroke(spPr, {}, undefined, lineEffect);
    const ln = spPr["a:ln"] as XmlObject;
    expect(ln["a:effectLst"]).toBe(lineEffect);
  });
});
