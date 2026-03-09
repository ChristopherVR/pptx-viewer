import { describe, it, expect } from "vitest";
import { applyLineProperties } from "./shape-style-line-helpers";
import type { ShapeLineStyleContext } from "./shape-style-line-helpers";
import type {
  ConnectorArrowType,
  ShapeStyle,
  StrokeDashType,
  XmlObject,
} from "../../types";

function makeStyle(overrides: Partial<ShapeStyle> = {}): ShapeStyle {
  return { ...overrides } as ShapeStyle;
}

function makeContext(
  overrides: Partial<ShapeLineStyleContext> = {},
): ShapeLineStyleContext {
  return {
    emuPerPx: 9525,
    parseColor: (colorNode: XmlObject | undefined) => {
      if (!colorNode) return undefined;
      const srgb = colorNode["a:srgbClr"] as XmlObject | undefined;
      if (srgb) return `#${srgb["@_val"]}`;
      return undefined;
    },
    extractColorOpacity: () => undefined,
    extractGradientFillColor: () => undefined,
    extractGradientOpacity: () => undefined,
    normalizeStrokeDashType: (value: unknown): StrokeDashType | undefined => {
      const valid: StrokeDashType[] = [
        "solid",
        "dot",
        "dash",
        "lgDash",
        "dashDot",
        "lgDashDot",
        "lgDashDotDot",
        "sysDot",
        "sysDash",
        "sysDashDot",
        "sysDashDotDot",
      ];
      return valid.includes(value as StrokeDashType)
        ? (value as StrokeDashType)
        : undefined;
    },
    normalizeConnectorArrowType: (
      value: unknown,
    ): ConnectorArrowType | undefined => {
      const valid: ConnectorArrowType[] = [
        "none",
        "triangle",
        "stealth",
        "diamond",
        "oval",
        "arrow",
      ];
      return valid.includes(value as ConnectorArrowType)
        ? (value as ConnectorArrowType)
        : undefined;
    },
    ensureArray: (value: unknown): unknown[] => {
      if (Array.isArray(value)) return value;
      if (value === undefined || value === null) return [];
      return [value];
    },
    ...overrides,
  };
}

// A no-op resolveHiddenLine helper (returns undefined — no hidden line).
const noHiddenLine = () => undefined;

// ---------------------------------------------------------------------------
// applyLineProperties — noFill
// ---------------------------------------------------------------------------

describe("applyLineProperties — noFill", () => {
  it("returns true and sets strokeWidth=0, strokeColor=transparent when noFill and no hidden line", () => {
    const lineNode: XmlObject = { "a:noFill": {} };
    const style = makeStyle();
    const result = applyLineProperties(
      lineNode,
      {},
      style,
      makeContext(),
      noHiddenLine,
    );
    expect(result).toBe(true);
    expect(style.strokeWidth).toBe(0);
    expect(style.strokeColor).toBe("transparent");
  });

  it("applies hidden line width and color when resolveHiddenLine returns props", () => {
    const lineNode: XmlObject = { "a:noFill": {} };
    const style = makeStyle();
    const hiddenLineProps: XmlObject = {
      "@_w": "19050",
      "a:solidFill": { "a:srgbClr": { "@_val": "FF0000" } },
    };
    const result = applyLineProperties(
      lineNode,
      {},
      style,
      makeContext(),
      () => hiddenLineProps,
    );
    expect(result).toBe(true);
    // 19050 / 9525 = 2
    expect(style.strokeWidth).toBe(2);
    expect(style.strokeColor).toBe("#FF0000");
  });
});

// ---------------------------------------------------------------------------
// applyLineProperties — line width
// ---------------------------------------------------------------------------

