import { describe, it, expect } from "vitest";
import {
  parseSeriesTrendlines,
  parseSeriesErrBars,
  parseDataTable,
  parseLineStyle,
} from "./chart-advanced-parser";
import type { XmlObject } from "../types";

// ---------------------------------------------------------------------------
// Helpers — mock XmlLookupLike and ColorParserLike
// ---------------------------------------------------------------------------

/**
 * Build a simple XML lookup that stores children as direct properties
 * using the local name as key (matching the real interface).
 */
function createXmlLookup() {
  return {
    getChildByLocalName(
      parent: XmlObject | undefined,
      name: string,
    ): XmlObject | undefined {
      if (!parent) return undefined;
      // Try common namespace prefixes
      for (const prefix of ["c:", "c16:", "a:", ""]) {
        const key = `${prefix}${name}`;
        if (parent[key] !== undefined) return parent[key] as XmlObject;
      }
      return undefined;
    },
    getChildrenArrayByLocalName(
      parent: XmlObject | undefined,
      name: string,
    ): XmlObject[] {
      if (!parent) return [];
      for (const prefix of ["c:", "c16:", "a:", ""]) {
        const key = `${prefix}${name}`;
        const child = parent[key];
        if (child !== undefined) {
          return Array.isArray(child) ? child : [child as XmlObject];
        }
      }
      return [];
    },
  };
}

function createColorParser() {
  return {
    parseColor(
      fillNode: XmlObject | undefined,
      _placeholderColor?: string,
    ): string | undefined {
      if (!fillNode) return undefined;
      const srgb = fillNode["a:srgbClr"] as XmlObject | undefined;
      if (srgb) return `#${srgb["@_val"]}`;
      return undefined;
    },
  };
}

const xmlLookup = createXmlLookup();
const colorParser = createColorParser();

// ---------------------------------------------------------------------------
// parseSeriesTrendlines
// ---------------------------------------------------------------------------

describe("parseSeriesTrendlines", () => {
  it("returns empty array when no trendline nodes exist", () => {
    const seriesNode: XmlObject = {};
    const result = parseSeriesTrendlines(seriesNode, xmlLookup, colorParser);
    expect(result).toEqual([]);
  });

  it("parses a linear trendline", () => {
    const seriesNode: XmlObject = {
      "c:trendline": {
        "c:trendlineType": { "@_val": "linear" },
      },
    };
    const result = parseSeriesTrendlines(seriesNode, xmlLookup, colorParser);
    expect(result).toHaveLength(1);
    expect(result[0].trendlineType).toBe("linear");
  });

  it("parses an exponential trendline", () => {
    const seriesNode: XmlObject = {
      "c:trendline": {
        "c:trendlineType": { "@_val": "exp" },
      },
    };
    const result = parseSeriesTrendlines(seriesNode, xmlLookup, colorParser);
    expect(result).toHaveLength(1);
    expect(result[0].trendlineType).toBe("exponential");
  });

  it("parses polynomial trendline with order", () => {
    const seriesNode: XmlObject = {
      "c:trendline": {
        "c:trendlineType": { "@_val": "poly" },
        "c:order": { "@_val": "3" },
      },
    };
    const result = parseSeriesTrendlines(seriesNode, xmlLookup, colorParser);
    expect(result).toHaveLength(1);
    expect(result[0].trendlineType).toBe("polynomial");
    expect(result[0].order).toBe(3);
  });

  it("parses forward and backward projection", () => {
    const seriesNode: XmlObject = {
      "c:trendline": {
        "c:trendlineType": { "@_val": "linear" },
        "c:forward": { "@_val": "2.5" },
        "c:backward": { "@_val": "1.0" },
      },
    };
    const result = parseSeriesTrendlines(seriesNode, xmlLookup, colorParser);
    expect(result[0].forward).toBe(2.5);
    expect(result[0].backward).toBe(1.0);
  });

  it("parses displayRSq and displayEq flags", () => {
    const seriesNode: XmlObject = {
      "c:trendline": {
        "c:trendlineType": { "@_val": "linear" },
        "c:dispRSqr": { "@_val": "1" },
        "c:dispEq": { "@_val": "1" },
      },
    };
    const result = parseSeriesTrendlines(seriesNode, xmlLookup, colorParser);
    expect(result[0].displayRSq).toBe(true);
    expect(result[0].displayEq).toBe(true);
  });

  it("skips trendlines with unknown type", () => {
    const seriesNode: XmlObject = {
      "c:trendline": [
        { "c:trendlineType": { "@_val": "unknown" } },
        { "c:trendlineType": { "@_val": "linear" } },
      ],
    };
    const result = parseSeriesTrendlines(seriesNode, xmlLookup, colorParser);
    expect(result).toHaveLength(1);
    expect(result[0].trendlineType).toBe("linear");
  });

  it("parses trendline color from spPr", () => {
    const seriesNode: XmlObject = {
      "c:trendline": {
        "c:trendlineType": { "@_val": "linear" },
        "c:spPr": {
          "a:solidFill": {
            "a:srgbClr": { "@_val": "FF0000" },
          },
        },
      },
    };
    const result = parseSeriesTrendlines(seriesNode, xmlLookup, colorParser);
    expect(result[0].color).toBe("#FF0000");
  });
});

