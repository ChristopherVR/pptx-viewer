import { describe, it, expect } from "vitest";
import { TEXT_WARP_PRESETS, warpPreviewPath } from "./TextWarpGallery";

// ---------------------------------------------------------------------------
// TEXT_WARP_PRESETS
// ---------------------------------------------------------------------------

describe("TEXT_WARP_PRESETS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(TEXT_WARP_PRESETS)).toBe(true);
    expect(TEXT_WARP_PRESETS.length).toBeGreaterThan(0);
  });

  it("has 39 presets", () => {
    expect(TEXT_WARP_PRESETS).toHaveLength(39);
  });

  it("every preset has a non-empty value and label", () => {
    for (const preset of TEXT_WARP_PRESETS) {
      expect(typeof preset.value).toBe("string");
      expect(preset.value.length).toBeGreaterThan(0);
      expect(typeof preset.label).toBe("string");
      expect(preset.label.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate values", () => {
    const values = TEXT_WARP_PRESETS.map((p) => p.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("has no duplicate labels", () => {
    const labels = TEXT_WARP_PRESETS.map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("all values start with 'text'", () => {
    for (const preset of TEXT_WARP_PRESETS) {
      expect(preset.value.startsWith("text")).toBe(true);
    }
  });

  it("contains textNoShape as the first item", () => {
    expect(TEXT_WARP_PRESETS[0].value).toBe("textNoShape");
    expect(TEXT_WARP_PRESETS[0].label).toBe("No Transform");
  });

  it("contains well-known presets", () => {
    const values = TEXT_WARP_PRESETS.map((p) => p.value);
    expect(values).toContain("textArchUp");
    expect(values).toContain("textCircle");
    expect(values).toContain("textWave1");
    expect(values).toContain("textInflate");
    expect(values).toContain("textSlantUp");
    expect(values).toContain("textTriangle");
  });
});

// ---------------------------------------------------------------------------
// warpPreviewPath
// ---------------------------------------------------------------------------

describe("warpPreviewPath", () => {
  it("returns a non-empty string for textNoShape", () => {
    const path = warpPreviewPath("textNoShape");
    expect(typeof path).toBe("string");
    expect(path.length).toBeGreaterThan(0);
  });

  it("returns a non-empty string for textPlain", () => {
    const path = warpPreviewPath("textPlain");
    expect(path.length).toBeGreaterThan(0);
  });

  it("textNoShape and textPlain return the same path", () => {
    expect(warpPreviewPath("textNoShape")).toBe(warpPreviewPath("textPlain"));
  });

  it("returns a valid SVG path starting with M", () => {
    for (const preset of TEXT_WARP_PRESETS) {
      const path = warpPreviewPath(preset.value);
      expect(path).toMatch(/^M\s/);
    }
  });

  it("returns an SVG path for every known preset", () => {
    for (const preset of TEXT_WARP_PRESETS) {
      const path = warpPreviewPath(preset.value);
      expect(typeof path).toBe("string");
      expect(path.length).toBeGreaterThan(0);
    }
  });

  it("returns a fallback path for unknown presets", () => {
    const path = warpPreviewPath("unknownPreset" as any);
    expect(typeof path).toBe("string");
    expect(path.length).toBeGreaterThan(0);
    // Fallback is the same as textNoShape/textPlain
    expect(path).toBe(warpPreviewPath("textNoShape"));
  });

  it("textArchUp contains an arc command (A)", () => {
    const path = warpPreviewPath("textArchUp");
    expect(path).toContain("A");
  });

  it("textCircle contains arc commands for a full circle", () => {
    const path = warpPreviewPath("textCircle");
    // Should have at least 2 arc commands
    const arcCount = (path.match(/A /g) || []).length;
    expect(arcCount).toBeGreaterThanOrEqual(2);
  });

  it("textWave1 contains a cubic bezier command (C)", () => {
    const path = warpPreviewPath("textWave1");
    expect(path).toContain("C");
  });

  it("textSlantUp contains a line-to command (L)", () => {
    const path = warpPreviewPath("textSlantUp");
    expect(path).toContain("L");
  });

  it("textFadeLeft contains a Z close command", () => {
    const path = warpPreviewPath("textFadeLeft");
    expect(path).toContain("Z");
  });

  it("textTriangle contains a Z close command", () => {
    const path = warpPreviewPath("textTriangle");
    expect(path).toContain("Z");
  });
});
