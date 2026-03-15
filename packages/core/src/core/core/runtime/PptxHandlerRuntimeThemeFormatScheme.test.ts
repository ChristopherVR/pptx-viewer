import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Extracted logic from PptxHandlerRuntimeThemeFormatScheme.parseEffectStyleList
// Tests the XML → PptxThemeEffectStyle parsing for all effect types including
// shadow, inner shadow, glow, soft edge, and reflection.
// ---------------------------------------------------------------------------

const EMU_PER_PX = 9525;

interface XmlObject {
  [key: string]: unknown;
}

interface EffectStyle {
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  innerShadowColor?: string;
  innerShadowOpacity?: number;
  innerShadowBlur?: number;
  innerShadowOffsetX?: number;
  innerShadowOffsetY?: number;
  glowColor?: string;
  glowRadius?: number;
  glowOpacity?: number;
  softEdgeRadius?: number;
  reflectionBlurRadius?: number;
  reflectionStartOpacity?: number;
  reflectionEndOpacity?: number;
  reflectionEndPosition?: number;
  reflectionDirection?: number;
  reflectionRotation?: number;
  reflectionDistance?: number;
  rawNode?: unknown;
}

/**
 * Simplified color parser — extracts srgbClr val from an XML node.
 */
function parseColor(node: XmlObject | undefined): string | undefined {
  if (!node) return undefined;
  const srgb = node["a:srgbClr"] as XmlObject | undefined;
  if (srgb) return `#${srgb["@_val"]}`;
  return undefined;
}

/**
 * Simplified opacity extractor — reads alpha child from srgbClr.
 */
function extractColorOpacity(node: XmlObject | undefined): number | undefined {
  if (!node) return undefined;
  const srgb = node["a:srgbClr"] as XmlObject | undefined;
  if (!srgb) return undefined;
  const alpha = srgb["a:alpha"] as XmlObject | undefined;
  if (!alpha) return undefined;
  const val = parseInt(String(alpha["@_val"] || ""), 10);
  if (!Number.isFinite(val)) return undefined;
  return val / 100000;
}

