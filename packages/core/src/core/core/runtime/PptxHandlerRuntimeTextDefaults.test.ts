import { describe, it, expect } from "vitest";
import type { TextStyle, PlaceholderDefaults, PlaceholderTextLevelStyle } from "../../types";

// Since these are protected methods on a deeply chained mixin, we extract
// their logic and test them directly.

// --- Extracted from pointsToPixels ---
function pointsToPixels(points: number): number {
  return points * (96 / 72);
}

// --- Extracted from parseParagraphSpacingPx ---
function parseParagraphSpacingPx(
  spacingNode: Record<string, unknown> | undefined,
): number | undefined {
  if (!spacingNode) return undefined;
  const spacingPointsRaw = Number.parseInt(
    String(
      (spacingNode["a:spcPts"] as Record<string, unknown> | undefined)?.["@_val"] || "",
    ),
    10,
  );
  if (Number.isFinite(spacingPointsRaw)) {
    return pointsToPixels(spacingPointsRaw / 100);
  }
  return undefined;
}

// --- Extracted from parseLineSpacingMultiplier ---
function parseLineSpacingMultiplier(
  lineSpacingNode: Record<string, unknown> | undefined,
): number | undefined {
  if (!lineSpacingNode) return undefined;
  const spacingPercentRaw = Number.parseInt(
    String(
      (lineSpacingNode["a:spcPct"] as Record<string, unknown> | undefined)?.["@_val"] || "",
    ),
    10,
  );
  if (Number.isFinite(spacingPercentRaw)) {
    return Math.max(0.1, Math.min(5, spacingPercentRaw / 100000));
  }
  return undefined;
}

// --- Extracted from parseLineSpacingExactPt ---
function parseLineSpacingExactPt(
  lineSpacingNode: Record<string, unknown> | undefined,
): number | undefined {
  if (!lineSpacingNode) return undefined;
  const spcPtsRaw = Number.parseInt(
    String(
      (lineSpacingNode["a:spcPts"] as Record<string, unknown> | undefined)?.["@_val"] || "",
    ),
    10,
  );
  if (Number.isFinite(spcPtsRaw) && spcPtsRaw > 0) {
    return spcPtsRaw / 100;
  }
  return undefined;
}

// --- Extracted from textVerticalAlignFromDrawingValue (used for vAlign fallback) ---
function textVerticalAlignFromDrawingValue(
  value: unknown,
): TextStyle["vAlign"] | undefined {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized.length === 0) return undefined;
  if (normalized === "t" || normalized === "top") return "top";
  if (normalized === "ctr" || normalized === "center") return "middle";
  if (normalized === "b" || normalized === "bottom") return "bottom";
  if (normalized === "dist" || normalized === "just") return "middle";
  return undefined;
}

// --- Extracted from applyPlaceholderBodyDefaults ---
function applyPlaceholderBodyDefaults(
  textStyle: TextStyle,
  defaults: PlaceholderDefaults,
): void {
  if (textStyle.bodyInsetLeft === undefined && defaults.bodyInsetLeft !== undefined) {
    textStyle.bodyInsetLeft = defaults.bodyInsetLeft;
  }
  if (textStyle.bodyInsetTop === undefined && defaults.bodyInsetTop !== undefined) {
    textStyle.bodyInsetTop = defaults.bodyInsetTop;
  }
  if (textStyle.bodyInsetRight === undefined && defaults.bodyInsetRight !== undefined) {
    textStyle.bodyInsetRight = defaults.bodyInsetRight;
  }
  if (textStyle.bodyInsetBottom === undefined && defaults.bodyInsetBottom !== undefined) {
    textStyle.bodyInsetBottom = defaults.bodyInsetBottom;
  }
  if (textStyle.vAlign === undefined && defaults.textAnchor) {
    const vAlign = textVerticalAlignFromDrawingValue(defaults.textAnchor);
    if (vAlign) textStyle.vAlign = vAlign;
  }
  if (textStyle.autoFit === undefined && defaults.autoFit !== undefined) {
    textStyle.autoFit = defaults.autoFit;
  }
  if (textStyle.textWrap === undefined && defaults.textWrap) {
    textStyle.textWrap = defaults.textWrap as TextStyle["textWrap"];
  }
}

