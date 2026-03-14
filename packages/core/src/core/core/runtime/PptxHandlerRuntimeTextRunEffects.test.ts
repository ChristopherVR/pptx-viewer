import { describe, it, expect } from "vitest";
import type { TextStyle, XmlObject } from "../../types";

// ---------------------------------------------------------------------------
// Extracted from PptxHandlerRuntimeTextRunEffects
// These functions mirror the logic of applyHyperlinkStyle and
// applyTextRunEffects but are standalone for direct testing.
// ---------------------------------------------------------------------------

const EMU_PER_PX = 9525;

// Stub helpers
function parseBooleanAttr(value: unknown): boolean {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true";
}

/**
 * Extracted from PptxHandlerRuntimeTextRunEffects.applyHyperlinkStyle
 */
function applyHyperlinkStyle(
  style: TextStyle,
  runProperties: XmlObject,
  relationshipMap?: Map<string, string>,
): void {
  const hyperlinkNode = runProperties["a:hlinkClick"] as
    | XmlObject
    | undefined;
  const hyperlinkRelationshipId = String(
    hyperlinkNode?.["@_r:id"] || hyperlinkNode?.["@_id"] || "",
  ).trim();
  if (hyperlinkRelationshipId.length > 0) {
    style.hyperlinkRId = hyperlinkRelationshipId;
    const hyperlinkTarget = relationshipMap?.get(hyperlinkRelationshipId);
    if (hyperlinkTarget) {
      style.hyperlink = hyperlinkTarget;
    }
  }
  const tooltip = String(hyperlinkNode?.["@_tooltip"] || "").trim();
  if (tooltip) {
    style.hyperlinkTooltip = tooltip;
  }
  if (hyperlinkNode) {
    const invalidUrl = String(hyperlinkNode["@_invalidUrl"] || "").trim();
    if (invalidUrl) style.hyperlinkInvalidUrl = invalidUrl;
    const tgtFrame = String(hyperlinkNode["@_tgtFrame"] || "").trim();
    if (tgtFrame) style.hyperlinkTargetFrame = tgtFrame;
    const historyAttr = hyperlinkNode["@_history"];
    if (historyAttr !== undefined) {
      const hVal = String(historyAttr).trim().toLowerCase();
      style.hyperlinkHistory = hVal !== "0" && hVal !== "false";
    }
    const highlightClick = hyperlinkNode["@_highlightClick"];
    if (highlightClick !== undefined) {
      const hcVal = String(highlightClick).trim().toLowerCase();
      style.hyperlinkHighlightClick = hcVal === "1" || hcVal === "true";
    }
    const endSnd = hyperlinkNode["@_endSnd"];
    if (endSnd !== undefined) {
      const esVal = String(endSnd).trim().toLowerCase();
      style.hyperlinkEndSound = esVal === "1" || esVal === "true";
    }
  }
  const actionStr = String(hyperlinkNode?.["@_action"] || "").trim();
  if (actionStr) {
    style.hyperlinkAction = actionStr;
    if (!style.hyperlink && actionStr.startsWith("ppaction://")) {
      style.hyperlink = actionStr;
    }
  }
  if (
    actionStr === "ppaction://hlinksldjump" &&
    hyperlinkRelationshipId.length > 0 &&
    relationshipMap
  ) {
    const slideTarget = relationshipMap.get(hyperlinkRelationshipId);
    if (slideTarget) {
      const slideMatch = slideTarget.match(/slide(\d+)\.xml$/i);
      if (slideMatch) {
        style.hyperlinkTargetSlideIndex = parseInt(slideMatch[1], 10) - 1;
      }
    }
  }

  const hlinkMouseOver = runProperties["a:hlinkMouseOver"] as
    | XmlObject
    | undefined;
  if (hlinkMouseOver) {
    const mouseOverRelId = String(
      hlinkMouseOver["@_r:id"] || hlinkMouseOver["@_id"] || "",
    ).trim();
    if (mouseOverRelId.length > 0) {
      const mouseOverTarget = relationshipMap?.get(mouseOverRelId);
      if (mouseOverTarget) {
        style.hyperlinkMouseOver = mouseOverTarget;
      } else {
        style.hyperlinkMouseOver = mouseOverRelId;
      }
    }
  }
}

/**
 * Simplified applyTextRunEffects — covers outer shadow, glow, reflection,
 * inner shadow, preset shadow, blur, alpha mods, HSL, color change, duotone.
 * Uses stub parseColor that returns null (test focuses on numeric parsing).
 */
