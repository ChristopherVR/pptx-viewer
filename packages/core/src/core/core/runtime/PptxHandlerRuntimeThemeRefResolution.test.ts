import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Extracted logic from PptxHandlerRuntimeThemeRefResolution
// ---------------------------------------------------------------------------

interface ShapeStyle {
  fillMode?: string;
  fillColor?: string;
  fillOpacity?: number;
  fillGradient?: string;
  fillGradientStops?: Array<{ position: number; color: string }>;
  fillGradientAngle?: number;
  fillGradientType?: string;
  fillPatternPreset?: string;
  fillPatternBackgroundColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  strokeDash?: string;
  lineJoin?: string;
  lineCap?: string;
  compoundLine?: string;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  innerShadowColor?: string;
  innerShadowBlur?: number;
  innerShadowOffsetX?: number;
  innerShadowOffsetY?: number;
  innerShadowOpacity?: number;
  glowColor?: string;
  glowRadius?: number;
  glowOpacity?: number;
  softEdgeRadius?: number;
}

interface EffectStyleDef {
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  innerShadowColor?: string;
  innerShadowBlur?: number;
  innerShadowOffsetX?: number;
  innerShadowOffsetY?: number;
  innerShadowOpacity?: number;
  glowColor?: string;
  glowRadius?: number;
  glowOpacity?: number;
  softEdgeRadius?: number;
}

interface LineStyleDef {
  color?: string;
  opacity?: number;
  width?: number;
  dash?: string;
  lineJoin?: string;
  lineCap?: string;
  compoundLine?: string;
}

interface ThemeFormatScheme {
  effectStyles: EffectStyleDef[];
  lineStyles: LineStyleDef[];
  fillStyles: FillStyleDef[];
  backgroundFillStyles: FillStyleDef[];
}

interface FillStyleDef {
  kind: "solid" | "gradient" | "pattern" | "none";
  color?: string;
  opacity?: number;
  gradientStops?: Array<{ position: number; color: string }>;
  gradientCss?: string;
  gradientAngle?: number;
  gradientType?: string;
  rawNode?: unknown;
  patternPreset?: string;
  patternBackgroundColor?: string;
}

/**
 * Extracted from resolveThemeEffectRef
 */
function resolveThemeEffectRef(
  refIdx: number,
  style: ShapeStyle,
  themeFormatScheme: ThemeFormatScheme | undefined,
): void {
  if (
    !Number.isFinite(refIdx) ||
    refIdx <= 0 ||
    !themeFormatScheme ||
    refIdx > themeFormatScheme.effectStyles.length
  ) {
    return;
  }

  const effectDef = themeFormatScheme.effectStyles[refIdx - 1];
  if (!effectDef) return;

  if (effectDef.shadowColor && !style.shadowColor) {
    style.shadowColor = effectDef.shadowColor;
    style.shadowBlur = effectDef.shadowBlur;
    style.shadowOffsetX = effectDef.shadowOffsetX;
    style.shadowOffsetY = effectDef.shadowOffsetY;
    style.shadowOpacity = effectDef.shadowOpacity;
  }

  if (effectDef.innerShadowColor && !style.innerShadowColor) {
    style.innerShadowColor = effectDef.innerShadowColor;
    style.innerShadowBlur = effectDef.innerShadowBlur;
    style.innerShadowOffsetX = effectDef.innerShadowOffsetX;
    style.innerShadowOffsetY = effectDef.innerShadowOffsetY;
    style.innerShadowOpacity = effectDef.innerShadowOpacity;
  }

  if (effectDef.glowColor && !style.glowColor) {
    style.glowColor = effectDef.glowColor;
    style.glowRadius = effectDef.glowRadius;
    style.glowOpacity = effectDef.glowOpacity;
  }

  if (effectDef.softEdgeRadius && !style.softEdgeRadius) {
    style.softEdgeRadius = effectDef.softEdgeRadius;
  }
}

/**
 * Extracted from resolveThemeLineRef
 */