// --- Extracted from applyPlaceholderLevelDefaults ---
function applyPlaceholderLevelDefaults(
  textStyle: TextStyle,
  levelStyle: PlaceholderTextLevelStyle,
): void {
  if (textStyle.fontFamily === undefined && levelStyle.fontFamily !== undefined) {
    textStyle.fontFamily = levelStyle.fontFamily;
  }
  if (textStyle.fontSize === undefined && levelStyle.fontSize !== undefined) {
    textStyle.fontSize = levelStyle.fontSize;
  }
  if (textStyle.bold === undefined && levelStyle.bold !== undefined) {
    textStyle.bold = levelStyle.bold;
  }
  if (textStyle.italic === undefined && levelStyle.italic !== undefined) {
    textStyle.italic = levelStyle.italic;
  }
  if (textStyle.color === undefined && levelStyle.color !== undefined) {
    textStyle.color = levelStyle.color;
  }
  if (textStyle.paragraphMarginLeft === undefined && levelStyle.marginLeft !== undefined) {
    textStyle.paragraphMarginLeft = levelStyle.marginLeft;
  }
  if (textStyle.paragraphIndent === undefined && levelStyle.indent !== undefined) {
    textStyle.paragraphIndent = levelStyle.indent;
  }
  if (textStyle.lineSpacing === undefined && textStyle.lineSpacingExactPt === undefined) {
    if (levelStyle.lineSpacing !== undefined) {
      textStyle.lineSpacing = levelStyle.lineSpacing;
    } else if (levelStyle.lineSpacingExactPt !== undefined) {
      textStyle.lineSpacingExactPt = levelStyle.lineSpacingExactPt;
    }
  }
  if (textStyle.paragraphSpacingBefore === undefined && levelStyle.spaceBefore !== undefined) {
    textStyle.paragraphSpacingBefore = levelStyle.spaceBefore;
  }
  if (textStyle.paragraphSpacingAfter === undefined && levelStyle.spaceAfter !== undefined) {
    textStyle.paragraphSpacingAfter = levelStyle.spaceAfter;
  }
  if (textStyle.align === undefined && levelStyle.alignment !== undefined) {
    textStyle.align = levelStyle.alignment as TextStyle["align"];
  }
}

// ---------------------------------------------------------------------------
// pointsToPixels
// ---------------------------------------------------------------------------
describe("pointsToPixels", () => {
  it("should convert 0 points to 0 pixels", () => {
    expect(pointsToPixels(0)).toBe(0);
  });

  it("should convert 72 points to 96 pixels (1 inch)", () => {
    expect(pointsToPixels(72)).toBe(96);
  });

  it("should convert 36 points to 48 pixels", () => {
    expect(pointsToPixels(36)).toBe(48);
  });

  it("should convert 12 points to 16 pixels", () => {
    expect(pointsToPixels(12)).toBe(16);
  });

  it("should handle fractional points", () => {
    expect(pointsToPixels(10.5)).toBeCloseTo(14, 0);
  });
});

// ---------------------------------------------------------------------------
// parseParagraphSpacingPx
// ---------------------------------------------------------------------------
describe("parseParagraphSpacingPx", () => {
  it("should return undefined for undefined input", () => {
    expect(parseParagraphSpacingPx(undefined)).toBeUndefined();
  });

  it("should return undefined when a:spcPts is missing", () => {
    expect(parseParagraphSpacingPx({})).toBeUndefined();
  });

  it("should return undefined when val is missing", () => {
    expect(parseParagraphSpacingPx({ "a:spcPts": {} })).toBeUndefined();
  });

  it("should parse spacing in hundredths of a point and convert to pixels", () => {
    // 1200 = 12pt -> 16px
    const result = parseParagraphSpacingPx({ "a:spcPts": { "@_val": "1200" } });
    expect(result).toBe(pointsToPixels(12));
  });

  it("should parse zero spacing", () => {
    const result = parseParagraphSpacingPx({ "a:spcPts": { "@_val": "0" } });
    expect(result).toBe(0);
  });

  it("should parse small spacing values", () => {
    // 600 = 6pt
    const result = parseParagraphSpacingPx({ "a:spcPts": { "@_val": "600" } });
    expect(result).toBe(pointsToPixels(6));
  });
});

