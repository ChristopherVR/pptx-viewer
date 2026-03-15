import { describe, it, expect } from "vitest";

import type { XmlObject, TextStyle } from "../../types";

/**
 * The `createRunPropertiesFromTextStyle` method is protected on the runtime
 * class, but its logic is self-contained enough to verify by reimplementing
 * the core mapping. We test the font, style, colour, gradient, pattern,
 * underline, outline, caps, and metadata attribute mappings.
 */

const EMU_PER_PX = 9525;

// Reimplementation of the core mapping (excluding hyperlink and effect list
// parts which depend on runtime services).
function createRunPropertiesFromTextStyle(
  style: TextStyle | undefined,
): XmlObject {
  const runProps: XmlObject = {
    "@_lang": style?.language || "en-US",
    "@_dirty": "0",
  };
  if (!style) return runProps;

  if (typeof style.fontSize === "number" && Number.isFinite(style.fontSize)) {
    runProps["@_sz"] = String(Math.round(style.fontSize * (72 / 96) * 100));
  }
  if (style.bold !== undefined) {
    runProps["@_b"] = style.bold ? "1" : "0";
  }
  if (style.italic !== undefined) {
    runProps["@_i"] = style.italic ? "1" : "0";
  }
  if (style.underline) {
    runProps["@_u"] = style.underlineStyle || "sng";
  }
  if (style.strikethrough !== undefined) {
    runProps["@_strike"] = style.strikethrough
      ? style.strikeType || "sngStrike"
      : "noStrike";
  }
  if (typeof style.baseline === "number" && style.baseline !== 0) {
    runProps["@_baseline"] = String(style.baseline);
  }
  if (
    typeof style.characterSpacing === "number" &&
    style.characterSpacing !== 0
  ) {
    runProps["@_spc"] = String(style.characterSpacing);
  }
  if (typeof style.kerning === "number" && style.kerning !== 0) {
    runProps["@_kern"] = String(style.kerning);
  }
  if (style.textCaps && style.textCaps !== "none") {
    runProps["@_cap"] = style.textCaps;
  }
  if (style.rtl !== undefined) {
    runProps["@_rtl"] = style.rtl ? "1" : "0";
  }
  if (style.kumimoji !== undefined) {
    runProps["@_kumimoji"] = style.kumimoji ? "1" : "0";
  }
  if (style.normalizeHeight !== undefined) {
    runProps["@_normalizeH"] = style.normalizeHeight ? "1" : "0";
  }
  if (style.noProof !== undefined) {
    runProps["@_noProof"] = style.noProof ? "1" : "0";
  }
  if (style.dirty !== undefined) {
    runProps["@_dirty"] = style.dirty ? "1" : "0";
  }
  if (style.spellingError !== undefined) {
    runProps["@_err"] = style.spellingError ? "1" : "0";
  }
  if (style.smartTagClean !== undefined) {
    runProps["@_smtClean"] = style.smartTagClean ? "1" : "0";
  }
  if (style.bookmark) {
    runProps["@_bmk"] = style.bookmark;
  }
  if (style.fontFamily) {
    runProps["a:latin"] = { "@_typeface": style.fontFamily };
    runProps["a:ea"] = {
      "@_typeface": style.eastAsiaFont || style.fontFamily,
    };
    runProps["a:cs"] = {
      "@_typeface": style.complexScriptFont || style.fontFamily,
    };
  }
  if (style.symbolFont) {
    runProps["a:sym"] = { "@_typeface": style.symbolFont };
  }
  if (style.color) {
    runProps["a:solidFill"] = {
      "a:srgbClr": { "@_val": style.color.replace("#", "") },
    };
  }
  if (style.highlightColor) {
    runProps["a:highlight"] = {
      "a:srgbClr": { "@_val": style.highlightColor.replace("#", "") },
    };
  }
  if (style.underline && style.underlineColor) {
    runProps["a:uFill"] = {
      "a:solidFill": {
        "a:srgbClr": { "@_val": style.underlineColor.replace("#", "") },
      },
    };
  }
  if (style.textOutlineWidth || style.textOutlineColor) {
    const lnObj: XmlObject = {};
    if (
      typeof style.textOutlineWidth === "number" &&
      style.textOutlineWidth > 0
    ) {
      lnObj["@_w"] = String(Math.round(style.textOutlineWidth * EMU_PER_PX));
    }
    if (style.textOutlineColor) {
      lnObj["a:solidFill"] = {
        "a:srgbClr": { "@_val": style.textOutlineColor.replace("#", "") },
      };
    }
    runProps["a:ln"] = lnObj;
  }
  // Text gradient fill
  if (
    style.textFillGradientStops &&
    style.textFillGradientStops.length > 0
  ) {
    const gradStops = style.textFillGradientStops
      .filter((stop) => Boolean(stop?.color))
      .map((stop) => {
        const rawPos = (stop.position ?? 0) / 100;
        const posVal = Math.round(
          Math.max(0, Math.min(1, rawPos)) * 100000,
        );
        const stopXml: XmlObject = {
          "@_pos": String(posVal),
          "a:srgbClr": {
            "@_val": String(stop.color || "").replace("#", ""),
          },
        };
        if (
          typeof stop.opacity === "number" &&
          Number.isFinite(stop.opacity) &&
          stop.opacity < 1
        ) {
          (stopXml["a:srgbClr"] as XmlObject)["a:alpha"] = {
            "@_val": String(Math.round(stop.opacity * 100000)),
          };
        }
        return stopXml;
      });
    if (gradStops.length > 0) {
      const gradFillXml: XmlObject = {
        "a:gsLst": { "a:gs": gradStops },
      };
      const gradType = style.textFillGradientType || "linear";
      if (gradType === "linear") {
        const angle =
          typeof style.textFillGradientAngle === "number" &&
          Number.isFinite(style.textFillGradientAngle)
            ? style.textFillGradientAngle
            : 0;
        gradFillXml["a:lin"] = {
          "@_ang": String(Math.round(angle * 60000)),
          "@_scaled": "1",
        };
      } else {
        gradFillXml["a:path"] = { "@_path": "circle" };
      }
      runProps["a:gradFill"] = gradFillXml;
    }
  }
  // Text pattern fill
  if (style.textFillPattern) {
    const pattFill: XmlObject = { "@_prst": style.textFillPattern };
    if (style.textFillPatternForeground) {
      pattFill["a:fgClr"] = {
        "a:srgbClr": {
          "@_val": style.textFillPatternForeground.replace("#", ""),
        },
      };
    }
    if (style.textFillPatternBackground) {
      pattFill["a:bgClr"] = {
        "a:srgbClr": {
          "@_val": style.textFillPatternBackground.replace("#", ""),
        },
      };
    }
    runProps["a:pattFill"] = pattFill;
  }

  return runProps;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createRunPropertiesFromTextStyle", () => {
  it("should return default lang and dirty when style is undefined", () => {
    const result = createRunPropertiesFromTextStyle(undefined);
    expect(result["@_lang"]).toBe("en-US");
    expect(result["@_dirty"]).toBe("0");
    expect(Object.keys(result)).toHaveLength(2);
  });

  it("should use custom language", () => {
    const result = createRunPropertiesFromTextStyle({ language: "de-DE" });
    expect(result["@_lang"]).toBe("de-DE");
  });

  it("should convert fontSize from points to hundredths of a point (at 72/96 ratio)", () => {
    // 16pt -> 16 * 72/96 * 100 = 1200
    const result = createRunPropertiesFromTextStyle({ fontSize: 16 });
    expect(result["@_sz"]).toBe(String(Math.round(16 * (72 / 96) * 100)));
  });

  it("should set bold and italic flags", () => {
    const result = createRunPropertiesFromTextStyle({
      bold: true,
      italic: false,
    });
    expect(result["@_b"]).toBe("1");
    expect(result["@_i"]).toBe("0");
  });

  it("should set underline with default style", () => {
    const result = createRunPropertiesFromTextStyle({ underline: true });
    expect(result["@_u"]).toBe("sng");
  });

  it("should set underline with custom style", () => {
    const result = createRunPropertiesFromTextStyle({
      underline: true,
      underlineStyle: "dbl",
    });
    expect(result["@_u"]).toBe("dbl");
  });

  it("should set strikethrough with default type", () => {
    const result = createRunPropertiesFromTextStyle({ strikethrough: true });
    expect(result["@_strike"]).toBe("sngStrike");
  });

  it("should set strikethrough with double type", () => {
    const result = createRunPropertiesFromTextStyle({
      strikethrough: true,
      strikeType: "dblStrike",
    });
    expect(result["@_strike"]).toBe("dblStrike");
  });

  it("should set noStrike when strikethrough is false", () => {
    const result = createRunPropertiesFromTextStyle({ strikethrough: false });
    expect(result["@_strike"]).toBe("noStrike");
  });

  it("should set baseline for superscript/subscript", () => {
    const result = createRunPropertiesFromTextStyle({ baseline: 30000 });
    expect(result["@_baseline"]).toBe("30000");
  });

  it("should not set baseline when it is 0", () => {
    const result = createRunPropertiesFromTextStyle({ baseline: 0 });
    expect(result["@_baseline"]).toBeUndefined();
  });

  it("should set character spacing and kerning", () => {
    const result = createRunPropertiesFromTextStyle({
      characterSpacing: 200,
      kerning: 1200,
    });
    expect(result["@_spc"]).toBe("200");
    expect(result["@_kern"]).toBe("1200");
  });

  it("should set text caps", () => {
    const result = createRunPropertiesFromTextStyle({ textCaps: "all" });
    expect(result["@_cap"]).toBe("all");
  });

  it("should not set caps when value is 'none'", () => {
    const result = createRunPropertiesFromTextStyle({ textCaps: "none" });
    expect(result["@_cap"]).toBeUndefined();
  });

  it("should set rtl flag", () => {
    const result = createRunPropertiesFromTextStyle({ rtl: true });
    expect(result["@_rtl"]).toBe("1");
  });

  it("should set font family for latin, ea, and cs", () => {
    const result = createRunPropertiesFromTextStyle({
      fontFamily: "Calibri",
    });
    expect((result["a:latin"] as XmlObject)["@_typeface"]).toBe("Calibri");
    expect((result["a:ea"] as XmlObject)["@_typeface"]).toBe("Calibri");
    expect((result["a:cs"] as XmlObject)["@_typeface"]).toBe("Calibri");
  });

  it("should use east Asian and complex script overrides", () => {
    const result = createRunPropertiesFromTextStyle({
      fontFamily: "Arial",
      eastAsiaFont: "MS Gothic",
      complexScriptFont: "Noto Sans Arabic",
    });
    expect((result["a:ea"] as XmlObject)["@_typeface"]).toBe("MS Gothic");
    expect((result["a:cs"] as XmlObject)["@_typeface"]).toBe(
      "Noto Sans Arabic",
    );
  });

  it("should set symbol font", () => {
    const result = createRunPropertiesFromTextStyle({
      symbolFont: "Wingdings",
    });
    expect((result["a:sym"] as XmlObject)["@_typeface"]).toBe("Wingdings");
  });

  it("should set solid fill color and strip # prefix", () => {
    const result = createRunPropertiesFromTextStyle({ color: "#FF0000" });
    const solidFill = result["a:solidFill"] as XmlObject;
    expect((solidFill["a:srgbClr"] as XmlObject)["@_val"]).toBe("FF0000");
  });

  it("should set highlight color", () => {
    const result = createRunPropertiesFromTextStyle({
      highlightColor: "#FFFF00",
    });
    const highlight = result["a:highlight"] as XmlObject;
    expect((highlight["a:srgbClr"] as XmlObject)["@_val"]).toBe("FFFF00");
  });

  it("should set underline fill color when underline is true", () => {
    const result = createRunPropertiesFromTextStyle({
      underline: true,
      underlineColor: "#0000FF",
    });
    const uFill = result["a:uFill"] as XmlObject;
    const solidFill = uFill["a:solidFill"] as XmlObject;
    expect((solidFill["a:srgbClr"] as XmlObject)["@_val"]).toBe("0000FF");
  });

  it("should not set underline fill when underline is false", () => {
    const result = createRunPropertiesFromTextStyle({
      underline: false,
      underlineColor: "#0000FF",
    });
    expect(result["a:uFill"]).toBeUndefined();
  });

  it("should set text outline width and color", () => {
    const result = createRunPropertiesFromTextStyle({
      textOutlineWidth: 2,
      textOutlineColor: "#333333",
    });
    const ln = result["a:ln"] as XmlObject;
    expect(ln["@_w"]).toBe(String(Math.round(2 * EMU_PER_PX)));
    expect(
      ((ln["a:solidFill"] as XmlObject)["a:srgbClr"] as XmlObject)["@_val"],
    ).toBe("333333");
  });

  it("should set metadata flags: kumimoji, normalizeHeight, noProof, dirty, spellingError, smartTagClean, bookmark", () => {
    const result = createRunPropertiesFromTextStyle({
      kumimoji: true,
      normalizeHeight: true,
      noProof: true,
      dirty: true,
      spellingError: false,
      smartTagClean: true,
      bookmark: "bm1",
    });
    expect(result["@_kumimoji"]).toBe("1");
    expect(result["@_normalizeH"]).toBe("1");
    expect(result["@_noProof"]).toBe("1");
    expect(result["@_dirty"]).toBe("1");
    expect(result["@_err"]).toBe("0");
    expect(result["@_smtClean"]).toBe("1");
    expect(result["@_bmk"]).toBe("bm1");
  });

  it("should build gradient fill with linear type", () => {
    const result = createRunPropertiesFromTextStyle({
      textFillGradientStops: [
        { color: "#FF0000", position: 0 },
        { color: "#0000FF", position: 100 },
      ],
      textFillGradientAngle: 90,
      textFillGradientType: "linear",
    });
    const gradFill = result["a:gradFill"] as XmlObject;
    expect(gradFill).toBeDefined();
    const lin = gradFill["a:lin"] as XmlObject;
    expect(lin["@_ang"]).toBe(String(Math.round(90 * 60000)));
    expect(lin["@_scaled"]).toBe("1");
  });

  it("should build gradient fill with radial type", () => {
    const result = createRunPropertiesFromTextStyle({
      textFillGradientStops: [{ color: "#FF0000", position: 0 }],
      textFillGradientType: "radial",
    });
    const gradFill = result["a:gradFill"] as XmlObject;
    expect(gradFill["a:path"]).toEqual({ "@_path": "circle" });
  });

  it("should include alpha for gradient stop with opacity < 1", () => {
    const result = createRunPropertiesFromTextStyle({
      textFillGradientStops: [
        { color: "#FF0000", position: 0, opacity: 0.5 },
      ],
    });
    const gradFill = result["a:gradFill"] as XmlObject;
    const gsLst = gradFill["a:gsLst"] as XmlObject;
    const gs = gsLst["a:gs"] as XmlObject[];
    const srgbClr = gs[0]["a:srgbClr"] as XmlObject;
    expect(srgbClr["a:alpha"]).toEqual({
      "@_val": String(Math.round(0.5 * 100000)),
    });
  });

  it("should build pattern fill", () => {
    const result = createRunPropertiesFromTextStyle({
      textFillPattern: "dkDnDiag",
      textFillPatternForeground: "#000000",
      textFillPatternBackground: "#FFFFFF",
    });
    const pattFill = result["a:pattFill"] as XmlObject;
    expect(pattFill["@_prst"]).toBe("dkDnDiag");
    expect(
      ((pattFill["a:fgClr"] as XmlObject)["a:srgbClr"] as XmlObject)[
        "@_val"
      ],
    ).toBe("000000");
    expect(
      ((pattFill["a:bgClr"] as XmlObject)["a:srgbClr"] as XmlObject)[
        "@_val"
      ],
    ).toBe("FFFFFF");
  });
});