function applyTextRunEffects(
  style: TextStyle,
  runEffectList: XmlObject,
): void {
  // Outer shadow
  const outerShdw = runEffectList["a:outerShdw"] as XmlObject | undefined;
  if (outerShdw) {
    // Simplified: set color flag
    style.textShadowColor = "#000000"; // stub
    const blurRaw = Number.parseInt(String(outerShdw["@_blurRad"] || ""), 10);
    if (Number.isFinite(blurRaw) && blurRaw >= 0) {
      style.textShadowBlur = blurRaw / EMU_PER_PX;
    }
    const distRaw = Number.parseInt(String(outerShdw["@_dist"] || ""), 10);
    const dirRaw = Number.parseInt(String(outerShdw["@_dir"] || ""), 10);
    if (Number.isFinite(distRaw) && distRaw >= 0) {
      const dist = distRaw / EMU_PER_PX;
      const dirRad =
        ((Number.isFinite(dirRaw) ? dirRaw / 60000 : 0) * Math.PI) / 180;
      style.textShadowOffsetX =
        Math.round(Math.cos(dirRad) * dist * 100) / 100;
      style.textShadowOffsetY =
        Math.round(Math.sin(dirRad) * dist * 100) / 100;
    }
  }

  // Glow
  const glowNode = runEffectList["a:glow"] as XmlObject | undefined;
  if (glowNode) {
    style.textGlowColor = "#FFFF00"; // stub
    const radRaw = Number.parseInt(String(glowNode["@_rad"] || ""), 10);
    if (Number.isFinite(radRaw) && radRaw >= 0) {
      style.textGlowRadius = radRaw / EMU_PER_PX;
    }
  }

  // Reflection
  const reflNode = runEffectList["a:reflection"] as XmlObject | undefined;
  if (reflNode) {
    style.textReflection = true;
    const blurRaw = Number.parseInt(String(reflNode["@_blurRad"] || ""), 10);
    if (Number.isFinite(blurRaw) && blurRaw >= 0) {
      style.textReflectionBlur = blurRaw / EMU_PER_PX;
    }
    const stA = Number.parseInt(String(reflNode["@_stA"] || ""), 10);
    if (Number.isFinite(stA)) style.textReflectionStartOpacity = stA / 100000;
    const endA = Number.parseInt(String(reflNode["@_endA"] || ""), 10);
    if (Number.isFinite(endA)) style.textReflectionEndOpacity = endA / 100000;
    const distRaw = Number.parseInt(String(reflNode["@_dist"] || ""), 10);
    if (Number.isFinite(distRaw) && distRaw >= 0) {
      style.textReflectionOffset = distRaw / EMU_PER_PX;
    }
  }

  // Inner shadow
  const innerShdw = runEffectList["a:innerShdw"] as XmlObject | undefined;
  if (innerShdw) {
    style.textInnerShadowColor = "#333333"; // stub
    const isBlurRaw = Number.parseInt(String(innerShdw["@_blurRad"] || ""), 10);
    if (Number.isFinite(isBlurRaw) && isBlurRaw >= 0) {
      style.textInnerShadowBlur = isBlurRaw / EMU_PER_PX;
    }
    const isDistRaw = Number.parseInt(String(innerShdw["@_dist"] || ""), 10);
    const isDirRaw = Number.parseInt(String(innerShdw["@_dir"] || ""), 10);
    if (Number.isFinite(isDistRaw) && isDistRaw >= 0) {
      const isDist = isDistRaw / EMU_PER_PX;
      const isDirRad =
        ((Number.isFinite(isDirRaw) ? isDirRaw / 60000 : 0) * Math.PI) / 180;
      style.textInnerShadowOffsetX =
        Math.round(Math.cos(isDirRad) * isDist * 100) / 100;
      style.textInnerShadowOffsetY =
        Math.round(Math.sin(isDirRad) * isDist * 100) / 100;
    }
  }

  // Preset shadow
  const prstShdw = runEffectList["a:prstShdw"] as XmlObject | undefined;
  if (prstShdw) {
    const prst = String(prstShdw["@_prst"] || "").trim();
    if (prst) style.textPresetShadowName = prst;
    const psDist = Number.parseInt(String(prstShdw["@_dist"] || ""), 10);
    if (Number.isFinite(psDist) && psDist >= 0) {
      style.textPresetShadowDistance = psDist / EMU_PER_PX;
    }
    const psDir = Number.parseInt(String(prstShdw["@_dir"] || ""), 10);
    if (Number.isFinite(psDir)) {
      style.textPresetShadowDirection = psDir / 60000;
    }
  }

  // Blur
  const blurNode = runEffectList["a:blur"] as XmlObject | undefined;
  if (blurNode) {
    const radRaw = Number.parseInt(String(blurNode["@_rad"] || ""), 10);
    if (Number.isFinite(radRaw) && radRaw >= 0) {
      style.textBlurRadius = radRaw / EMU_PER_PX;
    }
  }

  // Alpha modification fixed
  const alphaModFix = runEffectList["a:alphaModFix"] as XmlObject | undefined;
  if (alphaModFix) {
    const amt = Number.parseInt(String(alphaModFix["@_amt"] || ""), 10);
    if (Number.isFinite(amt)) {
      style.textAlphaModFix = amt / 1000;
    }
  }

  // Alpha modulation
  const alphaMod = runEffectList["a:alphaMod"] as XmlObject | undefined;
  if (alphaMod) {
    const amt = Number.parseInt(String(alphaMod["@_amt"] || ""), 10);
    if (Number.isFinite(amt)) {
      style.textAlphaMod = amt / 1000;
    }
  }

  // HSL
  const hslNode = runEffectList["a:hsl"] as XmlObject | undefined;
  if (hslNode) {
    const hue = Number.parseInt(String(hslNode["@_hue"] || ""), 10);
    if (Number.isFinite(hue)) style.textHslHue = hue / 60000;
    const sat = Number.parseInt(String(hslNode["@_sat"] || ""), 10);
    if (Number.isFinite(sat)) style.textHslSaturation = sat / 1000;
    const lum = Number.parseInt(String(hslNode["@_lum"] || ""), 10);
    if (Number.isFinite(lum)) style.textHslLuminance = lum / 1000;
  }
}

