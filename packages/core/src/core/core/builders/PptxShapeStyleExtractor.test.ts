import { describe, it, expect } from "vitest";
import { PptxShapeStyleExtractor } from "./PptxShapeStyleExtractor";
import type { ShapeStyle, XmlObject } from "../../types";

const EMU_PER_PX = 9525;

/**
 * Build a PptxShapeStyleExtractor with minimal stubs.
 * The stubs return deterministic values so we can test extraction logic.
 */
function createExtractor() {
  return new PptxShapeStyleExtractor({
    emuPerPx: EMU_PER_PX,
    parseColor: (colorNode: XmlObject | undefined) => {
      if (!colorNode) return undefined;
      const srgb = colorNode["a:srgbClr"] as XmlObject | undefined;
      if (srgb) return `#${srgb["@_val"]}`;
      return undefined;
    },
    extractColorOpacity: (colorNode: XmlObject | undefined) => {
      if (!colorNode) return undefined;
      const srgb = colorNode["a:srgbClr"] as XmlObject | undefined;
      const alpha = srgb?.["a:alpha"] as XmlObject | undefined;
      if (alpha?.["@_val"]) {
        return parseFloat(String(alpha["@_val"])) / 100000;
      }
      return undefined;
    },
    extractGradientFillColor: () => "#gradient",
    extractGradientOpacity: () => 0.8,
    extractGradientFillCss: () => "linear-gradient(#f00, #00f)",
    extractGradientStops: () => [
      { color: "#FF0000", position: 0 },
      { color: "#0000FF", position: 100 },
    ],
    extractGradientAngle: () => 90,
    extractGradientType: () => "linear",
    extractGradientPathType: () => undefined,
    extractGradientFocalPoint: () => undefined,
    normalizeStrokeDashType: (value: unknown) => {
      const valid = [
        "solid",
        "dot",
        "dash",
        "lgDash",
        "dashDot",
        "lgDashDot",
        "lgDashDotDot",
        "sysDash",
        "sysDot",
        "sysDashDot",
        "sysDashDotDot",
      ];
      const s = String(value || "").trim();
      return valid.includes(s) ? (s as any) : undefined;
    },
    normalizeConnectorArrowType: (value: unknown) => {
      const valid = ["none", "triangle", "stealth", "diamond", "oval", "arrow"];
      const s = String(value || "").trim();
      return valid.includes(s) ? (s as any) : undefined;
    },
    ensureArray: (value: unknown): unknown[] => {
      if (Array.isArray(value)) return value;
      if (value === undefined || value === null) return [];
      return [value];
    },
    resolveThemeFillRef: () => {},
    resolveThemeLineRef: () => {},
    resolveThemeEffectRef: () => {},
    extractShadowStyle: () => ({}),
    extractInnerShadowStyle: () => ({}),
    extractGlowStyle: () => ({}),
    extractSoftEdgeStyle: () => ({}),
    extractReflectionStyle: () => ({}),
    extractBlurStyle: () => ({}),
    extractEffectDagStyle: () => ({}),
  });
}

