import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  interpolateColor,
  buildColorAnimationKeyframes,
  buildDynamicKeyframe,
} from "./animation-timeline-helpers";
import type { PptxNativeAnimation } from "pptx-viewer-core";
import type { PptxColorAnimation } from "pptx-viewer-core";

// ==========================================================================
// hexToRgb
// ==========================================================================

describe("hexToRgb", () => {
  it("parses #RRGGBB format", () => {
    expect(hexToRgb("#FF0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("parses RRGGBB format without hash", () => {
    expect(hexToRgb("00FF00")).toEqual({ r: 0, g: 255, b: 0 });
  });

  it("parses blue", () => {
    expect(hexToRgb("#0000FF")).toEqual({ r: 0, g: 0, b: 255 });
  });

  it("parses white", () => {
    expect(hexToRgb("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("parses black", () => {
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("parses mixed color", () => {
    expect(hexToRgb("#AB12CD")).toEqual({ r: 171, g: 18, b: 205 });
  });

  it("handles lowercase hex", () => {
    expect(hexToRgb("#ff8800")).toEqual({ r: 255, g: 136, b: 0 });
  });
});

// ==========================================================================
// rgbToHex
// ==========================================================================

describe("rgbToHex", () => {
  it("converts red", () => {
    expect(rgbToHex(255, 0, 0)).toBe("#ff0000");
  });

  it("converts green", () => {
    expect(rgbToHex(0, 255, 0)).toBe("#00ff00");
  });

  it("converts blue", () => {
    expect(rgbToHex(0, 0, 255)).toBe("#0000ff");
  });

  it("converts white", () => {
    expect(rgbToHex(255, 255, 255)).toBe("#ffffff");
  });

  it("converts black", () => {
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
  });

  it("clamps values above 255", () => {
    expect(rgbToHex(300, 0, 0)).toBe("#ff0000");
  });

  it("clamps values below 0", () => {
    expect(rgbToHex(-10, 0, 0)).toBe("#000000");
  });

  it("rounds fractional values", () => {
    expect(rgbToHex(127.6, 0, 0)).toBe("#800000");
  });
});

// ==========================================================================
// rgbToHsl
// ==========================================================================

describe("rgbToHsl", () => {
  it("converts pure red to HSL", () => {
    const hsl = rgbToHsl(255, 0, 0);
    expect(hsl.h).toBeCloseTo(0, 0);
    expect(hsl.s).toBeCloseTo(100, 0);
    expect(hsl.l).toBeCloseTo(50, 0);
  });

  it("converts pure green to HSL", () => {
    const hsl = rgbToHsl(0, 255, 0);
    expect(hsl.h).toBeCloseTo(120, 0);
    expect(hsl.s).toBeCloseTo(100, 0);
    expect(hsl.l).toBeCloseTo(50, 0);
  });

  it("converts pure blue to HSL", () => {
    const hsl = rgbToHsl(0, 0, 255);
    expect(hsl.h).toBeCloseTo(240, 0);
    expect(hsl.s).toBeCloseTo(100, 0);
    expect(hsl.l).toBeCloseTo(50, 0);
  });

  it("converts white to HSL", () => {
    const hsl = rgbToHsl(255, 255, 255);
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBeCloseTo(100, 0);
  });

  it("converts black to HSL", () => {
    const hsl = rgbToHsl(0, 0, 0);
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBe(0);
  });

  it("converts gray to HSL", () => {
    const hsl = rgbToHsl(128, 128, 128);
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBeCloseTo(50, 0);
  });
});

// ==========================================================================
// hslToRgb
// ==========================================================================

describe("hslToRgb", () => {
  it("converts pure red HSL to RGB", () => {
    const rgb = hslToRgb(0, 100, 50);
    expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("converts pure green HSL to RGB", () => {
    const rgb = hslToRgb(120, 100, 50);
    expect(rgb).toEqual({ r: 0, g: 255, b: 0 });
  });

  it("converts pure blue HSL to RGB", () => {
    const rgb = hslToRgb(240, 100, 50);
    expect(rgb).toEqual({ r: 0, g: 0, b: 255 });
  });

  it("converts white HSL to RGB", () => {
    const rgb = hslToRgb(0, 0, 100);
    expect(rgb).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("converts black HSL to RGB", () => {
    const rgb = hslToRgb(0, 0, 0);
    expect(rgb).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("converts achromatic gray", () => {
    const rgb = hslToRgb(0, 0, 50);
    expect(rgb).toEqual({ r: 128, g: 128, b: 128 });
  });

  it("round-trips with rgbToHsl", () => {
    const original = { r: 123, g: 45, b: 200 };
    const hsl = rgbToHsl(original.r, original.g, original.b);
    const roundTripped = hslToRgb(hsl.h, hsl.s, hsl.l);
    expect(roundTripped.r).toBeCloseTo(original.r, 0);
    expect(roundTripped.g).toBeCloseTo(original.g, 0);
    expect(roundTripped.b).toBeCloseTo(original.b, 0);
  });
});

// ==========================================================================
// interpolateColor — RGB mode
// ==========================================================================

describe("interpolateColor (RGB)", () => {
  it("returns from color at t=0", () => {
    expect(interpolateColor("#FF0000", "#0000FF", 0, "rgb")).toBe("#ff0000");
  });

  it("returns to color at t=1", () => {
    expect(interpolateColor("#FF0000", "#0000FF", 1, "rgb")).toBe("#0000ff");
  });

  it("interpolates midpoint correctly", () => {
    const mid = interpolateColor("#FF0000", "#0000FF", 0.5, "rgb");
    const rgb = hexToRgb(mid);
    expect(rgb.r).toBeCloseTo(128, 0);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBeCloseTo(128, 0);
  });

  it("interpolates between black and white at midpoint", () => {
    const mid = interpolateColor("#000000", "#FFFFFF", 0.5, "rgb");
    const rgb = hexToRgb(mid);
    expect(rgb.r).toBeCloseTo(128, 0);
    expect(rgb.g).toBeCloseTo(128, 0);
    expect(rgb.b).toBeCloseTo(128, 0);
  });

  it("handles identical colors", () => {
    expect(interpolateColor("#AABBCC", "#AABBCC", 0.5, "rgb")).toBe("#aabbcc");
  });
});

// ==========================================================================
// interpolateColor — HSL mode
// ==========================================================================

describe("interpolateColor (HSL)", () => {
  it("returns from color at t=0", () => {
    const result = interpolateColor("#FF0000", "#0000FF", 0, "hsl", "cw");
    expect(hexToRgb(result).r).toBeCloseTo(255, 0);
    expect(hexToRgb(result).g).toBeCloseTo(0, 0);
    expect(hexToRgb(result).b).toBeCloseTo(0, 0);
  });

  it("returns to color at t=1", () => {
    const result = interpolateColor("#FF0000", "#0000FF", 1, "hsl", "cw");
    expect(hexToRgb(result).r).toBeCloseTo(0, 0);
    expect(hexToRgb(result).g).toBeCloseTo(0, 0);
    expect(hexToRgb(result).b).toBeCloseTo(255, 0);
  });

  it("clockwise from red to green goes through yellow", () => {
    // Red (h=0) -> Green (h=120) clockwise: passes through yellow (h=60) at t=0.5
    const mid = interpolateColor("#FF0000", "#00FF00", 0.5, "hsl", "cw");
    const rgb = hexToRgb(mid);
    // At hue=60, saturation=100, lightness=50 we expect yellow (#FFFF00)
    expect(rgb.r).toBeCloseTo(255, -1);
    expect(rgb.g).toBeCloseTo(255, -1);
    expect(rgb.b).toBeCloseTo(0, -1);
  });

  it("counter-clockwise from red to green goes through blue/magenta", () => {
    // Red (h=0) -> Green (h=120) CCW: goes the long way through blue
    // At t=0.5, hue should be around 300 (magenta area) or 240 (blue area)
    const mid = interpolateColor("#FF0000", "#00FF00", 0.5, "hsl", "ccw");
    const rgb = hexToRgb(mid);
    // CCW from 0 to 120: delta = 120 - 0 = 120 > 0, so we subtract 360 => delta = -240
    // At t=0.5: hue = 0 + (-240 * 0.5) = -120 => normalized = 240 (blue)
    expect(rgb.r).toBeCloseTo(0, -1);
    expect(rgb.g).toBeCloseTo(0, -1);
    expect(rgb.b).toBeCloseTo(255, -1);
  });

  it("defaults direction to cw when not specified", () => {
    const cw = interpolateColor("#FF0000", "#00FF00", 0.5, "hsl", "cw");
    const def = interpolateColor("#FF0000", "#00FF00", 0.5, "hsl");
    expect(cw).toBe(def);
  });
});

// ==========================================================================
// buildColorAnimationKeyframes
// ==========================================================================

describe("buildColorAnimationKeyframes", () => {
  it("generates keyframes for RGB from-to animation", () => {
    const anim: PptxColorAnimation = {
      colorSpace: "rgb",
      fromColor: "#FF0000",
      toColor: "#0000FF",
    };
    const css = buildColorAnimationKeyframes(anim, "test-color", 4);
    expect(css).toBeDefined();
    expect(css).toContain("@keyframes test-color");
    expect(css).toContain("0% { color:");
    expect(css).toContain("100% { color:");
  });

  it("generates correct number of keyframe stops", () => {
    const anim: PptxColorAnimation = {
      colorSpace: "rgb",
      fromColor: "#FF0000",
      toColor: "#0000FF",
    };
    const css = buildColorAnimationKeyframes(anim, "test-color", 4);
    expect(css).toBeDefined();
    // 4 steps means 5 stops: 0%, 25%, 50%, 75%, 100%
    const stops = css!.match(/\d+% \{/g);
    expect(stops).toHaveLength(5);
  });

  it("generates HSL keyframes with CW direction", () => {
    const anim: PptxColorAnimation = {
      colorSpace: "hsl",
      direction: "cw",
      fromColor: "#FF0000",
      toColor: "#00FF00",
    };
    const css = buildColorAnimationKeyframes(anim, "hsl-cw", 4);
    expect(css).toBeDefined();
    expect(css).toContain("@keyframes hsl-cw");
    // The midpoint (50%) should be yellow-ish since CW red->green goes through yellow
    expect(css).toContain("50% { color:");
  });

  it("generates HSL keyframes with CCW direction", () => {
    const anim: PptxColorAnimation = {
      colorSpace: "hsl",
      direction: "ccw",
      fromColor: "#FF0000",
      toColor: "#00FF00",
    };
    const css = buildColorAnimationKeyframes(anim, "hsl-ccw", 4);
    expect(css).toBeDefined();
    expect(css).toContain("@keyframes hsl-ccw");
  });

  it("handles 'by' animation (fromColor + byColor)", () => {
    const anim: PptxColorAnimation = {
      colorSpace: "rgb",
      fromColor: "#100000",
      byColor: "#001000",
    };
    const css = buildColorAnimationKeyframes(anim, "by-color", 2);
    expect(css).toBeDefined();
    expect(css).toContain("@keyframes by-color");
    // From #100000 + by #001000 => to #101000
    expect(css).toContain("100% { color:");
  });

  it("handles toColor-only animation (defaults from to black)", () => {
    const anim: PptxColorAnimation = {
      colorSpace: "rgb",
      toColor: "#FFFFFF",
    };
    const css = buildColorAnimationKeyframes(anim, "to-only", 2);
    expect(css).toBeDefined();
    // Should interpolate from #000000 to #FFFFFF
    expect(css).toContain("0% { color: #000000; }");
    expect(css).toContain("100% { color: #ffffff; }");
  });

  it("returns undefined when no colors are specified", () => {
    const anim: PptxColorAnimation = {
      colorSpace: "rgb",
    };
    const css = buildColorAnimationKeyframes(anim, "no-colors");
    expect(css).toBeUndefined();
  });

  it("enforces minimum of 2 steps", () => {
    const anim: PptxColorAnimation = {
      colorSpace: "rgb",
      fromColor: "#FF0000",
      toColor: "#0000FF",
    };
    const css = buildColorAnimationKeyframes(anim, "min-steps", 1);
    expect(css).toBeDefined();
    // Should still produce at least 0% and 100%
    const stops = css!.match(/\d+% \{/g);
    expect(stops!.length).toBeGreaterThanOrEqual(2);
  });

  it("uses default 10 steps when steps not specified", () => {
    const anim: PptxColorAnimation = {
      colorSpace: "rgb",
      fromColor: "#FF0000",
      toColor: "#0000FF",
    };
    const css = buildColorAnimationKeyframes(anim, "default-steps");
    expect(css).toBeDefined();
    // 10 steps = 11 stops
    const stops = css!.match(/\d+% \{/g);
    expect(stops).toHaveLength(11);
  });

  it("start and end colors match input for RGB mode", () => {
    const anim: PptxColorAnimation = {
      colorSpace: "rgb",
      fromColor: "#FF0000",
      toColor: "#0000FF",
    };
    const css = buildColorAnimationKeyframes(anim, "match-test", 2);
    expect(css).toBeDefined();
    expect(css).toContain("0% { color: #ff0000; }");
    expect(css).toContain("100% { color: #0000ff; }");
  });
});

// ==========================================================================
// buildDynamicKeyframe with colorAnimation
// ==========================================================================

describe("buildDynamicKeyframe with colorAnimation", () => {
  it("generates color keyframes when colorAnimation is present", () => {
    const anim = {
      colorAnimation: {
        colorSpace: "rgb" as const,
        fromColor: "#FF0000",
        toColor: "#00FF00",
      },
    } as unknown as PptxNativeAnimation;

    const result = buildDynamicKeyframe(anim, 99);
    expect(result).toBeDefined();
    expect(result!.keyframeName).toBe("pptx-tl-color-99");
    expect(result!.css).toContain("@keyframes pptx-tl-color-99");
    expect(result!.css).toContain("color:");
  });

  it("returns undefined for colorAnimation with no colors", () => {
    const anim = {
      colorAnimation: {
        colorSpace: "rgb" as const,
      },
    } as unknown as PptxNativeAnimation;

    const result = buildDynamicKeyframe(anim, 1);
    expect(result).toBeUndefined();
  });

  it("prefers motionPath over colorAnimation", () => {
    const anim = {
      motionPath: "M 0,0 L 1,1",
      colorAnimation: {
        colorSpace: "rgb" as const,
        fromColor: "#FF0000",
        toColor: "#00FF00",
      },
    } as unknown as PptxNativeAnimation;

    const result = buildDynamicKeyframe(anim, 5);
    expect(result).toBeDefined();
    expect(result!.keyframeName).toContain("motion");
  });

  it("handles HSL color animation with direction", () => {
    const anim = {
      colorAnimation: {
        colorSpace: "hsl" as const,
        direction: "ccw" as const,
        fromColor: "#FF0000",
        toColor: "#0000FF",
      },
    } as unknown as PptxNativeAnimation;

    const result = buildDynamicKeyframe(anim, 42);
    expect(result).toBeDefined();
    expect(result!.keyframeName).toBe("pptx-tl-color-42");
    expect(result!.css).toContain("@keyframes pptx-tl-color-42");
  });

  it("uses backgroundColor for fillcolor targetAttribute", () => {
    const anim = {
      colorAnimation: {
        colorSpace: "rgb" as const,
        fromColor: "#FF0000",
        toColor: "#0000FF",
        targetAttribute: "fillcolor",
      },
    } as unknown as PptxNativeAnimation;

    const result = buildDynamicKeyframe(anim, 10);
    expect(result).toBeDefined();
    expect(result!.css).toContain("backgroundColor:");
    expect(result!.css).not.toContain("{ color:");
  });

  it("uses borderColor for stroke.color targetAttribute", () => {
    const anim = {
      colorAnimation: {
        colorSpace: "rgb" as const,
        fromColor: "#000000",
        toColor: "#FFFFFF",
        targetAttribute: "stroke.color",
      },
    } as unknown as PptxNativeAnimation;

    const result = buildDynamicKeyframe(anim, 11);
    expect(result).toBeDefined();
    expect(result!.css).toContain("borderColor:");
  });
});

// ==========================================================================
// buildColorAnimationKeyframes — targetAttribute CSS property mapping
// ==========================================================================

describe("buildColorAnimationKeyframes targetAttribute", () => {
  it("maps fillcolor to backgroundColor CSS property", () => {
    const anim: PptxColorAnimation = {
      colorSpace: "rgb",
      fromColor: "#FF0000",
      toColor: "#0000FF",
      targetAttribute: "fillcolor",
    };
    const css = buildColorAnimationKeyframes(anim, "fill-test", 2);
    expect(css).toBeDefined();
    expect(css).toContain("0% { backgroundColor: #ff0000; }");
    expect(css).toContain("100% { backgroundColor: #0000ff; }");
  });

  it("maps style.color to color CSS property", () => {
    const anim: PptxColorAnimation = {
      colorSpace: "rgb",
      fromColor: "#FF0000",
      toColor: "#0000FF",
      targetAttribute: "style.color",
    };
    const css = buildColorAnimationKeyframes(anim, "style-test", 2);
    expect(css).toBeDefined();
    expect(css).toContain("0% { color: #ff0000; }");
    expect(css).toContain("100% { color: #0000ff; }");
  });

  it("maps stroke.color to borderColor CSS property", () => {
    const anim: PptxColorAnimation = {
      colorSpace: "rgb",
      fromColor: "#000000",
      toColor: "#FFFFFF",
      targetAttribute: "stroke.color",
    };
    const css = buildColorAnimationKeyframes(anim, "stroke-test", 2);
    expect(css).toBeDefined();
    expect(css).toContain("0% { borderColor: #000000; }");
    expect(css).toContain("100% { borderColor: #ffffff; }");
  });

  it("defaults to color when targetAttribute is undefined", () => {
    const anim: PptxColorAnimation = {
      colorSpace: "rgb",
      fromColor: "#FF0000",
      toColor: "#0000FF",
    };
    const css = buildColorAnimationKeyframes(anim, "default-test", 2);
    expect(css).toBeDefined();
    expect(css).toContain("0% { color: #ff0000; }");
  });

  it("defaults to color for unknown targetAttribute", () => {
    const anim: PptxColorAnimation = {
      colorSpace: "rgb",
      fromColor: "#FF0000",
      toColor: "#0000FF",
      targetAttribute: "unknown.prop",
    };
    const css = buildColorAnimationKeyframes(anim, "unknown-test", 2);
    expect(css).toBeDefined();
    expect(css).toContain("0% { color: #ff0000; }");
  });

  it("works with HSL color space and fillcolor target", () => {
    const anim: PptxColorAnimation = {
      colorSpace: "hsl",
      direction: "cw",
      fromColor: "#FF0000",
      toColor: "#00FF00",
      targetAttribute: "fillcolor",
    };
    const css = buildColorAnimationKeyframes(anim, "hsl-fill", 4);
    expect(css).toBeDefined();
    expect(css).toContain("backgroundColor:");
    expect(css).not.toContain("{ color:");
  });
});