function ensureArray(val: unknown): unknown[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

/**
 * Extracted and simplified from parseEffectStyleList — mirrors the runtime
 * implementation but uses the simplified color parser above.
 */
function parseEffectStyleList(
  listNode: XmlObject | undefined,
): EffectStyle[] {
  if (!listNode) return [];
  const styleNodes = ensureArray(listNode["a:effectStyle"]);
  return styleNodes.map((esRaw) => {
    const es = esRaw as XmlObject;
    const effectLst = (es["a:effectLst"] ?? es["a:effectDag"]) as
      | XmlObject
      | undefined;
    const result: EffectStyle = { rawNode: es };

    if (!effectLst) return result;

    // Outer shadow (a:outerShdw)
    const outerShdw = effectLst["a:outerShdw"] as XmlObject | undefined;
    if (outerShdw) {
      result.shadowColor = parseColor(outerShdw);
      result.shadowOpacity = extractColorOpacity(outerShdw);
      const blurRad = parseInt(String(outerShdw["@_blurRad"] || "0"));
      if (Number.isFinite(blurRad) && blurRad > 0) {
        result.shadowBlur = blurRad / EMU_PER_PX;
      }
      const dist = parseInt(String(outerShdw["@_dist"] || "0"));
      const dir = parseInt(String(outerShdw["@_dir"] || "0"));
      if (Number.isFinite(dist) && dist > 0 && Number.isFinite(dir)) {
        const angleRad = (dir / 60000) * (Math.PI / 180);
        result.shadowOffsetX = (Math.cos(angleRad) * dist) / EMU_PER_PX;
        result.shadowOffsetY = (Math.sin(angleRad) * dist) / EMU_PER_PX;
      }
    }

    // Inner shadow (a:innerShdw)
    const innerShdw = effectLst["a:innerShdw"] as XmlObject | undefined;
    if (innerShdw) {
      result.innerShadowColor = parseColor(innerShdw);
      result.innerShadowOpacity = extractColorOpacity(innerShdw);
      const blurRad = parseInt(String(innerShdw["@_blurRad"] || "0"));
      if (Number.isFinite(blurRad) && blurRad > 0) {
        result.innerShadowBlur = blurRad / EMU_PER_PX;
      }
      const dist = parseInt(String(innerShdw["@_dist"] || "0"));
      const dir = parseInt(String(innerShdw["@_dir"] || "0"));
      if (Number.isFinite(dist) && dist > 0 && Number.isFinite(dir)) {
        const angleRad = (dir / 60000) * (Math.PI / 180);
        result.innerShadowOffsetX = (Math.cos(angleRad) * dist) / EMU_PER_PX;
        result.innerShadowOffsetY = (Math.sin(angleRad) * dist) / EMU_PER_PX;
      }
    }

    // Glow (a:glow)
    const glow = effectLst["a:glow"] as XmlObject | undefined;
    if (glow) {
      result.glowColor = parseColor(glow);
      result.glowOpacity = extractColorOpacity(glow);
      const glowRad = parseInt(String(glow["@_rad"] || "0"));
      if (Number.isFinite(glowRad) && glowRad > 0) {
        result.glowRadius = glowRad / EMU_PER_PX;
      }
    }

    // Soft edge (a:softEdge)
    const softEdge = effectLst["a:softEdge"] as XmlObject | undefined;
    if (softEdge) {
      const rad = parseInt(String(softEdge["@_rad"] || "0"));
      if (Number.isFinite(rad) && rad > 0) {
        result.softEdgeRadius = rad / EMU_PER_PX;
      }
    }

    // Reflection (a:reflection)
    const reflection = effectLst["a:reflection"] as XmlObject | undefined;
    if (reflection) {
      const blurRad = parseInt(String(reflection["@_blurRad"] || "0"));
      if (Number.isFinite(blurRad) && blurRad >= 0) {
        result.reflectionBlurRadius = blurRad / EMU_PER_PX;
      }
      const stA = parseInt(String(reflection["@_stA"] || ""));
      if (Number.isFinite(stA)) {
        result.reflectionStartOpacity = stA / 100000;
      }
      const endA = parseInt(String(reflection["@_endA"] || ""));
      if (Number.isFinite(endA)) {
        result.reflectionEndOpacity = endA / 100000;
      }
      const endPos = parseInt(String(reflection["@_endPos"] || ""));
      if (Number.isFinite(endPos)) {
        result.reflectionEndPosition = endPos / 100000;
      }
      const dirVal = parseInt(String(reflection["@_dir"] || ""));
      if (Number.isFinite(dirVal)) {
        result.reflectionDirection = dirVal / 60000;
      }
      const rot = parseInt(String(reflection["@_rot"] || ""));
      if (Number.isFinite(rot)) {
        result.reflectionRotation = rot / 60000;
      }
      const dist = parseInt(String(reflection["@_dist"] || "0"));
      if (Number.isFinite(dist) && dist >= 0) {
        result.reflectionDistance = dist / EMU_PER_PX;
      }
    }

    return result;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseEffectStyleList", () => {
  it("should return empty array for undefined input", () => {
    expect(parseEffectStyleList(undefined)).toEqual([]);
  });

  it("should return empty-ish style when effectStyle has no effectLst", () => {
    const listNode: XmlObject = {
      "a:effectStyle": { /* no a:effectLst */ },
    };
    const result = parseEffectStyleList(listNode);
    expect(result).toHaveLength(1);
    expect(result[0].shadowColor).toBeUndefined();
    expect(result[0].rawNode).toBeDefined();
  });

  it("should parse outer shadow from effectLst", () => {
    const listNode: XmlObject = {
      "a:effectStyle": {
        "a:effectLst": {
          "a:outerShdw": {
            "@_blurRad": "57150", // 57150 / 9525 = 6
            "@_dist": "19050",    // 19050 / 9525 = 2
            "@_dir": "5400000",   // 5400000 / 60000 = 90 degrees
            "a:srgbClr": {
              "@_val": "000000",
              "a:alpha": { "@_val": "63000" },
            },
          },
        },
      },
    };

    const result = parseEffectStyleList(listNode);
    expect(result).toHaveLength(1);
    const style = result[0];
    expect(style.shadowColor).toBe("#000000");
    expect(style.shadowOpacity).toBeCloseTo(0.63, 5);
    expect(style.shadowBlur).toBeCloseTo(6, 1);
    // dir=90 degrees → cos(90)~=0, sin(90)~=1, so offsetX~0, offsetY~2
    expect(style.shadowOffsetX).toBeCloseTo(0, 0);
    expect(style.shadowOffsetY).toBeCloseTo(2, 1);
  });

  it("should parse inner shadow from effectLst", () => {
    const listNode: XmlObject = {
      "a:effectStyle": {
        "a:effectLst": {
          "a:innerShdw": {
            "@_blurRad": "19050",   // 2px
            "@_dist": "9525",       // 1px
            "@_dir": "0",           // 0 degrees → offsetX=1, offsetY=0
            "a:srgbClr": {
              "@_val": "FF0000",
              "a:alpha": { "@_val": "50000" },
            },
          },
        },
      },
    };

    const result = parseEffectStyleList(listNode);
    expect(result).toHaveLength(1);
    const style = result[0];
    expect(style.innerShadowColor).toBe("#FF0000");
    expect(style.innerShadowOpacity).toBeCloseTo(0.5, 5);
    expect(style.innerShadowBlur).toBeCloseTo(2, 1);
    expect(style.innerShadowOffsetX).toBeCloseTo(1, 1);
    expect(style.innerShadowOffsetY).toBeCloseTo(0, 0);
  });

  it("should parse glow from effectLst", () => {
    const listNode: XmlObject = {
      "a:effectStyle": {
        "a:effectLst": {
          "a:glow": {
            "@_rad": "47625", // 47625 / 9525 = 5
            "a:srgbClr": {
              "@_val": "FFFF00",
              "a:alpha": { "@_val": "80000" },
            },
          },
        },
      },
    };

    const result = parseEffectStyleList(listNode);
    expect(result).toHaveLength(1);
    const style = result[0];
    expect(style.glowColor).toBe("#FFFF00");
    expect(style.glowOpacity).toBeCloseTo(0.8, 5);
    expect(style.glowRadius).toBeCloseTo(5, 1);
  });

  it("should parse soft edge from effectLst", () => {
    const listNode: XmlObject = {
      "a:effectStyle": {
        "a:effectLst": {
          "a:softEdge": {
            "@_rad": "28575", // 28575 / 9525 = 3
          },
        },
      },
    };

    const result = parseEffectStyleList(listNode);
    expect(result).toHaveLength(1);
    expect(result[0].softEdgeRadius).toBeCloseTo(3, 1);
  });

  it("should parse reflection from effectLst", () => {
    const listNode: XmlObject = {
      "a:effectStyle": {
        "a:effectLst": {
          "a:reflection": {
            "@_blurRad": "6350",     // 6350 / 9525 ~= 0.667
            "@_stA": "52000",        // 52000 / 100000 = 0.52
            "@_endA": "300",         // 300 / 100000 = 0.003
            "@_endPos": "65000",     // 65000 / 100000 = 0.65
            "@_dir": "5400000",      // 5400000 / 60000 = 90
            "@_rot": "0",            // 0 / 60000 = 0
            "@_dist": "9525",        // 9525 / 9525 = 1
          },
        },
      },
    };

    const result = parseEffectStyleList(listNode);
    expect(result).toHaveLength(1);
    const style = result[0];
    expect(style.reflectionBlurRadius).toBeCloseTo(0.667, 2);
    expect(style.reflectionStartOpacity).toBeCloseTo(0.52, 5);
    expect(style.reflectionEndOpacity).toBeCloseTo(0.003, 5);
    expect(style.reflectionEndPosition).toBeCloseTo(0.65, 5);
    expect(style.reflectionDirection).toBeCloseTo(90, 1);
    expect(style.reflectionRotation).toBeCloseTo(0, 1);
    expect(style.reflectionDistance).toBeCloseTo(1, 1);
  });

  it("should handle reflection with only partial attributes", () => {
    const listNode: XmlObject = {
      "a:effectStyle": {
        "a:effectLst": {
          "a:reflection": {
            "@_blurRad": "0",
            "@_stA": "100000",
          },
        },
      },
    };

    const result = parseEffectStyleList(listNode);
    expect(result).toHaveLength(1);
    const style = result[0];
    expect(style.reflectionBlurRadius).toBe(0);
    expect(style.reflectionStartOpacity).toBe(1);
    expect(style.reflectionEndOpacity).toBeUndefined();
    expect(style.reflectionEndPosition).toBeUndefined();
    expect(style.reflectionDirection).toBeUndefined();
    expect(style.reflectionRotation).toBeUndefined();
    expect(style.reflectionDistance).toBe(0);
  });

  it("should parse multiple effect styles from array", () => {
    const listNode: XmlObject = {
      "a:effectStyle": [
        { "a:effectLst": {} },
        {
          "a:effectLst": {
            "a:outerShdw": {
              "@_blurRad": "9525",
              "a:srgbClr": { "@_val": "111111" },
            },
          },
        },
        {
          "a:effectLst": {
            "a:reflection": {
              "@_blurRad": "19050",
              "@_stA": "50000",
              "@_endA": "0",
            },
          },
        },
      ],
    };

    const result = parseEffectStyleList(listNode);
    expect(result).toHaveLength(3);

    // First: empty
    expect(result[0].shadowColor).toBeUndefined();
    expect(result[0].reflectionBlurRadius).toBeUndefined();

    // Second: shadow only
    expect(result[1].shadowColor).toBe("#111111");
    expect(result[1].shadowBlur).toBeCloseTo(1, 1);

    // Third: reflection only
    expect(result[2].reflectionBlurRadius).toBeCloseTo(2, 1);
    expect(result[2].reflectionStartOpacity).toBe(0.5);
    expect(result[2].reflectionEndOpacity).toBe(0);
  });

  it("should parse combined shadow + reflection in same effect style", () => {
    const listNode: XmlObject = {
      "a:effectStyle": {
        "a:effectLst": {
          "a:outerShdw": {
            "@_blurRad": "57150",
            "@_dist": "19050",
            "@_dir": "5400000",
            "a:srgbClr": {
              "@_val": "000000",
              "a:alpha": { "@_val": "63000" },
            },
          },
          "a:reflection": {
            "@_blurRad": "6350",
            "@_stA": "52000",
            "@_endA": "300",
            "@_endPos": "65000",
            "@_dir": "5400000",
          },
        },
      },
    };

    const result = parseEffectStyleList(listNode);
    expect(result).toHaveLength(1);
    const style = result[0];

    // Shadow should be parsed
    expect(style.shadowColor).toBe("#000000");
    expect(style.shadowBlur).toBeCloseTo(6, 1);

    // Reflection should also be parsed
    expect(style.reflectionBlurRadius).toBeCloseTo(0.667, 2);
    expect(style.reflectionStartOpacity).toBeCloseTo(0.52, 5);
    expect(style.reflectionEndOpacity).toBeCloseTo(0.003, 5);
    expect(style.reflectionEndPosition).toBeCloseTo(0.65, 5);
    expect(style.reflectionDirection).toBeCloseTo(90, 1);
  });

  it("should use effectDag as fallback when effectLst is absent", () => {
    const listNode: XmlObject = {
      "a:effectStyle": {
        "a:effectDag": {
          "a:glow": {
            "@_rad": "19050",
            "a:srgbClr": { "@_val": "00FF00" },
          },
        },
      },
    };

    const result = parseEffectStyleList(listNode);
    expect(result).toHaveLength(1);
    expect(result[0].glowColor).toBe("#00FF00");
    expect(result[0].glowRadius).toBeCloseTo(2, 1);
  });
});