describe("PptxShapeStyleExtractor", () => {
  const extractor = createExtractor();

  // ── Solid fill ───────────────────────────────────────────────────────

  describe("solid fill extraction", () => {
    it("extracts solid fill with sRGB color", () => {
      const spPr: XmlObject = {
        "a:solidFill": {
          "a:srgbClr": { "@_val": "FF6600" },
        },
      };
      const style = extractor.extractShapeStyle(spPr);
      expect(style.fillMode).toBe("solid");
      expect(style.fillColor).toBe("#FF6600");
    });

    it("extracts solid fill with opacity", () => {
      const spPr: XmlObject = {
        "a:solidFill": {
          "a:srgbClr": {
            "@_val": "0000FF",
            "a:alpha": { "@_val": "50000" },
          },
        },
      };
      const style = extractor.extractShapeStyle(spPr);
      expect(style.fillMode).toBe("solid");
      expect(style.fillColor).toBe("#0000FF");
      expect(style.fillOpacity).toBe(0.5);
    });
  });

  // ── Gradient fill ────────────────────────────────────────────────────

  describe("gradient fill extraction", () => {
    it("extracts gradient fill properties", () => {
      const spPr: XmlObject = {
        "a:gradFill": {
          "a:gsLst": {
            "a:gs": [
              { "@_pos": "0", "a:srgbClr": { "@_val": "FF0000" } },
              { "@_pos": "100000", "a:srgbClr": { "@_val": "0000FF" } },
            ],
          },
          "a:lin": { "@_ang": "5400000" },
        },
      };
      const style = extractor.extractShapeStyle(spPr);
      expect(style.fillMode).toBe("gradient");
      expect(style.fillColor).toBe("#gradient");
      expect(style.fillGradient).toBe("linear-gradient(#f00, #00f)");
      expect(style.fillGradientAngle).toBe(90);
      expect(style.fillGradientType).toBe("linear");
      expect(style.fillGradientStops).toHaveLength(2);
    });
  });

  // ── Pattern fill ─────────────────────────────────────────────────────

  describe("pattern fill extraction", () => {
    it("extracts pattern fill with foreground and background colors", () => {
      const spPr: XmlObject = {
        "a:pattFill": {
          "@_prst": "ltDnDiag",
          "a:fgClr": { "a:srgbClr": { "@_val": "FF0000" } },
          "a:bgClr": { "a:srgbClr": { "@_val": "FFFFFF" } },
        },
      };
      const style = extractor.extractShapeStyle(spPr);
      expect(style.fillMode).toBe("pattern");
      expect(style.fillColor).toBe("#FF0000");
      expect(style.fillPatternPreset).toBe("ltDnDiag");
      expect(style.fillPatternBackgroundColor).toBe("#FFFFFF");
    });

    it("falls back to background color when foreground is missing", () => {
      const spPr: XmlObject = {
        "a:pattFill": {
          "@_prst": "pct5",
          "a:bgClr": { "a:srgbClr": { "@_val": "CCCCCC" } },
        },
      };
      const style = extractor.extractShapeStyle(spPr);
      expect(style.fillMode).toBe("pattern");
      expect(style.fillColor).toBe("#CCCCCC");
    });

    it("preserves raw XML colour nodes for round-trip", () => {
      const fgNode = { "a:srgbClr": { "@_val": "FF0000" } };
      const bgNode = { "a:srgbClr": { "@_val": "00FF00" } };
      const spPr: XmlObject = {
        "a:pattFill": {
          "@_prst": "cross",
          "a:fgClr": fgNode,
          "a:bgClr": bgNode,
        },
      };
      const style = extractor.extractShapeStyle(spPr);
      expect(style.fillPatternFgClrXml).toEqual(fgNode);
      expect(style.fillPatternBgClrXml).toEqual(bgNode);
    });
  });

  // ── No fill ──────────────────────────────────────────────────────────

  describe("no fill extraction", () => {
    it("sets fillMode=none and transparent color for a:noFill", () => {
      const spPr: XmlObject = {
        "a:noFill": {},
      };
      const style = extractor.extractShapeStyle(spPr);
      expect(style.fillMode).toBe("none");
      expect(style.fillColor).toBe("transparent");
      expect(style.fillOpacity).toBe(0);
    });
  });

  // ── Image fill (blipFill) ────────────────────────────────────────────

  describe("blipFill extraction", () => {
    it("sets fillMode=image for a:blipFill", () => {
      const spPr: XmlObject = {
        "a:blipFill": {
          "a:blip": { "@_r:embed": "rId1" },
        },
      };
      const style = extractor.extractShapeStyle(spPr);
      expect(style.fillMode).toBe("image");
      expect(style.fillColor).toBe("transparent");
    });
  });

  // ── Group fill ───────────────────────────────────────────────────────

  describe("group fill", () => {
    it("sets fillMode=group for a:grpFill", () => {
      const spPr: XmlObject = {
        "a:grpFill": {},
      };
      const style = extractor.extractShapeStyle(spPr);
      expect(style.fillMode).toBe("group");
    });
  });

  // ── Line/stroke properties ───────────────────────────────────────────

  describe("line properties", () => {
    it("extracts stroke width from a:ln/@w", () => {
      const spPr: XmlObject = {
        "a:solidFill": { "a:srgbClr": { "@_val": "FFFFFF" } },
        "a:ln": {
          "@_w": String(12700), // 12700 EMU = 1pt at 96DPI
          "a:solidFill": { "a:srgbClr": { "@_val": "000000" } },
        },
      };
      const style = extractor.extractShapeStyle(spPr);
      // 12700 / 9525 ≈ 1.333
      expect(style.strokeWidth).toBeCloseTo(12700 / EMU_PER_PX, 2);
      expect(style.strokeColor).toBe("#000000");
    });

    it("extracts stroke dash type from a:prstDash", () => {
      const spPr: XmlObject = {
        "a:ln": {
          "@_w": "12700",
          "a:solidFill": { "a:srgbClr": { "@_val": "FF0000" } },
          "a:prstDash": { "@_val": "dash" },
        },
      };
      const style = extractor.extractShapeStyle(spPr);
      expect(style.strokeDash).toBe("dash");
    });

    it("extracts line join (round)", () => {
      const spPr: XmlObject = {
        "a:ln": {
          "@_w": "12700",
          "a:solidFill": { "a:srgbClr": { "@_val": "000000" } },
          "a:round": {},
        },
      };
      const style = extractor.extractShapeStyle(spPr);
      expect(style.lineJoin).toBe("round");
    });

    it("extracts line cap", () => {
      const spPr: XmlObject = {
        "a:ln": {
          "@_w": "12700",
          "@_cap": "sq",
          "a:solidFill": { "a:srgbClr": { "@_val": "000000" } },
        },
      };
      const style = extractor.extractShapeStyle(spPr);
      expect(style.lineCap).toBe("sq");
    });

    it("extracts compound line type", () => {
      const spPr: XmlObject = {
        "a:ln": {
          "@_w": "12700",
          "@_cmpd": "dbl",
          "a:solidFill": { "a:srgbClr": { "@_val": "000000" } },
        },
      };
      const style = extractor.extractShapeStyle(spPr);
      expect(style.compoundLine).toBe("dbl");
    });

    it("handles noFill line by setting strokeWidth=0", () => {
      const spPr: XmlObject = {
        "a:solidFill": { "a:srgbClr": { "@_val": "FFFFFF" } },
        "a:ln": {
          "a:noFill": {},
        },
      };
      const style = extractor.extractShapeStyle(spPr);
      expect(style.strokeWidth).toBe(0);
      expect(style.strokeColor).toBe("transparent");
    });
  });

  // ── Connector arrows ─────────────────────────────────────────────────

  describe("connector arrow properties", () => {
    it("extracts headEnd and tailEnd arrow types", () => {
      const spPr: XmlObject = {
        "a:ln": {
          "@_w": "12700",
          "a:solidFill": { "a:srgbClr": { "@_val": "000000" } },
          "a:headEnd": { "@_type": "triangle", "@_w": "med", "@_len": "lg" },
          "a:tailEnd": { "@_type": "stealth", "@_w": "lg", "@_len": "sm" },
        },
      };
      const style = extractor.extractShapeStyle(spPr);
      expect(style.connectorStartArrow).toBe("triangle");
      expect(style.connectorStartArrowWidth).toBe("med");
      expect(style.connectorStartArrowLength).toBe("lg");
      expect(style.connectorEndArrow).toBe("stealth");
      expect(style.connectorEndArrowWidth).toBe("lg");
      expect(style.connectorEndArrowLength).toBe("sm");
    });
  });

  // ── Empty spPr returns empty style ───────────────────────────────────

  describe("edge cases", () => {
    it("returns empty style object for undefined spPr", () => {
      const style = extractor.extractShapeStyle(undefined);
      expect(style).toEqual({});
    });

    it("returns empty style object for empty spPr", () => {
      const style = extractor.extractShapeStyle({});
      expect(style).toEqual({});
    });
  });

  // ── Hidden fill from extension list ──────────────────────────────────

  describe("hidden fill from extension list", () => {
    it("resolves p14:hiddenFill when main fill is a:noFill", () => {
      const spPr: XmlObject = {
        "a:noFill": {},
        "a:extLst": {
          "a:ext": {
            "@_uri": "{AF507438-7753-43E0-B8FC-AC1667EBCBE1}",
            "a14:hiddenFill": {
              "a:solidFill": {
                "a:srgbClr": { "@_val": "FF0000" },
              },
            },
          },
        },
      };
      const style = extractor.extractShapeStyle(spPr);
      expect(style.fillMode).toBe("solid");
      expect(style.fillColor).toBe("#FF0000");
    });
  });
});
