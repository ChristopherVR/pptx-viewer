import { describe, it, expect } from "vitest";
import type { XmlObject, PptxImageEffects } from "../../types";

// ---------------------------------------------------------------------------
// Extracted from PptxHandlerRuntimeImageEffects
// Pure re-implementation of extractImageEffects and extractSvgBlipRelId
// to test all branches without needing the full mixin chain.
// ---------------------------------------------------------------------------

function ensureArray(value: unknown): XmlObject[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value as XmlObject];
}

/** Stub parseColor — returns hex from a:srgbClr/@_val or null. */
function parseColor(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as XmlObject;
  const srgb = obj["a:srgbClr"] as XmlObject | undefined;
  if (srgb?.["@_val"]) return `#${srgb["@_val"]}`;
  // Direct @_val on the node
  if (obj["@_val"] && typeof obj["@_val"] === "string" && /^[0-9A-Fa-f]{6}$/.test(obj["@_val"])) {
    return `#${obj["@_val"]}`;
  }
  return null;
}

/** Stub extractColorOpacity — reads a:alpha/@_val as percentage / 1000. */
function extractColorOpacity(colorNode: XmlObject | undefined): number | undefined {
  if (!colorNode) return undefined;
  // Check for alpha child on srgbClr or direct
  const targets = [
    colorNode["a:srgbClr"],
    colorNode,
  ];
  for (const target of targets) {
    if (!target || typeof target !== "object") continue;
    const obj = target as XmlObject;
    const alpha = obj["a:alpha"] as XmlObject | undefined;
    if (alpha?.["@_val"] !== undefined) {
      const val = parseInt(String(alpha["@_val"]));
      if (Number.isFinite(val)) return val / 1000;
    }
  }
  return undefined;
}

/**
 * Extracted from PptxHandlerRuntimeImageEffects.extractImageEffects
 */
function extractImageEffects(
  blip: XmlObject | undefined,
): PptxImageEffects | null {
  if (!blip) return null;
  const effects: PptxImageEffects = {};
  let hasAny = false;

  const brightRaw = blip["@_bright"] ?? blip["@_brt"];
  if (brightRaw != null) {
    const val = parseInt(String(brightRaw));
    if (Number.isFinite(val)) {
      effects.brightness = val / 1000;
      hasAny = true;
    }
  }
  const contrastRaw = blip["@_contrast"] ?? blip["@_cont"];
  if (contrastRaw != null) {
    const val = parseInt(String(contrastRaw));
    if (Number.isFinite(val)) {
      effects.contrast = val / 1000;
      hasAny = true;
    }
  }

  if (blip["a:grayscl"]) {
    effects.grayscale = true;
    hasAny = true;
  }

  const alphaModFix = blip["a:alphaModFix"] as XmlObject | undefined;
  if (alphaModFix) {
    const amt = alphaModFix["@_amt"];
    if (amt !== undefined) {
      const pct = parseInt(String(amt)) / 1000;
      if (Number.isFinite(pct)) {
        effects.alphaModFix = pct;
        hasAny = true;
      }
    }
  }

  const biLevel = blip["a:biLevel"] as XmlObject | undefined;
  if (biLevel) {
    const thresh = biLevel["@_thresh"];
    if (thresh !== undefined) {
      const pct = parseInt(String(thresh)) / 1000;
      if (Number.isFinite(pct)) {
        effects.biLevel = pct;
        hasAny = true;
      }
    }
  }

  const clrChange = blip["a:clrChange"] as XmlObject | undefined;
  if (clrChange) {
    const clrFrom = clrChange["a:clrFrom"] as XmlObject | undefined;
    const clrTo = clrChange["a:clrTo"] as XmlObject | undefined;
    if (clrFrom && clrTo) {
      const fromColor = parseColor(clrFrom) || "#000000";
      const toColor = parseColor(clrTo) || "#ffffff";
      const toAlpha = extractColorOpacity(clrTo);
      effects.clrChange = {
        clrFrom: fromColor,
        clrTo: toColor,
        clrToTransparent: toAlpha !== undefined && toAlpha <= 0,
      };
      hasAny = true;
    }
  }

  const duotone = blip["a:duotone"] as XmlObject | undefined;
  if (duotone) {
    const duotoneColorNodes: XmlObject[] = [
      ...ensureArray(duotone["a:srgbClr"]),
      ...ensureArray(duotone["a:schemeClr"]),
      ...ensureArray(duotone["a:prstClr"]),
    ];
    if (duotoneColorNodes.length >= 2) {
      effects.duotone = {
        color1: parseColor(duotoneColorNodes[0]) || "#000000",
        color2: parseColor(duotoneColorNodes[1]) || "#ffffff",
      };
      hasAny = true;
    }
  }

  const extLst = blip["a:extLst"];
  if (extLst) {
    const exts = ensureArray(extLst["a:ext"]);
    for (const ext of exts) {
      const uri = String(ext["@_uri"] || "");
      if (uri === "{BEBA8EAE-BF5A-486C-A8C5-ECC9F3942E4B}") {
        const imgEffect = (ext["a14:imgEffect"] || ext["a14:imgLayer"]) as
          | XmlObject
          | undefined;
        if (imgEffect) {
          const keys = Object.keys(imgEffect).filter((k) =>
            k.startsWith("a14:artistic"),
          );
          if (keys.length > 0) {
            const effectName = keys[0].replace("a14:", "");
            effects.artisticEffect = effectName;
            hasAny = true;
            const effectNode = imgEffect[keys[0]] as XmlObject | undefined;
            if (effectNode) {
              const rad =
                effectNode["@_radius"] ??
                effectNode["@_amount"] ??
                effectNode["@_pressure"];
              if (rad != null) {
                effects.artisticRadius = parseInt(String(rad)) || 0;
              }
            }
          }
        }
      }
    }
  }

  return hasAny ? effects : null;
}