describe("applyLineProperties — line width", () => {
  it("extracts line width from @_w (12700 EMU = 1pt ≈ 1.33px)", () => {
    const lineNode: XmlObject = { "@_w": "12700" };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    // 12700 / 9525 ≈ 1.333
    expect(style.strokeWidth).toBeCloseTo(1.333, 2);
  });

  it("extracts larger line width (38100 => 4px)", () => {
    const lineNode: XmlObject = { "@_w": "38100" };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    // 38100 / 9525 = 4
    expect(style.strokeWidth).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// applyLineProperties — stroke color
// ---------------------------------------------------------------------------

describe("applyLineProperties — stroke color", () => {
  it("applies solid fill stroke color", () => {
    const lineNode: XmlObject = {
      "a:solidFill": { "a:srgbClr": { "@_val": "0000FF" } },
    };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.strokeColor).toBe("#0000FF");
  });

  it("applies gradient fill stroke color via context callback", () => {
    const lineNode: XmlObject = {
      "a:gradFill": { "a:gsLst": {} },
    };
    const style = makeStyle();
    const ctx = makeContext({
      extractGradientFillColor: () => "#AABBCC",
      extractGradientOpacity: () => 0.8,
    });
    applyLineProperties(lineNode, {}, style, ctx, noHiddenLine);
    expect(style.strokeColor).toBe("#AABBCC");
    expect(style.strokeOpacity).toBe(0.8);
  });

  it("applies pattern fill stroke color from foreground", () => {
    const lineNode: XmlObject = {
      "a:pattFill": {
        "a:fgClr": { "a:srgbClr": { "@_val": "112233" } },
        "a:bgClr": { "a:srgbClr": { "@_val": "445566" } },
      },
    };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.strokeColor).toBe("#112233");
  });
});

// ---------------------------------------------------------------------------
// applyLineProperties — dash patterns
// ---------------------------------------------------------------------------

describe("applyLineProperties — dash patterns", () => {
  it("applies preset dash type 'dash'", () => {
    const lineNode: XmlObject = {
      "a:prstDash": { "@_val": "dash" },
    };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.strokeDash).toBe("dash");
  });

  it("applies preset dash type 'dot'", () => {
    const lineNode: XmlObject = {
      "a:prstDash": { "@_val": "dot" },
    };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.strokeDash).toBe("dot");
  });

  it("applies preset dash type 'lgDash'", () => {
    const lineNode: XmlObject = {
      "a:prstDash": { "@_val": "lgDash" },
    };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.strokeDash).toBe("lgDash");
  });

  it("applies preset dash type 'sysDash'", () => {
    const lineNode: XmlObject = {
      "a:prstDash": { "@_val": "sysDash" },
    };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.strokeDash).toBe("sysDash");
  });

  it("applies preset dash type 'dashDot'", () => {
    const lineNode: XmlObject = {
      "a:prstDash": { "@_val": "dashDot" },
    };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.strokeDash).toBe("dashDot");
  });

  it("applies custom dash segments", () => {
    const lineNode: XmlObject = {
      "a:custDash": {
        "a:ds": [
          { "@_d": "400000", "@_sp": "200000" },
          { "@_d": "100000", "@_sp": "200000" },
        ],
      },
    };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.strokeDash).toBe("custom");
    expect(style.customDashSegments).toEqual([
      { dash: 400000, space: 200000 },
      { dash: 100000, space: 200000 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// applyLineProperties — arrow heads
// ---------------------------------------------------------------------------

describe("applyLineProperties — arrow heads", () => {
  it("applies head end arrow type 'triangle' with size 'lg'", () => {
    const lineNode: XmlObject = {
      "a:headEnd": { "@_type": "triangle", "@_w": "lg", "@_len": "lg" },
    };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.connectorStartArrow).toBe("triangle");
    expect(style.connectorStartArrowWidth).toBe("lg");
    expect(style.connectorStartArrowLength).toBe("lg");
  });

  it("applies tail end arrow type 'stealth' with size 'sm'", () => {
    const lineNode: XmlObject = {
      "a:tailEnd": { "@_type": "stealth", "@_w": "sm", "@_len": "sm" },
    };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.connectorEndArrow).toBe("stealth");
    expect(style.connectorEndArrowWidth).toBe("sm");
    expect(style.connectorEndArrowLength).toBe("sm");
  });

  it("applies both head and tail arrows", () => {
    const lineNode: XmlObject = {
      "a:headEnd": { "@_type": "diamond", "@_w": "med", "@_len": "med" },
      "a:tailEnd": { "@_type": "oval", "@_w": "lg", "@_len": "sm" },
    };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.connectorStartArrow).toBe("diamond");
    expect(style.connectorStartArrowWidth).toBe("med");
    expect(style.connectorEndArrow).toBe("oval");
    expect(style.connectorEndArrowLength).toBe("sm");
  });
});

// ---------------------------------------------------------------------------
// applyLineProperties — join, cap, compound
// ---------------------------------------------------------------------------

describe("applyLineProperties — join, cap, compound", () => {
  it("applies round line join", () => {
    const lineNode: XmlObject = { "a:round": {} };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.lineJoin).toBe("round");
  });

  it("applies bevel line join", () => {
    const lineNode: XmlObject = { "a:bevel": {} };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.lineJoin).toBe("bevel");
  });

  it("applies miter line join", () => {
    const lineNode: XmlObject = { "a:miter": {} };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.lineJoin).toBe("miter");
  });

  it("applies cap type 'rnd'", () => {
    const lineNode: XmlObject = { "@_cap": "rnd" };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.lineCap).toBe("rnd");
  });

  it("applies cap type 'sq'", () => {
    const lineNode: XmlObject = { "@_cap": "sq" };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.lineCap).toBe("sq");
  });

  it("applies cap type 'flat'", () => {
    const lineNode: XmlObject = { "@_cap": "flat" };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.lineCap).toBe("flat");
  });

  it("applies compound line type 'dbl'", () => {
    const lineNode: XmlObject = { "@_cmpd": "dbl" };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.compoundLine).toBe("dbl");
  });

  it("applies compound line type 'thickThin'", () => {
    const lineNode: XmlObject = { "@_cmpd": "thickThin" };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.compoundLine).toBe("thickThin");
  });

  it("applies compound line type 'tri'", () => {
    const lineNode: XmlObject = { "@_cmpd": "tri" };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.compoundLine).toBe("tri");
  });
});

