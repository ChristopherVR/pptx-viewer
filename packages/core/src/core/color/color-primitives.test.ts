import { describe, it, expect } from "vitest";
import {
  clampUnitInterval,
  normalizeHexColor,
  hexToRgbChannels,
  colorWithOpacity,
  parseDrawingPercent,
  parseDrawingFraction,
  parseDrawingHueDegrees,
  toHex,
  rgbToHsl,
  hslToRgb,
} from "./color-primitives";

// ---------------------------------------------------------------------------
// clampUnitInterval
// ---------------------------------------------------------------------------

describe("clampUnitInterval", () => {
  it("returns the value unchanged when within [0, 1]", () => {
    expect(clampUnitInterval(0)).toBe(0);
    expect(clampUnitInterval(0.5)).toBe(0.5);
    expect(clampUnitInterval(1)).toBe(1);
  });

  it("clamps values below 0 to 0", () => {
    expect(clampUnitInterval(-0.5)).toBe(0);
    expect(clampUnitInterval(-100)).toBe(0);
  });

  it("clamps values above 1 to 1", () => {
    expect(clampUnitInterval(1.5)).toBe(1);
    expect(clampUnitInterval(999)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// normalizeHexColor
// ---------------------------------------------------------------------------

describe("normalizeHexColor", () => {
  it("returns a valid #RRGGBB string unchanged", () => {
    expect(normalizeHexColor("#FF0000")).toBe("#FF0000");
    expect(normalizeHexColor("#abcdef")).toBe("#abcdef");
  });

  it("prepends # when missing", () => {
    expect(normalizeHexColor("00FF00")).toBe("#00FF00");
  });

  it("returns fallback for undefined input", () => {
    expect(normalizeHexColor(undefined)).toBe("#111827");
  });

  it("returns fallback for 'transparent'", () => {
    expect(normalizeHexColor("transparent")).toBe("#111827");
  });

  it("returns fallback for malformed hex values", () => {
    expect(normalizeHexColor("#GGG")).toBe("#111827");
    expect(normalizeHexColor("#12345")).toBe("#111827");
    expect(normalizeHexColor("#1234567")).toBe("#111827");
    expect(normalizeHexColor("")).toBe("#111827");
  });

  it("uses a custom fallback when provided", () => {
    expect(normalizeHexColor(undefined, "#FFFFFF")).toBe("#FFFFFF");
    expect(normalizeHexColor("transparent", "#000000")).toBe("#000000");
  });
});

// ---------------------------------------------------------------------------
// hexToRgbChannels
// ---------------------------------------------------------------------------

describe("hexToRgbChannels", () => {
  it("parses a #RRGGBB string into r, g, b channels", () => {
    expect(hexToRgbChannels("#FF0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgbChannels("#00FF00")).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgbChannels("#0000FF")).toEqual({ r: 0, g: 0, b: 255 });
  });

  it("parses without the # prefix", () => {
    expect(hexToRgbChannels("AABBCC")).toEqual({ r: 170, g: 187, b: 204 });
  });

  it("returns null for invalid hex strings", () => {
    expect(hexToRgbChannels("")).toBeNull();
    expect(hexToRgbChannels("GGGGGG")).toBeNull();
    expect(hexToRgbChannels("#12345")).toBeNull();
  });

  it("parses black and white correctly", () => {
    expect(hexToRgbChannels("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgbChannels("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
  });
});

// ---------------------------------------------------------------------------
// colorWithOpacity
// ---------------------------------------------------------------------------

describe("colorWithOpacity", () => {
  it("returns the original hex color when opacity is undefined", () => {
    expect(colorWithOpacity("#FF0000", undefined)).toBe("#FF0000");
  });

  it("returns an rgba string with the given opacity", () => {
    expect(colorWithOpacity("#FF0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
  });

  it("clamps opacity to [0, 1]", () => {
    expect(colorWithOpacity("#FF0000", 1.5)).toBe("rgba(255, 0, 0, 1)");
    expect(colorWithOpacity("#FF0000", -0.5)).toBe("rgba(255, 0, 0, 0)");
  });

  it("returns the original color when hex is invalid", () => {
    expect(colorWithOpacity("notahex", 0.5)).toBe("notahex");
  });

  it("handles full opacity", () => {
    expect(colorWithOpacity("#00FF00", 1)).toBe("rgba(0, 255, 0, 1)");
  });

  it("handles zero opacity", () => {
    expect(colorWithOpacity("#0000FF", 0)).toBe("rgba(0, 0, 255, 0)");
  });
});

// ---------------------------------------------------------------------------
// parseDrawingPercent
// ---------------------------------------------------------------------------

describe("parseDrawingPercent", () => {
  it("converts 100000 to 1.0 (100%)", () => {
    expect(parseDrawingPercent("100000")).toBe(1);
  });

  it("converts 50000 to 0.5 (50%)", () => {
    expect(parseDrawingPercent("50000")).toBe(0.5);
  });

  it("converts 0 to 0", () => {
    expect(parseDrawingPercent("0")).toBe(0);
  });

  it("clamps values above 100% to 1", () => {
    expect(parseDrawingPercent("200000")).toBe(1);
  });

  it("clamps negative values to 0", () => {
    expect(parseDrawingPercent("-50000")).toBe(0);
  });

  it("returns undefined for non-numeric input", () => {
    expect(parseDrawingPercent("abc")).toBeUndefined();
    expect(parseDrawingPercent(undefined)).toBeUndefined();
    expect(parseDrawingPercent(null)).toBeUndefined();
  });

  it("handles numeric input (not just strings)", () => {
    expect(parseDrawingPercent(75000)).toBe(0.75);
  });
});

// ---------------------------------------------------------------------------
// parseDrawingFraction
// ---------------------------------------------------------------------------

describe("parseDrawingFraction", () => {
  it("converts 100000 to 1.0", () => {
    expect(parseDrawingFraction("100000")).toBe(1);
  });

  it("does NOT clamp values above 1.0", () => {
    expect(parseDrawingFraction("200000")).toBe(2);
  });

  it("allows negative fractions", () => {
    expect(parseDrawingFraction("-50000")).toBe(-0.5);
  });

  it("returns undefined for non-numeric input", () => {
    expect(parseDrawingFraction("abc")).toBeUndefined();
    expect(parseDrawingFraction(undefined)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseDrawingHueDegrees
// ---------------------------------------------------------------------------

describe("parseDrawingHueDegrees", () => {
  it("converts 5400000 to 90 degrees", () => {
    expect(parseDrawingHueDegrees("5400000")).toBe(90);
  });

  it("converts 21600000 to 360 degrees", () => {
    expect(parseDrawingHueDegrees("21600000")).toBe(360);
  });

  it("converts 0 to 0 degrees", () => {
    expect(parseDrawingHueDegrees("0")).toBe(0);
  });

  it("returns undefined for non-numeric input", () => {
    expect(parseDrawingHueDegrees("abc")).toBeUndefined();
    expect(parseDrawingHueDegrees(undefined)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// toHex
// ---------------------------------------------------------------------------

describe("toHex", () => {
  it("converts 0 to '00'", () => {
    expect(toHex(0)).toBe("00");
  });

  it("converts 255 to 'FF'", () => {
    expect(toHex(255)).toBe("FF");
  });

  it("converts 10 to '0A'", () => {
    expect(toHex(10)).toBe("0A");
  });

  it("clamps values above 255", () => {
    expect(toHex(300)).toBe("FF");
  });

  it("clamps negative values to 0", () => {
    expect(toHex(-10)).toBe("00");
  });

  it("rounds fractional values", () => {
    expect(toHex(127.6)).toBe("80");
    expect(toHex(127.4)).toBe("7F");
  });
});

// ---------------------------------------------------------------------------
// rgbToHsl / hslToRgb round-trip
// ---------------------------------------------------------------------------

describe("rgbToHsl", () => {
  it("converts pure red to hue=0, s=1, l=0.5", () => {
    const hsl = rgbToHsl(255, 0, 0);
    expect(hsl.h).toBeCloseTo(0, 1);
    expect(hsl.s).toBeCloseTo(1, 1);
    expect(hsl.l).toBeCloseTo(0.5, 1);
  });

  it("converts pure green to hue=120", () => {
    const hsl = rgbToHsl(0, 255, 0);
    expect(hsl.h).toBeCloseTo(120, 1);
    expect(hsl.s).toBeCloseTo(1, 1);
    expect(hsl.l).toBeCloseTo(0.5, 1);
  });

  it("converts pure blue to hue=240", () => {
    const hsl = rgbToHsl(0, 0, 255);
    expect(hsl.h).toBeCloseTo(240, 1);
    expect(hsl.s).toBeCloseTo(1, 1);
    expect(hsl.l).toBeCloseTo(0.5, 1);
  });

  it("converts black to l=0", () => {
    const hsl = rgbToHsl(0, 0, 0);
    expect(hsl.l).toBe(0);
    expect(hsl.s).toBe(0);
  });

  it("converts white to l=1", () => {
    const hsl = rgbToHsl(255, 255, 255);
    expect(hsl.l).toBe(1);
    expect(hsl.s).toBe(0);
  });

  it("converts a grey to s=0 with correct lightness", () => {
    const hsl = rgbToHsl(128, 128, 128);
    expect(hsl.s).toBeCloseTo(0, 1);
    expect(hsl.l).toBeCloseTo(128 / 255, 1);
  });
});

describe("hslToRgb", () => {
  it("converts hue=0, s=1, l=0.5 to pure red", () => {
    const rgb = hslToRgb(0, 1, 0.5);
    expect(rgb.r).toBe(255);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(0);
  });

  it("converts hue=120, s=1, l=0.5 to pure green", () => {
    const rgb = hslToRgb(120, 1, 0.5);
    expect(rgb.r).toBe(0);
    expect(rgb.g).toBe(255);
    expect(rgb.b).toBe(0);
  });

  it("converts hue=240, s=1, l=0.5 to pure blue", () => {
    const rgb = hslToRgb(240, 1, 0.5);
    expect(rgb.r).toBe(0);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(255);
  });

  it("converts l=0 to black", () => {
    const rgb = hslToRgb(0, 1, 0);
    expect(rgb).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("converts l=1 to white", () => {
    const rgb = hslToRgb(0, 0, 1);
    expect(rgb).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("handles negative hue values by wrapping", () => {
    const rgb = hslToRgb(-120, 1, 0.5);
    const expected = hslToRgb(240, 1, 0.5);
    expect(rgb).toEqual(expected);
  });

  it("clamps saturation and lightness to [0, 1]", () => {
    const rgb = hslToRgb(0, 2, 0.5);
    // s=2 gets clamped to 1 => pure red
    expect(rgb.r).toBe(255);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(0);
  });
});

describe("rgbToHsl / hslToRgb round-trip", () => {
  const testColors = [
    { r: 255, g: 0, b: 0 },
    { r: 0, g: 255, b: 0 },
    { r: 0, g: 0, b: 255 },
    { r: 255, g: 255, b: 0 },
    { r: 128, g: 64, b: 192 },
    { r: 10, g: 200, b: 100 },
  ];

  for (const color of testColors) {
    it(`round-trips (${color.r}, ${color.g}, ${color.b})`, () => {
      const hsl = rgbToHsl(color.r, color.g, color.b);
      const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
      expect(rgb.r).toBeCloseTo(color.r, 0);
      expect(rgb.g).toBeCloseTo(color.g, 0);
      expect(rgb.b).toBeCloseTo(color.b, 0);
    });
  }
});