/**
 * Extracted from PptxHandlerRuntimeImageEffects.extractSvgBlipRelId
 */
function extractSvgBlipRelId(
  blip: XmlObject | undefined,
): string | undefined {
  if (!blip) return undefined;
  const extLst = blip["a:extLst"];
  if (!extLst) return undefined;

  const exts = ensureArray(extLst["a:ext"]);
  for (const ext of exts) {
    const uri = String(ext["@_uri"] || "");
    if (uri === "{96DAC541-7B7A-43D3-8B79-37D633B846F1}") {
      const svgBlip = ext["asvg:svgBlip"] || ext["a16:svgBlip"];
      if (svgBlip) {
        return String(svgBlip["@_r:embed"] || svgBlip["@_r:link"] || "");
      }
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// extractImageEffects
// ---------------------------------------------------------------------------
describe("extractImageEffects", () => {
  it("should return null for undefined blip", () => {
    expect(extractImageEffects(undefined)).toBeNull();
  });

  it("should return null when blip has no effects", () => {
    expect(extractImageEffects({})).toBeNull();
  });

  it("should parse brightness from @_bright", () => {
    const blip: XmlObject = { "@_bright": "20000" };
    const result = extractImageEffects(blip);
    expect(result).not.toBeNull();
    expect(result!.brightness).toBe(20);
  });

  it("should parse brightness from @_brt (alternate attr)", () => {
    const blip: XmlObject = { "@_brt": "-10000" };
    const result = extractImageEffects(blip);
    expect(result!.brightness).toBe(-10);
  });

  it("should parse contrast from @_contrast", () => {
    const blip: XmlObject = { "@_contrast": "50000" };
    const result = extractImageEffects(blip);
    expect(result!.contrast).toBe(50);
  });

  it("should parse contrast from @_cont (alternate attr)", () => {
    const blip: XmlObject = { "@_cont": "-30000" };
    const result = extractImageEffects(blip);
    expect(result!.contrast).toBe(-30);
  });

  it("should detect grayscale", () => {
    const blip: XmlObject = { "a:grayscl": {} };
    const result = extractImageEffects(blip);
    expect(result).not.toBeNull();
    expect(result!.grayscale).toBe(true);
  });

  it("should parse alphaModFix amount", () => {
    const blip: XmlObject = {
      "a:alphaModFix": { "@_amt": "50000" },
    };
    const result = extractImageEffects(blip);
    expect(result!.alphaModFix).toBe(50);
  });

  it("should parse biLevel threshold", () => {
    const blip: XmlObject = {
      "a:biLevel": { "@_thresh": "75000" },
    };
    const result = extractImageEffects(blip);
    expect(result!.biLevel).toBe(75);
  });

  it("should parse color change with from and to", () => {
    const blip: XmlObject = {
      "a:clrChange": {
        "a:clrFrom": { "a:srgbClr": { "@_val": "FF0000" } },
        "a:clrTo": { "a:srgbClr": { "@_val": "00FF00" } },
      },
    };
    const result = extractImageEffects(blip);
    expect(result!.clrChange).toBeDefined();
    expect(result!.clrChange!.clrFrom).toBe("#FF0000");
    expect(result!.clrChange!.clrTo).toBe("#00FF00");
    expect(result!.clrChange!.clrToTransparent).toBe(false);
  });

  it("should detect transparent color change target (alpha=0)", () => {
    const blip: XmlObject = {
      "a:clrChange": {
        "a:clrFrom": { "a:srgbClr": { "@_val": "FFFFFF" } },
        "a:clrTo": {
          "a:srgbClr": {
            "@_val": "FFFFFF",
            "a:alpha": { "@_val": "0" },
          },
        },
      },
    };
    const result = extractImageEffects(blip);
    expect(result!.clrChange!.clrToTransparent).toBe(true);
  });

  it("should parse duotone with two srgbClr colors", () => {
    const blip: XmlObject = {
      "a:duotone": {
        "a:srgbClr": [
          { "@_val": "000000" },
          { "@_val": "FFFFFF" },
        ],
      },
    };
    const result = extractImageEffects(blip);
    expect(result!.duotone).toBeDefined();
    expect(result!.duotone!.color1).toBe("#000000");
    expect(result!.duotone!.color2).toBe("#FFFFFF");
  });

  it("should skip duotone when fewer than 2 color nodes", () => {
    const blip: XmlObject = {
      "a:duotone": {
        "a:srgbClr": { "@_val": "000000" },
      },
    };
    const result = extractImageEffects(blip);
    // Only 1 color node, duotone should not be set
    expect(result).toBeNull();
  });

  it("should parse artistic effect from extension list", () => {
    const blip: XmlObject = {
      "a:extLst": {
        "a:ext": {
          "@_uri": "{BEBA8EAE-BF5A-486C-A8C5-ECC9F3942E4B}",
          "a14:imgEffect": {
            "a14:artisticBlur": { "@_radius": "5" },
          },
        },
      },
    };
    const result = extractImageEffects(blip);
    expect(result!.artisticEffect).toBe("artisticBlur");
    expect(result!.artisticRadius).toBe(5);
  });

  it("should parse artistic effect from imgLayer", () => {
    const blip: XmlObject = {
      "a:extLst": {
        "a:ext": {
          "@_uri": "{BEBA8EAE-BF5A-486C-A8C5-ECC9F3942E4B}",
          "a14:imgLayer": {
            "a14:artisticPencilGrayscale": { "@_amount": "10" },
          },
        },
      },
    };
    const result = extractImageEffects(blip);
    expect(result!.artisticEffect).toBe("artisticPencilGrayscale");
    expect(result!.artisticRadius).toBe(10);
  });

  it("should combine multiple effects", () => {
    const blip: XmlObject = {
      "@_bright": "10000",
      "@_contrast": "20000",
      "a:grayscl": {},
    };
    const result = extractImageEffects(blip);
    expect(result!.brightness).toBe(10);
    expect(result!.contrast).toBe(20);
    expect(result!.grayscale).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// extractSvgBlipRelId
// ---------------------------------------------------------------------------
describe("extractSvgBlipRelId", () => {
  it("should return undefined for undefined blip", () => {
    expect(extractSvgBlipRelId(undefined)).toBeUndefined();
  });

  it("should return undefined when blip has no extLst", () => {
    expect(extractSvgBlipRelId({})).toBeUndefined();
  });

  it("should return undefined when ext has wrong URI", () => {
    const blip: XmlObject = {
      "a:extLst": {
        "a:ext": {
          "@_uri": "{OTHER-URI}",
          "asvg:svgBlip": { "@_r:embed": "rId5" },
        },
      },
    };
    expect(extractSvgBlipRelId(blip)).toBeUndefined();
  });

  it("should extract r:embed from asvg:svgBlip", () => {
    const blip: XmlObject = {
      "a:extLst": {
        "a:ext": {
          "@_uri": "{96DAC541-7B7A-43D3-8B79-37D633B846F1}",
          "asvg:svgBlip": { "@_r:embed": "rId7" },
        },
      },
    };
    expect(extractSvgBlipRelId(blip)).toBe("rId7");
  });

  it("should extract r:link from asvg:svgBlip", () => {
    const blip: XmlObject = {
      "a:extLst": {
        "a:ext": {
          "@_uri": "{96DAC541-7B7A-43D3-8B79-37D633B846F1}",
          "asvg:svgBlip": { "@_r:link": "rId8" },
        },
      },
    };
    expect(extractSvgBlipRelId(blip)).toBe("rId8");
  });

  it("should extract from a16:svgBlip (alternate namespace)", () => {
    const blip: XmlObject = {
      "a:extLst": {
        "a:ext": {
          "@_uri": "{96DAC541-7B7A-43D3-8B79-37D633B846F1}",
          "a16:svgBlip": { "@_r:embed": "rId9" },
        },
      },
    };
    expect(extractSvgBlipRelId(blip)).toBe("rId9");
  });

  it("should return empty string when svgBlip has no r:embed or r:link", () => {
    const blip: XmlObject = {
      "a:extLst": {
        "a:ext": {
          "@_uri": "{96DAC541-7B7A-43D3-8B79-37D633B846F1}",
          "asvg:svgBlip": {},
        },
      },
    };
    expect(extractSvgBlipRelId(blip)).toBe("");
  });

  it("should handle multiple extensions and find the SVG one", () => {
    const blip: XmlObject = {
      "a:extLst": {
        "a:ext": [
          {
            "@_uri": "{28A0092B-C50C-407E-A947-70E740481C1C}",
          },
          {
            "@_uri": "{96DAC541-7B7A-43D3-8B79-37D633B846F1}",
            "asvg:svgBlip": { "@_r:embed": "rId12" },
          },
        ],
      },
    };
    expect(extractSvgBlipRelId(blip)).toBe("rId12");
  });
});