// ---------------------------------------------------------------------------
// parseSeriesErrBars
// ---------------------------------------------------------------------------

describe("parseSeriesErrBars", () => {
  const extractPointValues = (_container: XmlObject | undefined, _preferNumeric: boolean): string[] => [];

  it("returns empty array when no errBars nodes exist", () => {
    const result = parseSeriesErrBars({}, xmlLookup, extractPointValues);
    expect(result).toEqual([]);
  });

  it("parses basic error bars with fixedVal type", () => {
    const seriesNode: XmlObject = {
      "c:errBars": {
        "c:errDir": { "@_val": "y" },
        "c:errBarType": { "@_val": "both" },
        "c:errValType": { "@_val": "fixedVal" },
        "c:val": { "@_val": "5.0" },
      },
    };
    const result = parseSeriesErrBars(seriesNode, xmlLookup, extractPointValues);
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe("y");
    expect(result[0].barType).toBe("both");
    expect(result[0].valType).toBe("fixedVal");
    expect(result[0].val).toBe(5.0);
  });

  it("parses x-direction error bars", () => {
    const seriesNode: XmlObject = {
      "c:errBars": {
        "c:errDir": { "@_val": "x" },
        "c:errBarType": { "@_val": "plus" },
        "c:errValType": { "@_val": "percentage" },
        "c:val": { "@_val": "10" },
      },
    };
    const result = parseSeriesErrBars(seriesNode, xmlLookup, extractPointValues);
    expect(result[0].direction).toBe("x");
    expect(result[0].barType).toBe("plus");
    expect(result[0].valType).toBe("percentage");
  });

  it("skips errBars with no valType", () => {
    const seriesNode: XmlObject = {
      "c:errBars": {
        "c:errDir": { "@_val": "y" },
        "c:errBarType": { "@_val": "both" },
        "c:errValType": { "@_val": "unknownType" },
      },
    };
    const result = parseSeriesErrBars(seriesNode, xmlLookup, extractPointValues);
    expect(result).toHaveLength(0);
  });

  it("parses custom error bar values", () => {
    const customExtractor = (container: XmlObject | undefined, _preferNumeric: boolean): string[] => {
      if (!container) return [];
      const vals = (container as any)["c:numRef"]?.["c:numCache"]?.["c:pt"];
      if (!vals) return [];
      return Array.isArray(vals) ? vals.map((v: any) => String(v["c:v"])) : [String(vals["c:v"])];
    };

    const seriesNode: XmlObject = {
      "c:errBars": {
        "c:errDir": { "@_val": "y" },
        "c:errBarType": { "@_val": "both" },
        "c:errValType": { "@_val": "cust" },
        "c:plus": {
          "c:numRef": {
            "c:numCache": {
              "c:pt": [{ "c:v": "1.0" }, { "c:v": "2.0" }],
            },
          },
        },
        "c:minus": {
          "c:numRef": {
            "c:numCache": {
              "c:pt": [{ "c:v": "0.5" }],
            },
          },
        },
      },
    };
    const result = parseSeriesErrBars(seriesNode, xmlLookup, customExtractor);
    expect(result).toHaveLength(1);
    expect(result[0].customPlus).toEqual([1.0, 2.0]);
    expect(result[0].customMinus).toEqual([0.5]);
  });

  it("defaults errBarType to both when not specified", () => {
    const seriesNode: XmlObject = {
      "c:errBars": {
        "c:errValType": { "@_val": "stdErr" },
      },
    };
    const result = parseSeriesErrBars(seriesNode, xmlLookup, extractPointValues);
    expect(result[0].barType).toBe("both");
  });
});