function resolveThemeLineRef(
  refIdx: number,
  style: ShapeStyle,
  themeFormatScheme: ThemeFormatScheme | undefined,
  overrideColor: string | undefined,
): void {
  if (
    !Number.isFinite(refIdx) ||
    refIdx <= 0 ||
    !themeFormatScheme ||
    refIdx > themeFormatScheme.lineStyles.length
  ) {
    style.strokeColor = overrideColor;
    if (overrideColor) {
      style.strokeWidth = 1;
    }
    return;
  }

  const lineDef = themeFormatScheme.lineStyles[refIdx - 1];
  if (!lineDef) {
    style.strokeColor = overrideColor;
    if (overrideColor) {
      style.strokeWidth = 1;
    }
    return;
  }

  style.strokeColor = overrideColor || lineDef.color;
  if (lineDef.opacity !== undefined) {
    style.strokeOpacity = lineDef.opacity;
  }
  if (lineDef.width !== undefined && lineDef.width > 0) {
    style.strokeWidth = lineDef.width;
  } else if (style.strokeColor) {
    style.strokeWidth = 1;
  }
  if (lineDef.dash) {
    style.strokeDash = lineDef.dash;
  }
  if (lineDef.lineJoin) {
    style.lineJoin = lineDef.lineJoin;
  }
  if (lineDef.lineCap) {
    style.lineCap = lineDef.lineCap;
  }
  if (lineDef.compoundLine) {
    style.compoundLine = lineDef.compoundLine;
  }
}

/**
 * Extracted from resolveThemeFillRef (simplified, without gradient re-resolve).
 */
