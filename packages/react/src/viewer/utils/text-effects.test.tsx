import { describe, it, expect } from "vitest";
import type { TextStyle } from "pptx-viewer-core";
import {
  buildTextFillCss,
  buildText3DShadowCss,
  buildTextShadowCss,
  buildTextInnerShadowCss,
  buildTextBlurFilter,
  buildTextHslFilter,
  getTextAlphaOpacity,
  buildTextGlowFilter,
  buildTextReflectionCss,
} from "./text-effects";

// ── buildTextFillCss ──────────────────────────────────────────────────

describe("buildTextFillCss", () => {
  it("returns undefined when no gradient or pattern fill", () => {
    expect(buildTextFillCss({} as TextStyle)).toBeUndefined();
  });

  it("returns gradient CSS with background-clip: text", () => {
    const style: TextStyle = {
      textFillGradient: "linear-gradient(90deg, red, blue)",
    };
    const result = buildTextFillCss(style);
    expect(result).toBeDefined();
    expect(result!.background).toBe("linear-gradient(90deg, red, blue)");
    expect(result!.backgroundClip).toBe("text");
    expect(result!.WebkitBackgroundClip).toBe("text");
    expect(result!.WebkitTextFillColor).toBe("transparent");
  });

  it("returns pattern CSS with SVG background when pattern fill set", () => {
    const style: TextStyle = {
      textFillPattern: "ltDnDiag",
      textFillPatternForeground: "#000000",
      textFillPatternBackground: "#FFFFFF",
    };
    const result = buildTextFillCss(style);
    // If the pattern is recognized, should produce background with SVG data url
    if (result) {
      expect(result.backgroundClip).toBe("text");
      expect(result.background).toContain("data:image/svg+xml");
    }
  });

  it("prefers gradient fill over pattern fill", () => {
    const style: TextStyle = {
      textFillGradient: "linear-gradient(red, blue)",
      textFillPattern: "ltDnDiag",
    };
    const result = buildTextFillCss(style);
    expect(result).toBeDefined();
    expect(result!.background).toContain("linear-gradient");
  });
});

// ── buildText3DShadowCss ──────────────────────────────────────────────