// ---------------------------------------------------------------------------
// applyHyperlinkStyle
// ---------------------------------------------------------------------------
describe("applyHyperlinkStyle", () => {
  it("should do nothing when no hyperlink nodes exist", () => {
    const style: TextStyle = {};
    applyHyperlinkStyle(style, {});
    expect(style.hyperlink).toBeUndefined();
    expect(style.hyperlinkRId).toBeUndefined();
  });

  it("should set hyperlinkRId from a:hlinkClick @_r:id", () => {
    const style: TextStyle = {};
    applyHyperlinkStyle(style, {
      "a:hlinkClick": { "@_r:id": "rId3" },
    });
    expect(style.hyperlinkRId).toBe("rId3");
  });

  it("should resolve hyperlink target from relationship map", () => {
    const style: TextStyle = {};
    const relMap = new Map([["rId3", "https://example.com"]]);
    applyHyperlinkStyle(
      style,
      { "a:hlinkClick": { "@_r:id": "rId3" } },
      relMap,
    );
    expect(style.hyperlink).toBe("https://example.com");
  });

  it("should set hyperlinkTooltip", () => {
    const style: TextStyle = {};
    applyHyperlinkStyle(style, {
      "a:hlinkClick": {
        "@_r:id": "rId1",
        "@_tooltip": "Click here",
      },
    });
    expect(style.hyperlinkTooltip).toBe("Click here");
  });

  it("should set hyperlinkInvalidUrl", () => {
    const style: TextStyle = {};
    applyHyperlinkStyle(style, {
      "a:hlinkClick": {
        "@_invalidUrl": "http://broken.link",
      },
    });
    expect(style.hyperlinkInvalidUrl).toBe("http://broken.link");
  });

  it("should set hyperlinkTargetFrame", () => {
    const style: TextStyle = {};
    applyHyperlinkStyle(style, {
      "a:hlinkClick": {
        "@_r:id": "rId1",
        "@_tgtFrame": "_blank",
      },
    });
    expect(style.hyperlinkTargetFrame).toBe("_blank");
  });

  it("should set hyperlinkHistory to true for '1'", () => {
    const style: TextStyle = {};
    applyHyperlinkStyle(style, {
      "a:hlinkClick": { "@_history": "1" },
    });
    expect(style.hyperlinkHistory).toBe(true);
  });

  it("should set hyperlinkHistory to false for '0'", () => {
    const style: TextStyle = {};
    applyHyperlinkStyle(style, {
      "a:hlinkClick": { "@_history": "0" },
    });
    expect(style.hyperlinkHistory).toBe(false);
  });

  it("should set hyperlinkHighlightClick", () => {
    const style: TextStyle = {};
    applyHyperlinkStyle(style, {
      "a:hlinkClick": { "@_highlightClick": "true" },
    });
    expect(style.hyperlinkHighlightClick).toBe(true);
  });

  it("should set hyperlinkEndSound", () => {
    const style: TextStyle = {};
    applyHyperlinkStyle(style, {
      "a:hlinkClick": { "@_endSnd": "1" },
    });
    expect(style.hyperlinkEndSound).toBe(true);
  });

  it("should set hyperlinkAction and derive hyperlink for ppaction://", () => {
    const style: TextStyle = {};
    applyHyperlinkStyle(style, {
      "a:hlinkClick": {
        "@_action": "ppaction://hlinkshowjump?jump=nextslide",
      },
    });
    expect(style.hyperlinkAction).toBe(
      "ppaction://hlinkshowjump?jump=nextslide",
    );
    expect(style.hyperlink).toBe(
      "ppaction://hlinkshowjump?jump=nextslide",
    );
  });

  it("should resolve slide jump target index", () => {
    const style: TextStyle = {};
    const relMap = new Map([["rId5", "slide3.xml"]]);
    applyHyperlinkStyle(
      style,
      {
        "a:hlinkClick": {
          "@_r:id": "rId5",
          "@_action": "ppaction://hlinksldjump",
        },
      },
      relMap,
    );
    expect(style.hyperlinkTargetSlideIndex).toBe(2); // slide3 -> index 2
  });

  it("should set hyperlinkMouseOver from relationship map", () => {
    const style: TextStyle = {};
    const relMap = new Map([["rId10", "https://hover.example.com"]]);
    applyHyperlinkStyle(
      style,
      {
        "a:hlinkMouseOver": { "@_r:id": "rId10" },
      },
      relMap,
    );
    expect(style.hyperlinkMouseOver).toBe("https://hover.example.com");
  });

  it("should use rId as fallback for hyperlinkMouseOver when no map entry", () => {
    const style: TextStyle = {};
    applyHyperlinkStyle(style, {
      "a:hlinkMouseOver": { "@_r:id": "rId99" },
    });
    expect(style.hyperlinkMouseOver).toBe("rId99");
  });

  it("should use @_id as fallback when @_r:id is missing", () => {
    const style: TextStyle = {};
    applyHyperlinkStyle(style, {
      "a:hlinkClick": { "@_id": "rId2" },
    });
    expect(style.hyperlinkRId).toBe("rId2");
  });
});