function resolveThemeFillRef(
  refIdx: number,
  style: ShapeStyle,
  themeFormatScheme: ThemeFormatScheme | undefined,
  overrideColor: string | undefined,
): void {
  if (!Number.isFinite(refIdx) || refIdx <= 0 || !themeFormatScheme) {
    style.fillMode = "theme";
    style.fillColor = overrideColor;
    return;
  }

  let fillDef: FillStyleDef | undefined;
  if (refIdx >= 1001) {
    const offset = refIdx - 1001;
    fillDef = themeFormatScheme.backgroundFillStyles[offset];
  } else {
    fillDef = themeFormatScheme.fillStyles[refIdx - 1];
  }

  if (!fillDef) {
    style.fillMode = "theme";
    style.fillColor = overrideColor;
    return;
  }

  switch (fillDef.kind) {
    case "solid": {
      style.fillMode = "solid";
      style.fillColor = overrideColor || fillDef.color;
      style.fillOpacity = fillDef.opacity;
      break;
    }
    case "gradient": {
      style.fillMode = "gradient";
      style.fillGradientStops = fillDef.gradientStops;
      style.fillGradient = fillDef.gradientCss;
      style.fillGradientAngle = fillDef.gradientAngle;
      style.fillGradientType = fillDef.gradientType;
      style.fillColor = overrideColor || fillDef.color;
      break;
    }
    case "pattern": {
      style.fillMode = "pattern";
      style.fillColor = overrideColor || fillDef.color;
      if (fillDef.patternPreset) {
        style.fillPatternPreset = fillDef.patternPreset;
      }
      if (fillDef.patternBackgroundColor) {
        style.fillPatternBackgroundColor = fillDef.patternBackgroundColor;
      }
      break;
    }
    case "none": {
      style.fillMode = "none";
      style.fillColor = "transparent";
      style.fillOpacity = 0;
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Tests: resolveThemeEffectRef
// ---------------------------------------------------------------------------
describe("resolveThemeEffectRef", () => {
  const scheme: ThemeFormatScheme = {
    effectStyles: [
      { shadowColor: "#000", shadowBlur: 4, shadowOffsetX: 2, shadowOffsetY: 2, shadowOpacity: 0.5 },
      { glowColor: "#ff0", glowRadius: 8, glowOpacity: 0.7 },
      { softEdgeRadius: 5 },
    ],
    lineStyles: [],
    fillStyles: [],
    backgroundFillStyles: [],
  };

  it("should do nothing for idx 0", () => {
    const style: ShapeStyle = {};
    resolveThemeEffectRef(0, style, scheme);
    expect(style).toEqual({});
  });

  it("should do nothing for negative idx", () => {
    const style: ShapeStyle = {};
    resolveThemeEffectRef(-1, style, scheme);
    expect(style).toEqual({});
  });

  it("should do nothing when scheme is undefined", () => {
    const style: ShapeStyle = {};
    resolveThemeEffectRef(1, style, undefined);
    expect(style).toEqual({});
  });

  it("should do nothing for idx exceeding list length", () => {
    const style: ShapeStyle = {};
    resolveThemeEffectRef(10, style, scheme);
    expect(style).toEqual({});
  });

  it("should apply shadow from effect style 1 (idx=1)", () => {
    const style: ShapeStyle = {};
    resolveThemeEffectRef(1, style, scheme);
    expect(style.shadowColor).toBe("#000");
    expect(style.shadowBlur).toBe(4);
    expect(style.shadowOffsetX).toBe(2);
    expect(style.shadowOffsetY).toBe(2);
    expect(style.shadowOpacity).toBe(0.5);
  });

  it("should not override existing shadow", () => {
    const style: ShapeStyle = { shadowColor: "#fff" };
    resolveThemeEffectRef(1, style, scheme);
    expect(style.shadowColor).toBe("#fff");
  });

  it("should apply glow from effect style 2 (idx=2)", () => {
    const style: ShapeStyle = {};
    resolveThemeEffectRef(2, style, scheme);
    expect(style.glowColor).toBe("#ff0");
    expect(style.glowRadius).toBe(8);
    expect(style.glowOpacity).toBe(0.7);
  });

  it("should not override existing glow", () => {
    const style: ShapeStyle = { glowColor: "#abc" };
    resolveThemeEffectRef(2, style, scheme);
    expect(style.glowColor).toBe("#abc");
  });

  it("should apply soft edge from effect style 3 (idx=3)", () => {
    const style: ShapeStyle = {};
    resolveThemeEffectRef(3, style, scheme);
    expect(style.softEdgeRadius).toBe(5);
  });

  it("should not override existing soft edge", () => {
    const style: ShapeStyle = { softEdgeRadius: 10 };
    resolveThemeEffectRef(3, style, scheme);
    expect(style.softEdgeRadius).toBe(10);
  });

  it("should handle NaN idx", () => {
    const style: ShapeStyle = {};
    resolveThemeEffectRef(NaN, style, scheme);
    expect(style).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Tests: resolveThemeLineRef
// ---------------------------------------------------------------------------
describe("resolveThemeLineRef", () => {
  const scheme: ThemeFormatScheme = {
    effectStyles: [],
    lineStyles: [
      { color: "#aaa", width: 2, opacity: 0.8, dash: "dash", lineJoin: "round", lineCap: "flat", compoundLine: "sng" },
      { color: "#bbb", width: 0 },
      { color: "#ccc" },
    ],
    fillStyles: [],
    backgroundFillStyles: [],
  };

  it("should fall back to override color when idx is 0", () => {
    const style: ShapeStyle = {};
    resolveThemeLineRef(0, style, scheme, "#red");
    expect(style.strokeColor).toBe("#red");
    expect(style.strokeWidth).toBe(1);
  });

  it("should set undefined stroke when no override and idx is 0", () => {
    const style: ShapeStyle = {};
    resolveThemeLineRef(0, style, scheme, undefined);
    expect(style.strokeColor).toBeUndefined();
    expect(style.strokeWidth).toBeUndefined();
  });

  it("should fall back when scheme is undefined", () => {
    const style: ShapeStyle = {};
    resolveThemeLineRef(1, style, undefined, "#abc");
    expect(style.strokeColor).toBe("#abc");
    expect(style.strokeWidth).toBe(1);
  });

  it("should apply all line properties from style 1 (idx=1)", () => {
    const style: ShapeStyle = {};
    resolveThemeLineRef(1, style, scheme, undefined);
    expect(style.strokeColor).toBe("#aaa");
    expect(style.strokeWidth).toBe(2);
    expect(style.strokeOpacity).toBe(0.8);
    expect(style.strokeDash).toBe("dash");
    expect(style.lineJoin).toBe("round");
    expect(style.lineCap).toBe("flat");
    expect(style.compoundLine).toBe("sng");
  });

  it("should prefer override color over line def color", () => {
    const style: ShapeStyle = {};
    resolveThemeLineRef(1, style, scheme, "#override");
    expect(style.strokeColor).toBe("#override");
  });

  it("should default width to 1 when line def width is 0 and color exists", () => {
    const style: ShapeStyle = {};
    resolveThemeLineRef(2, style, scheme, undefined);
    expect(style.strokeColor).toBe("#bbb");
    expect(style.strokeWidth).toBe(1);
  });

  it("should default width to 1 when line def has no width and color exists", () => {
    const style: ShapeStyle = {};
    resolveThemeLineRef(3, style, scheme, undefined);
    expect(style.strokeColor).toBe("#ccc");
    expect(style.strokeWidth).toBe(1);
  });

  it("should fall back when idx exceeds list length", () => {
    const style: ShapeStyle = {};
    resolveThemeLineRef(10, style, scheme, "#fallback");
    expect(style.strokeColor).toBe("#fallback");
    expect(style.strokeWidth).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: resolveThemeFillRef
// ---------------------------------------------------------------------------
describe("resolveThemeFillRef", () => {
  const scheme: ThemeFormatScheme = {
    effectStyles: [],
    lineStyles: [],
    fillStyles: [
      { kind: "solid", color: "#solid1", opacity: 0.9 },
      {
        kind: "gradient",
        color: "#grad1",
        gradientStops: [{ position: 0, color: "#a" }, { position: 1, color: "#b" }],
        gradientCss: "linear-gradient(#a, #b)",
        gradientAngle: 90,
        gradientType: "linear",
      },
      { kind: "pattern", color: "#pat1", patternPreset: "dkDnDiag", patternBackgroundColor: "#white" },
    ],
    backgroundFillStyles: [
      { kind: "none" },
      { kind: "solid", color: "#bg1" },
    ],
  };

  it("should fall back to theme mode when idx is 0", () => {
    const style: ShapeStyle = {};
    resolveThemeFillRef(0, style, scheme, "#override");
    expect(style.fillMode).toBe("theme");
    expect(style.fillColor).toBe("#override");
  });

  it("should fall back when scheme is undefined", () => {
    const style: ShapeStyle = {};
    resolveThemeFillRef(1, style, undefined, "#override");
    expect(style.fillMode).toBe("theme");
    expect(style.fillColor).toBe("#override");
  });

  it("should apply solid fill from idx=1", () => {
    const style: ShapeStyle = {};
    resolveThemeFillRef(1, style, scheme, undefined);
    expect(style.fillMode).toBe("solid");
    expect(style.fillColor).toBe("#solid1");
    expect(style.fillOpacity).toBe(0.9);
  });

  it("should use override color for solid fill", () => {
    const style: ShapeStyle = {};
    resolveThemeFillRef(1, style, scheme, "#override");
    expect(style.fillMode).toBe("solid");
    expect(style.fillColor).toBe("#override");
  });

  it("should apply gradient fill from idx=2", () => {
    const style: ShapeStyle = {};
    resolveThemeFillRef(2, style, scheme, undefined);
    expect(style.fillMode).toBe("gradient");
    expect(style.fillGradientStops).toHaveLength(2);
    expect(style.fillGradient).toBe("linear-gradient(#a, #b)");
    expect(style.fillGradientAngle).toBe(90);
    expect(style.fillGradientType).toBe("linear");
    expect(style.fillColor).toBe("#grad1");
  });

  it("should apply pattern fill from idx=3", () => {
    const style: ShapeStyle = {};
    resolveThemeFillRef(3, style, scheme, undefined);
    expect(style.fillMode).toBe("pattern");
    expect(style.fillColor).toBe("#pat1");
    expect(style.fillPatternPreset).toBe("dkDnDiag");
    expect(style.fillPatternBackgroundColor).toBe("#white");
  });

  it("should apply none fill from bgFillStyle idx=1001", () => {
    const style: ShapeStyle = {};
    resolveThemeFillRef(1001, style, scheme, undefined);
    expect(style.fillMode).toBe("none");
    expect(style.fillColor).toBe("transparent");
    expect(style.fillOpacity).toBe(0);
  });

  it("should apply solid bgFill from idx=1002", () => {
    const style: ShapeStyle = {};
    resolveThemeFillRef(1002, style, scheme, undefined);
    expect(style.fillMode).toBe("solid");
    expect(style.fillColor).toBe("#bg1");
  });

  it("should fall back when bgFill idx is out of range", () => {
    const style: ShapeStyle = {};
    resolveThemeFillRef(1010, style, scheme, "#fb");
    expect(style.fillMode).toBe("theme");
    expect(style.fillColor).toBe("#fb");
  });

  it("should fall back when fill idx exceeds fillStyles length", () => {
    const style: ShapeStyle = {};
    resolveThemeFillRef(99, style, scheme, "#fb2");
    expect(style.fillMode).toBe("theme");
    expect(style.fillColor).toBe("#fb2");
  });

  it("should use override color for pattern fill", () => {
    const style: ShapeStyle = {};
    resolveThemeFillRef(3, style, scheme, "#patOverride");
    expect(style.fillColor).toBe("#patOverride");
  });
});