// ---------------------------------------------------------------------------
// parseLineSpacingMultiplier
// ---------------------------------------------------------------------------
describe("parseLineSpacingMultiplier", () => {
  it("should return undefined for undefined input", () => {
    expect(parseLineSpacingMultiplier(undefined)).toBeUndefined();
  });

  it("should return undefined when a:spcPct is missing", () => {
    expect(parseLineSpacingMultiplier({})).toBeUndefined();
  });

  it("should parse 100% line spacing (100000 = 1.0)", () => {
    const result = parseLineSpacingMultiplier({
      "a:spcPct": { "@_val": "100000" },
    });
    expect(result).toBe(1.0);
  });

  it("should parse 150% line spacing", () => {
    const result = parseLineSpacingMultiplier({
      "a:spcPct": { "@_val": "150000" },
    });
    expect(result).toBe(1.5);
  });

  it("should parse 200% line spacing", () => {
    const result = parseLineSpacingMultiplier({
      "a:spcPct": { "@_val": "200000" },
    });
    expect(result).toBe(2.0);
  });

  it("should clamp to minimum of 0.1", () => {
    const result = parseLineSpacingMultiplier({
      "a:spcPct": { "@_val": "1000" },
    });
    expect(result).toBe(0.1);
  });

  it("should clamp to maximum of 5", () => {
    const result = parseLineSpacingMultiplier({
      "a:spcPct": { "@_val": "1000000" },
    });
    expect(result).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// parseLineSpacingExactPt
// ---------------------------------------------------------------------------
describe("parseLineSpacingExactPt", () => {
  it("should return undefined for undefined input", () => {
    expect(parseLineSpacingExactPt(undefined)).toBeUndefined();
  });

  it("should return undefined when a:spcPts is missing", () => {
    expect(parseLineSpacingExactPt({})).toBeUndefined();
  });

  it("should parse exact line spacing (1200 = 12pt)", () => {
    const result = parseLineSpacingExactPt({
      "a:spcPts": { "@_val": "1200" },
    });
    expect(result).toBe(12);
  });

  it("should parse small spacing (600 = 6pt)", () => {
    const result = parseLineSpacingExactPt({
      "a:spcPts": { "@_val": "600" },
    });
    expect(result).toBe(6);
  });

  it("should return undefined for zero value", () => {
    const result = parseLineSpacingExactPt({
      "a:spcPts": { "@_val": "0" },
    });
    expect(result).toBeUndefined();
  });

  it("should return undefined for negative value", () => {
    const result = parseLineSpacingExactPt({
      "a:spcPts": { "@_val": "-100" },
    });
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// applyPlaceholderBodyDefaults
// ---------------------------------------------------------------------------
describe("applyPlaceholderBodyDefaults", () => {
  it("should apply body insets as fallback", () => {
    const textStyle: TextStyle = {};
    const defaults: PlaceholderDefaults = {
      bodyInsetLeft: 10,
      bodyInsetTop: 5,
      bodyInsetRight: 10,
      bodyInsetBottom: 5,
    };
    applyPlaceholderBodyDefaults(textStyle, defaults);
    expect(textStyle.bodyInsetLeft).toBe(10);
    expect(textStyle.bodyInsetTop).toBe(5);
    expect(textStyle.bodyInsetRight).toBe(10);
    expect(textStyle.bodyInsetBottom).toBe(5);
  });

  it("should not overwrite existing body insets", () => {
    const textStyle: TextStyle = { bodyInsetLeft: 20 };
    const defaults: PlaceholderDefaults = { bodyInsetLeft: 10 };
    applyPlaceholderBodyDefaults(textStyle, defaults);
    expect(textStyle.bodyInsetLeft).toBe(20);
  });

  it("should apply vAlign from textAnchor", () => {
    const textStyle: TextStyle = {};
    const defaults: PlaceholderDefaults = { textAnchor: "ctr" };
    applyPlaceholderBodyDefaults(textStyle, defaults);
    expect(textStyle.vAlign).toBe("middle");
  });

  it("should not overwrite existing vAlign", () => {
    const textStyle: TextStyle = { vAlign: "top" };
    const defaults: PlaceholderDefaults = { textAnchor: "b" };
    applyPlaceholderBodyDefaults(textStyle, defaults);
    expect(textStyle.vAlign).toBe("top");
  });

  it("should apply autoFit as fallback", () => {
    const textStyle: TextStyle = {};
    const defaults: PlaceholderDefaults = { autoFit: true };
    applyPlaceholderBodyDefaults(textStyle, defaults);
    expect(textStyle.autoFit).toBe(true);
  });

  it("should not overwrite existing autoFit", () => {
    const textStyle: TextStyle = { autoFit: false };
    const defaults: PlaceholderDefaults = { autoFit: true };
    applyPlaceholderBodyDefaults(textStyle, defaults);
    expect(textStyle.autoFit).toBe(false);
  });

  it("should apply textWrap as fallback", () => {
    const textStyle: TextStyle = {};
    const defaults: PlaceholderDefaults = { textWrap: "none" };
    applyPlaceholderBodyDefaults(textStyle, defaults);
    expect(textStyle.textWrap).toBe("none");
  });

  it("should handle empty defaults gracefully", () => {
    const textStyle: TextStyle = {};
    applyPlaceholderBodyDefaults(textStyle, {});
    expect(textStyle).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// applyPlaceholderLevelDefaults
// ---------------------------------------------------------------------------
describe("applyPlaceholderLevelDefaults", () => {
  it("should apply fontFamily as fallback", () => {
    const textStyle: TextStyle = {};
    applyPlaceholderLevelDefaults(textStyle, { fontFamily: "Arial" });
    expect(textStyle.fontFamily).toBe("Arial");
  });

  it("should not overwrite existing fontFamily", () => {
    const textStyle: TextStyle = { fontFamily: "Calibri" };
    applyPlaceholderLevelDefaults(textStyle, { fontFamily: "Arial" });
    expect(textStyle.fontFamily).toBe("Calibri");
  });

  it("should apply fontSize as fallback", () => {
    const textStyle: TextStyle = {};
    applyPlaceholderLevelDefaults(textStyle, { fontSize: 24 });
    expect(textStyle.fontSize).toBe(24);
  });

  it("should apply bold and italic as fallback", () => {
    const textStyle: TextStyle = {};
    applyPlaceholderLevelDefaults(textStyle, { bold: true, italic: true });
    expect(textStyle.bold).toBe(true);
    expect(textStyle.italic).toBe(true);
  });

  it("should apply color as fallback", () => {
    const textStyle: TextStyle = {};
    applyPlaceholderLevelDefaults(textStyle, { color: "#FF0000" });
    expect(textStyle.color).toBe("#FF0000");
  });

  it("should apply paragraph margin and indent", () => {
    const textStyle: TextStyle = {};
    applyPlaceholderLevelDefaults(textStyle, {
      marginLeft: 36,
      indent: -18,
    });
    expect(textStyle.paragraphMarginLeft).toBe(36);
    expect(textStyle.paragraphIndent).toBe(-18);
  });

  it("should apply lineSpacing as fallback", () => {
    const textStyle: TextStyle = {};
    applyPlaceholderLevelDefaults(textStyle, { lineSpacing: 1.5 });
    expect(textStyle.lineSpacing).toBe(1.5);
  });

  it("should apply lineSpacingExactPt when lineSpacing is not set", () => {
    const textStyle: TextStyle = {};
    applyPlaceholderLevelDefaults(textStyle, { lineSpacingExactPt: 14 });
    expect(textStyle.lineSpacingExactPt).toBe(14);
  });

  it("should not apply lineSpacing if lineSpacing already set", () => {
    const textStyle: TextStyle = { lineSpacing: 1.2 };
    applyPlaceholderLevelDefaults(textStyle, { lineSpacing: 1.5 });
    expect(textStyle.lineSpacing).toBe(1.2);
  });

  it("should not apply lineSpacingExactPt if lineSpacing already set", () => {
    const textStyle: TextStyle = { lineSpacing: 1.2 };
    applyPlaceholderLevelDefaults(textStyle, { lineSpacingExactPt: 14 });
    expect(textStyle.lineSpacingExactPt).toBeUndefined();
  });

  it("should apply spaceBefore and spaceAfter", () => {
    const textStyle: TextStyle = {};
    applyPlaceholderLevelDefaults(textStyle, {
      spaceBefore: 8,
      spaceAfter: 4,
    });
    expect(textStyle.paragraphSpacingBefore).toBe(8);
    expect(textStyle.paragraphSpacingAfter).toBe(4);
  });

  it("should apply alignment as fallback", () => {
    const textStyle: TextStyle = {};
    applyPlaceholderLevelDefaults(textStyle, { alignment: "center" });
    expect(textStyle.align).toBe("center");
  });

  it("should handle empty level style gracefully", () => {
    const textStyle: TextStyle = {};
    applyPlaceholderLevelDefaults(textStyle, {});
    expect(textStyle).toEqual({});
  });
});