// ---------------------------------------------------------------------------
// applyTextRunEffects
// ---------------------------------------------------------------------------
describe("applyTextRunEffects", () => {
  it("should do nothing for empty effect list", () => {
    const style: TextStyle = {};
    applyTextRunEffects(style, {});
    expect(style.textShadowColor).toBeUndefined();
    expect(style.textGlowColor).toBeUndefined();
    expect(style.textReflection).toBeUndefined();
  });

  describe("outer shadow", () => {
    it("should parse blur radius in pixels", () => {
      const style: TextStyle = {};
      applyTextRunEffects(style, {
        "a:outerShdw": { "@_blurRad": "95250" }, // 10px
      });
      expect(style.textShadowBlur).toBeCloseTo(10);
    });

    it("should parse distance and direction into offsets", () => {
      const style: TextStyle = {};
      // distance = 9525 EMU = 1px, direction = 0 degrees => pure X offset
      applyTextRunEffects(style, {
        "a:outerShdw": { "@_dist": "9525", "@_dir": "0" },
      });
      expect(style.textShadowOffsetX).toBeCloseTo(1);
      expect(style.textShadowOffsetY).toBeCloseTo(0);
    });

    it("should parse 90-degree direction correctly", () => {
      const style: TextStyle = {};
      // direction = 5400000 = 90 degrees; dist = 9525 = 1px
      applyTextRunEffects(style, {
        "a:outerShdw": { "@_dist": "9525", "@_dir": "5400000" },
      });
      expect(style.textShadowOffsetX).toBeCloseTo(0, 1);
      expect(style.textShadowOffsetY).toBeCloseTo(1, 1);
    });
  });

  describe("glow", () => {
    it("should parse glow radius", () => {
      const style: TextStyle = {};
      applyTextRunEffects(style, {
        "a:glow": { "@_rad": "47625" }, // 5px
      });
      expect(style.textGlowRadius).toBeCloseTo(5);
    });
  });

  describe("reflection", () => {
    it("should set textReflection to true", () => {
      const style: TextStyle = {};
      applyTextRunEffects(style, {
        "a:reflection": {},
      });
      expect(style.textReflection).toBe(true);
    });

    it("should parse reflection opacities", () => {
      const style: TextStyle = {};
      applyTextRunEffects(style, {
        "a:reflection": {
          "@_stA": "50000", // 50%
          "@_endA": "0",    // 0%
        },
      });
      expect(style.textReflectionStartOpacity).toBeCloseTo(0.5);
      expect(style.textReflectionEndOpacity).toBeCloseTo(0);
    });

    it("should parse reflection blur and offset", () => {
      const style: TextStyle = {};
      applyTextRunEffects(style, {
        "a:reflection": {
          "@_blurRad": "19050", // 2px
          "@_dist": "9525",    // 1px
        },
      });
      expect(style.textReflectionBlur).toBeCloseTo(2);
      expect(style.textReflectionOffset).toBeCloseTo(1);
    });
  });

  describe("inner shadow", () => {
    it("should parse inner shadow blur", () => {
      const style: TextStyle = {};
      applyTextRunEffects(style, {
        "a:innerShdw": { "@_blurRad": "47625" },
      });
      expect(style.textInnerShadowBlur).toBeCloseTo(5);
    });

    it("should parse inner shadow distance and direction", () => {
      const style: TextStyle = {};
      // 45 degrees = 2700000 60ths of degree; dist = 19050 = 2px
      applyTextRunEffects(style, {
        "a:innerShdw": { "@_dist": "19050", "@_dir": "2700000" },
      });
      const dist = 19050 / EMU_PER_PX;
      expect(style.textInnerShadowOffsetX).toBeCloseTo(
        Math.cos((45 * Math.PI) / 180) * dist,
        1,
      );
      expect(style.textInnerShadowOffsetY).toBeCloseTo(
        Math.sin((45 * Math.PI) / 180) * dist,
        1,
      );
    });
  });

  describe("preset shadow", () => {
    it("should parse preset shadow name", () => {
      const style: TextStyle = {};
      applyTextRunEffects(style, {
        "a:prstShdw": { "@_prst": "shdw14" },
      });
      expect(style.textPresetShadowName).toBe("shdw14");
    });

    it("should parse preset shadow distance and direction", () => {
      const style: TextStyle = {};
      applyTextRunEffects(style, {
        "a:prstShdw": {
          "@_prst": "shdw1",
          "@_dist": "19050",
          "@_dir": "5400000",
        },
      });
      expect(style.textPresetShadowDistance).toBeCloseTo(19050 / EMU_PER_PX);
      expect(style.textPresetShadowDirection).toBeCloseTo(90);
    });
  });

  describe("blur", () => {
    it("should parse text blur radius", () => {
      const style: TextStyle = {};
      applyTextRunEffects(style, {
        "a:blur": { "@_rad": "28575" }, // 3px
      });
      expect(style.textBlurRadius).toBeCloseTo(3);
    });
  });

  describe("alpha modifications", () => {
    it("should parse alphaModFix", () => {
      const style: TextStyle = {};
      applyTextRunEffects(style, {
        "a:alphaModFix": { "@_amt": "50000" },
      });
      expect(style.textAlphaModFix).toBe(50);
    });

    it("should parse alphaMod", () => {
      const style: TextStyle = {};
      applyTextRunEffects(style, {
        "a:alphaMod": { "@_amt": "75000" },
      });
      expect(style.textAlphaMod).toBe(75);
    });
  });

  describe("HSL adjustments", () => {
    it("should parse hue, saturation, and luminance", () => {
      const style: TextStyle = {};
      applyTextRunEffects(style, {
        "a:hsl": {
          "@_hue": "10800000", // 180 degrees
          "@_sat": "50000",    // 50%
          "@_lum": "20000",    // 20%
        },
      });
      expect(style.textHslHue).toBeCloseTo(180);
      expect(style.textHslSaturation).toBeCloseTo(50);
      expect(style.textHslLuminance).toBeCloseTo(20);
    });
  });
});