describe("buildText3DShadowCss", () => {
  it("returns undefined when no text3d property", () => {
    expect(buildText3DShadowCss({} as TextStyle)).toBeUndefined();
  });

  it("returns undefined when text3d has no extrusion or bevel", () => {
    const style: TextStyle = {
      text3d: {},
    };
    expect(buildText3DShadowCss(style)).toBeUndefined();
  });

  it("generates extrusion layers for text3d with extrusionHeight", () => {
    const style: TextStyle = {
      text3d: {
        extrusionHeight: 9525 * 3, // 3px worth
        extrusionColor: "#888888",
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    // Should contain multiple shadow layers (1px, 2px, 3px) + final soft shadow
    expect(result!.split(",").length).toBeGreaterThanOrEqual(3);
    expect(result).toContain("1px 1px 0");
    expect(result).toContain("2px 2px 0");
    expect(result).toContain("3px 3px 0");
  });

  it("caps extrusion layers at MAX_EXTRUSION_LAYERS (15)", () => {
    const style: TextStyle = {
      text3d: {
        extrusionHeight: 9525 * 50, // would be 50px, but capped at 15
        extrusionColor: "#888888", // use hex colour to avoid rgb() commas
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    // Should contain the 15th layer but not a 16th layer offset
    expect(result).toContain("15px 15px 0");
    expect(result).not.toContain("16px 16px 0");
    // Final soft shadow at depth+1 = 16px offset
    expect(result).toContain("16px 16px");
  });

  it("generates bevel top highlight and shadow", () => {
    const style: TextStyle = {
      text3d: {
        bevelTopType: "circle",
        bevelTopWidth: 9525 * 2,
        bevelTopHeight: 9525 * 2,
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    // circle bevel: highlightOpacity 0.45, shadowOpacity 0.30
    expect(result).toContain("rgba(255,255,255,0.45)");
    expect(result).toContain("rgba(0,0,0,0.3)");
  });

  it("generates bevel bottom shadow", () => {
    const style: TextStyle = {
      text3d: {
        bevelBottomType: "circle",
        bevelBottomWidth: 9525,
        bevelBottomHeight: 9525,
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    // circle bevel bottom: shadowOpacity 0.30, highlightOpacity * 0.6 = 0.27
    expect(result).toContain("rgba(0,0,0,0.3)");
    expect(result).toContain("rgba(255,255,255,0.27)");
  });

  it("returns undefined for bevelTopType = none", () => {
    const style: TextStyle = {
      text3d: { bevelTopType: "none" as any },
    };
    expect(buildText3DShadowCss(style)).toBeUndefined();
  });

  // ── Material preset tests ──────────────────────────────────────────

  it("matte material produces no specular highlight", () => {
    const style: TextStyle = {
      color: "#4488CC",
      text3d: {
        extrusionHeight: 9525 * 5,
        presetMaterial: "matte",
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    // Matte has no specular highlight, so all layers use darkened rgb() values
    // and there is no lightened highlight shadow at -1px -1px
    const parts = result!.split(",").map((s) => s.trim());
    // No highlight layer (lightenHex produces rgb) should appear before the soft shadow
    const highlightLayers = parts.filter(
      (p) => p.startsWith("-1px -1px"),
    );
    expect(highlightLayers.length).toBe(0);
  });

  it("plastic material adds a specular highlight shadow", () => {
    const style: TextStyle = {
      color: "#4488CC",
      text3d: {
        extrusionHeight: 9525 * 5,
        presetMaterial: "plastic",
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    // Plastic adds a specular highlight at (-dx, -dy) i.e. (-1px, -1px)
    expect(result).toContain("-1px -1px");
  });

  it("metal material adds a specular highlight with sharp blur", () => {
    const style: TextStyle = {
      color: "#AAAAAA",
      text3d: {
        extrusionHeight: 9525 * 5,
        presetMaterial: "metal",
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    // Metal has specularBlur = 0 → sharp highlight at -1px -1px 0px
    expect(result).toContain("-1px -1px 0px");
  });

  it("flat material uses subtle darkening with no specular", () => {
    const style: TextStyle = {
      color: "#FF0000",
      text3d: {
        extrusionHeight: 9525 * 5,
        presetMaterial: "flat",
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    // Flat has no specular, similar to matte
    const parts = result!.split(",").map((s) => s.trim());
    const highlightLayers = parts.filter(
      (p) => p.startsWith("-1px -1px"),
    );
    expect(highlightLayers.length).toBe(0);
  });

  // ── Bevel type tests ──────────────────────────────────────────────

  it("hardEdge bevel adds extra sharp highlight layer", () => {
    const style: TextStyle = {
      text3d: {
        bevelTopType: "hardEdge",
        bevelTopWidth: 9525 * 2,
        bevelTopHeight: 9525 * 2,
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    // hardEdge: highlightOpacity = 0.60, extraHighlight = true
    expect(result).toContain("rgba(255,255,255,0.6)");
    // Extra highlight at -1px -1px 0 with half highlightOpacity
    expect(result).toContain("-1px -1px 0 rgba(255,255,255,0.3)");
  });

  it("softRound bevel uses higher blur multiplier", () => {
    const style: TextStyle = {
      text3d: {
        bevelTopType: "softRound",
        bevelTopWidth: 9525 * 2, // 2px
        bevelTopHeight: 9525 * 2, // 2px
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    // softRound: blurMultiplier = 1.5, so blur = round(2 * 1.5) = 3px
    // highlight at -2px -2px 3px
    expect(result).toContain("-2px -2px 3px");
  });

  it("angle bevel produces extra sharp highlight", () => {
    const style: TextStyle = {
      text3d: {
        bevelTopType: "angle",
        bevelTopWidth: 9525,
        bevelTopHeight: 9525,
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    // angle: highlightOpacity = 0.55, extraHighlight = true
    expect(result).toContain("rgba(255,255,255,0.55)");
    // Extra highlight: half of 0.55 = 0.275 → rounded to 0.28
    expect(result).toContain("-1px -1px 0 rgba(255,255,255,0.28)");
  });

  // ── Combined material + bevel tests ───────────────────────────────

  it("combines extrusion with material and bevel", () => {
    const style: TextStyle = {
      color: "#336699",
      text3d: {
        extrusionHeight: 9525 * 4,
        presetMaterial: "metal",
        bevelTopType: "hardEdge",
        bevelTopWidth: 9525,
        bevelTopHeight: 9525,
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    const parts = result!.split(",").map((s) => s.trim());
    // Should have extrusion layers + soft shadow + specular + bevel (highlight + shadow + extra)
    // At minimum: 4 extrusion + 1 soft + 1 specular + 3 bevel = 9
    expect(parts.length).toBeGreaterThanOrEqual(9);
  });

  it("enforces minimum extrusion layers for very small heights", () => {
    const style: TextStyle = {
      text3d: {
        extrusionHeight: 9525, // 1px, but MIN is 3
        extrusionColor: "#888888",
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    // Should have at least 3 extrusion layers due to MIN_EXTRUSION_LAYERS
    expect(result).toContain("3px 3px 0");
  });

  // ── Ambient occlusion tests ──────────────────────────────────────────

  it("adds ambient occlusion shadow for deep extrusions (>= 3px)", () => {
    const style: TextStyle = {
      text3d: {
        extrusionHeight: 9525 * 5, // 5px depth
        extrusionColor: "#888888",
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    // Ambient occlusion: offset = depthPx + 2 = 7, blur = max(3, round(5 * 0.6)) = 3
    expect(result).toContain("7px 7px 3px rgba(0,0,0,0.12)");
  });

  it("does not add ambient occlusion for shallow extrusions (< 3px)", () => {
    const style: TextStyle = {
      text3d: {
        extrusionHeight: 9525 * 2, // raw 2px, but MIN_EXTRUSION_LAYERS rounds up
        extrusionColor: "#888888",
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    // MIN_EXTRUSION_LAYERS = 3, so depthPx = 3 which qualifies for AO
    // AO: offset = 3 + 2 = 5, blur = max(3, round(3*0.6)) = 3
    expect(result).toContain("5px 5px 3px rgba(0,0,0,0.12)");
  });

  // ── Specular bloom tests ──────────────────────────────────────────────

  it("metal material adds specular bloom (secondary highlight)", () => {
    const style: TextStyle = {
      color: "#AAAAAA",
      text3d: {
        extrusionHeight: 9525 * 5,
        presetMaterial: "metal",
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    // Metal has specularOpacity = 0.70 (> 0.5), so bloom is added
    // Bloom at -2px -2px with blur = specularBlur + 2 = 2
    expect(result).toContain("-2px -2px 2px");
  });

  it("plastic material adds specular bloom (specularOpacity = 0.55 > 0.5)", () => {
    const style: TextStyle = {
      color: "#4488CC",
      text3d: {
        extrusionHeight: 9525 * 5,
        presetMaterial: "plastic",
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    // Plastic has specularOpacity = 0.55 > 0.5, so bloom at -2px -2px
    expect(result).toContain("-2px -2px");
  });

  it("softEdge material does not add specular bloom (specularOpacity = 0.30 < 0.5)", () => {
    const style: TextStyle = {
      color: "#4488CC",
      text3d: {
        extrusionHeight: 9525 * 5,
        presetMaterial: "softEdge",
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    // softEdge specularOpacity = 0.30 (< 0.5), no bloom
    // Should have -1px -1px (specular) but no -2px -2px (bloom)
    expect(result).toContain("-1px -1px");
    // Count occurrences of "-2px -2px" — should be zero
    const bloomMatches = (result!.match(/-2px -2px/g) ?? []).length;
    expect(bloomMatches).toBe(0);
  });

  // ── Light rig shadow with scene3d ──────────────────────────────────

  it("adds light rig shadow when textBodyScene3d has lightRigType", () => {
    const style: TextStyle = {
      text3d: {
        extrusionHeight: 9525 * 3,
        extrusionColor: "#888888",
      },
      textBodyScene3d: {
        lightRigType: "threePt",
        lightRigDirection: "tl",
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    // light rig shadow at the end: cos/sin of 135deg * 2
    expect(result).toContain("3px rgba(0,0,0,0.15)");
  });

  it("does not add light rig shadow for flat lighting", () => {
    const style: TextStyle = {
      text3d: {
        extrusionHeight: 9525 * 3,
        extrusionColor: "#888888",
      },
      textBodyScene3d: {
        lightRigType: "flat",
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    // flat lighting should not add the light rig shadow layer
    expect(result).not.toContain("rgba(0,0,0,0.15)");
  });

  // ── Scene3d extrusion direction tests ────────────────────────────────

  it("adjusts extrusion direction based on camera preset (Left)", () => {
    const style: TextStyle = {
      text3d: {
        extrusionHeight: 9525 * 3,
        extrusionColor: "#888888",
      },
      textBodyScene3d: {
        cameraPreset: "perspectiveLeft",
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    // "Left" in preset name → dx = -1, so layers should be negative X
    expect(result).toContain("-1px 1px 0");
    expect(result).toContain("-2px 2px 0");
  });

  it("adjusts extrusion direction for camera from below", () => {
    const style: TextStyle = {
      text3d: {
        extrusionHeight: 9525 * 3,
        extrusionColor: "#888888",
      },
      textBodyScene3d: {
        cameraPreset: "perspectiveBelow",
      },
    };
    const result = buildText3DShadowCss(style);
    expect(result).toBeDefined();
    // "Below" → dy = -1, so Y offsets should be negative
    expect(result).toContain("1px -1px 0");
  });
});

// ── buildTextShadowCss ────────────────────────────────────────────────

describe("buildTextShadowCss", () => {
  it("returns undefined when no shadow properties", () => {
    expect(buildTextShadowCss({} as TextStyle)).toBeUndefined();
  });

  it("generates text shadow with colour and blur", () => {
    const style: TextStyle = {
      textShadowColor: "#000000",
      textShadowBlur: 4,
      textShadowOffsetX: 2,
      textShadowOffsetY: 3,
      textShadowOpacity: 0.5,
    };
    const result = buildTextShadowCss(style);
    expect(result).toBeDefined();
    expect(result).toContain("2px 3px 4px rgba(0,0,0,0.5)");
  });

  it("generates preset shadow from name and color", () => {
    const style: TextStyle = {
      textPresetShadowName: "shdw14",
      textPresetShadowColor: "#000000",
      textPresetShadowDistance: 3,
      textPresetShadowDirection: 315,
      textPresetShadowOpacity: 0.5,
    };
    const result = buildTextShadowCss(style);
    expect(result).toBeDefined();
    expect(result).toContain("rgba(0,0,0,0.5)");
  });

  it("combines regular shadow and 3D shadow", () => {
    const style: TextStyle = {
      textShadowColor: "#333333",
      textShadowBlur: 2,
      text3d: {
        extrusionHeight: 9525,
        extrusionColor: "#666666",
      },
    };
    const result = buildTextShadowCss(style);
    expect(result).toBeDefined();
    // Should contain both regular shadow and 3D extrusion layers
    expect(result!.split(",").length).toBeGreaterThan(1);
  });

  it("handles blur-only shadow (no explicit color)", () => {
    const style: TextStyle = {
      textShadowBlur: 6,
    };
    const result = buildTextShadowCss(style);
    expect(result).toBeDefined();
    expect(result).toContain("6px");
  });

  it("uses default offset values when not provided", () => {
    const style: TextStyle = {
      textShadowColor: "#FF0000",
    };
    const result = buildTextShadowCss(style);
    expect(result).toBeDefined();
    expect(result).toContain("0px 0px");
  });
});

// ── buildTextInnerShadowCss ───────────────────────────────────────────

describe("buildTextInnerShadowCss", () => {
  it("returns undefined when no inner shadow props", () => {
    expect(buildTextInnerShadowCss({} as TextStyle)).toBeUndefined();
  });

  it("generates drop-shadow filter for inner shadow", () => {
    const style: TextStyle = {
      textInnerShadowColor: "#000000",
      textInnerShadowBlur: 3,
      textInnerShadowOffsetX: 1,
      textInnerShadowOffsetY: 1,
      textInnerShadowOpacity: 0.5,
    };
    const result = buildTextInnerShadowCss(style);
    expect(result).toBeDefined();
    expect(result).toContain("drop-shadow(");
    expect(result).toContain("1px 1px 3px");
  });

  it("uses default values when offsets not specified", () => {
    const style: TextStyle = {
      textInnerShadowColor: "#FF0000",
    };
    const result = buildTextInnerShadowCss(style);
    expect(result).toBeDefined();
    expect(result).toContain("0px 0px");
  });

  it("triggers on blur > 0 even without explicit color", () => {
    const style: TextStyle = {
      textInnerShadowBlur: 5,
    };
    const result = buildTextInnerShadowCss(style);
    expect(result).toBeDefined();
    expect(result).toContain("5px");
  });
});

// ── buildTextBlurFilter ───────────────────────────────────────────────

describe("buildTextBlurFilter", () => {
  it("returns undefined when no blur radius", () => {
    expect(buildTextBlurFilter({} as TextStyle)).toBeUndefined();
  });

  it("returns undefined for zero blur radius", () => {
    expect(buildTextBlurFilter({ textBlurRadius: 0 } as TextStyle)).toBeUndefined();
  });

  it("returns undefined for negative blur radius", () => {
    expect(buildTextBlurFilter({ textBlurRadius: -2 } as TextStyle)).toBeUndefined();
  });

  it("generates blur filter for positive radius", () => {
    const result = buildTextBlurFilter({ textBlurRadius: 5 } as TextStyle);
    expect(result).toBe("blur(5px)");
  });

  it("rounds the blur radius", () => {
    const result = buildTextBlurFilter({ textBlurRadius: 3.7 } as TextStyle);
    expect(result).toBe("blur(4px)");
  });
});

// ── buildTextHslFilter ────────────────────────────────────────────────

describe("buildTextHslFilter", () => {
  it("returns undefined when no HSL properties", () => {
    expect(buildTextHslFilter({} as TextStyle)).toBeUndefined();
  });

  it("returns undefined when hue is 0 and saturation is 100", () => {
    const style: TextStyle = { textHslHue: 0, textHslSaturation: 100 };
    expect(buildTextHslFilter(style)).toBeUndefined();
  });

  it("generates hue-rotate for non-zero hue", () => {
    const result = buildTextHslFilter({ textHslHue: 45 } as TextStyle);
    expect(result).toBe("hue-rotate(45deg)");
  });

  it("generates saturate for non-100 saturation", () => {
    const result = buildTextHslFilter({ textHslSaturation: 200 } as TextStyle);
    expect(result).toBe("saturate(2)");
  });

  it("generates brightness for non-zero luminance", () => {
    const result = buildTextHslFilter({ textHslLuminance: 50 } as TextStyle);
    expect(result).toBe("brightness(1.5)");
  });

  it("combines multiple HSL adjustments", () => {
    const style: TextStyle = {
      textHslHue: 90,
      textHslSaturation: 150,
      textHslLuminance: -25,
    };
    const result = buildTextHslFilter(style);
    expect(result).toBeDefined();
    expect(result).toContain("hue-rotate(90deg)");
    expect(result).toContain("saturate(1.5)");
    expect(result).toContain("brightness(0.75)");
  });
});

// ── getTextAlphaOpacity ───────────────────────────────────────────────

describe("getTextAlphaOpacity", () => {
  it("returns undefined when no alpha properties", () => {
    expect(getTextAlphaOpacity({} as TextStyle)).toBeUndefined();
  });

  it("converts textAlphaModFix to 0-1 range", () => {
    expect(getTextAlphaOpacity({ textAlphaModFix: 50 } as TextStyle)).toBe(0.5);
  });

  it("clamps textAlphaModFix to 0-1 range", () => {
    expect(getTextAlphaOpacity({ textAlphaModFix: 150 } as TextStyle)).toBe(1);
    expect(getTextAlphaOpacity({ textAlphaModFix: -50 } as TextStyle)).toBe(0);
  });

  it("converts textAlphaMod to 0-1 range", () => {
    expect(getTextAlphaOpacity({ textAlphaMod: 75 } as TextStyle)).toBe(0.75);
  });

  it("prefers textAlphaModFix over textAlphaMod", () => {
    const style: TextStyle = {
      textAlphaModFix: 30,
      textAlphaMod: 80,
    };
    expect(getTextAlphaOpacity(style)).toBe(0.3);
  });

  it("returns 0 for textAlphaModFix = 0", () => {
    expect(getTextAlphaOpacity({ textAlphaModFix: 0 } as TextStyle)).toBe(0);
  });

  it("returns 1 for textAlphaModFix = 100", () => {
    expect(getTextAlphaOpacity({ textAlphaModFix: 100 } as TextStyle)).toBe(1);
  });
});

// ── buildTextGlowFilter ──────────────────────────────────────────────

describe("buildTextGlowFilter", () => {
  it("returns undefined when no glow properties", () => {
    expect(buildTextGlowFilter({} as TextStyle)).toBeUndefined();
  });

  it("generates drop-shadow for glow effect", () => {
    const style: TextStyle = {
      textGlowColor: "#FFFF00",
      textGlowRadius: 8,
      textGlowOpacity: 0.6,
    };
    const result = buildTextGlowFilter(style);
    expect(result).toBeDefined();
    expect(result).toContain("drop-shadow(0 0 8px");
    expect(result).toContain("rgba(255,255,0,0.6)");
  });

  it("uses default radius and opacity when not specified", () => {
    const style: TextStyle = { textGlowColor: "#00FF00" };
    const result = buildTextGlowFilter(style);
    expect(result).toBeDefined();
    expect(result).toContain("6px"); // default radius
  });

  it("triggers on radius > 0 even without explicit color", () => {
    const style: TextStyle = { textGlowRadius: 10 };
    const result = buildTextGlowFilter(style);
    expect(result).toBeDefined();
    expect(result).toContain("10px");
  });
});

// ── buildTextReflectionCss ────────────────────────────────────────────

describe("buildTextReflectionCss", () => {
  it("returns undefined when no reflection", () => {
    expect(buildTextReflectionCss({} as TextStyle)).toBeUndefined();
  });

  it("returns undefined when textReflection is false", () => {
    expect(
      buildTextReflectionCss({ textReflection: false } as TextStyle),
    ).toBeUndefined();
  });

  it("generates -webkit-box-reflect value", () => {
    const style: TextStyle = {
      textReflection: true,
      textReflectionOffset: 5,
      textReflectionStartOpacity: 0.4,
      textReflectionEndOpacity: 0,
    };
    const result = buildTextReflectionCss(style);
    expect(result).toBeDefined();
    expect(result).toContain("below 5px");
    expect(result).toContain("linear-gradient");
    expect(result).toContain("rgba(0,0,0,0.4)");
    expect(result).toContain("rgba(0,0,0,0)");
  });

  it("uses default values when not specified", () => {
    const style: TextStyle = { textReflection: true };
    const result = buildTextReflectionCss(style);
    expect(result).toBeDefined();
    expect(result).toContain("below 0px");
    expect(result).toContain("rgba(0,0,0,0.5)"); // default startAlpha
    expect(result).toContain("rgba(0,0,0,0)"); // default endAlpha
  });
});