// ---------------------------------------------------------------------------
// applyLineProperties — line effects (shadow and glow)
// ---------------------------------------------------------------------------

describe("applyLineProperties — line effects", () => {
  it("applies line shadow from a:effectLst/a:outerShdw", () => {
    const lineNode: XmlObject = {
      "a:effectLst": {
        "a:outerShdw": {
          "@_blurRad": "38100",
          "@_dist": "19050",
          "@_dir": "2700000",
          "a:srgbClr": { "@_val": "000000" },
        },
      },
    };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.lineShadowColor).toBe("#000000");
    // 38100 / 9525 = 4
    expect(style.lineShadowBlur).toBe(4);
    // dist = 19050 / 9525 = 2
    // dir = 2700000 / 60000 = 45 degrees
    expect(style.lineShadowOffsetX).toBeCloseTo(
      Math.round(Math.cos((45 * Math.PI) / 180) * 2 * 100) / 100,
      2,
    );
    expect(style.lineShadowOffsetY).toBeCloseTo(
      Math.round(Math.sin((45 * Math.PI) / 180) * 2 * 100) / 100,
      2,
    );
  });

  it("applies line glow from a:effectLst/a:glow", () => {
    const lineNode: XmlObject = {
      "a:effectLst": {
        "a:glow": {
          "@_rad": "57150",
          "a:srgbClr": { "@_val": "FFFF00" },
        },
      },
    };
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.lineGlowColor).toBe("#FFFF00");
    // 57150 / 9525 = 6
    expect(style.lineGlowRadius).toBe(6);
  });

  it("does not set line effects when a:effectLst is absent", () => {
    const lineNode: XmlObject = {};
    const style = makeStyle();
    applyLineProperties(lineNode, {}, style, makeContext(), noHiddenLine);
    expect(style.lineShadowColor).toBeUndefined();
    expect(style.lineGlowColor).toBeUndefined();
  });
});