// ---------------------------------------------------------------------------
// parseDataTable
// ---------------------------------------------------------------------------

describe("parseDataTable", () => {
  it("returns undefined when no dTable exists", () => {
    const result = parseDataTable({}, xmlLookup);
    expect(result).toBeUndefined();
  });

  it("parses data table with all borders and keys shown", () => {
    const plotArea: XmlObject = {
      "c:dTable": {
        "c:showHorzBorder": { "@_val": "1" },
        "c:showVertBorder": { "@_val": "1" },
        "c:showOutline": { "@_val": "1" },
        "c:showKeys": { "@_val": "1" },
      },
    };
    const result = parseDataTable(plotArea, xmlLookup);
    expect(result).toEqual({
      showHorzBorder: true,
      showVertBorder: true,
      showOutline: true,
      showKeys: true,
    });
  });

  it("returns defaults when dTable exists but has no properties", () => {
    const plotArea: XmlObject = {
      "c:dTable": {},
    };
    const result = parseDataTable(plotArea, xmlLookup);
    expect(result).toEqual({
      showHorzBorder: true,
      showVertBorder: true,
      showOutline: true,
      showKeys: true,
    });
  });

  it("parses partial data table properties", () => {
    const plotArea: XmlObject = {
      "c:dTable": {
        "c:showHorzBorder": { "@_val": "1" },
        "c:showKeys": { "@_val": "1" },
      },
    };
    const result = parseDataTable(plotArea, xmlLookup);
    expect(result!.showHorzBorder).toBe(true);
    expect(result!.showKeys).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseLineStyle
// ---------------------------------------------------------------------------

describe("parseLineStyle", () => {
  it("returns undefined when container is undefined", () => {
    const result = parseLineStyle(undefined, "majorGridlines", xmlLookup, colorParser);
    expect(result).toBeUndefined();
  });

  it("returns undefined when element is not found", () => {
    const container: XmlObject = {};
    const result = parseLineStyle(container, "majorGridlines", xmlLookup, colorParser);
    expect(result).toBeUndefined();
  });

  it("parses line color from spPr", () => {
    const container: XmlObject = {
      "c:majorGridlines": {
        "c:spPr": {
          "a:ln": {
            "a:solidFill": {
              "a:srgbClr": { "@_val": "0000FF" },
            },
          },
        },
      },
    };
    const result = parseLineStyle(container, "majorGridlines", xmlLookup, colorParser);
    expect(result).not.toBeUndefined();
    expect(result!.color).toBe("#0000FF");
  });

  it("parses line width from EMU", () => {
    const container: XmlObject = {
      "c:majorGridlines": {
        "c:spPr": {
          "a:ln": {
            "@_w": "25400",
          },
        },
      },
    };
    const result = parseLineStyle(container, "majorGridlines", xmlLookup, colorParser);
    expect(result).not.toBeUndefined();
    expect(result!.width).toBe(2); // 25400 / 12700
  });

  it("parses dash style", () => {
    const container: XmlObject = {
      "c:majorGridlines": {
        "c:spPr": {
          "a:ln": {
            "a:prstDash": { "@_val": "dash" },
          },
        },
      },
    };
    const result = parseLineStyle(container, "majorGridlines", xmlLookup, colorParser);
    expect(result).not.toBeUndefined();
    expect(result!.dashStyle).toBe("dash");
  });
});
