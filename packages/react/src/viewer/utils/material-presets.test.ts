import { describe, it, expect } from "vitest";

import type { MaterialPresetType } from "pptx-viewer-core";

import { getMaterialCssOverrides } from "./material-presets";

describe("getMaterialCssOverrides", () => {
  it("should return empty object for undefined material", () => {
    const result = getMaterialCssOverrides(undefined);
    expect(result).toEqual({});
  });

  it("should return empty object for unrecognised material", () => {
    const result = getMaterialCssOverrides("nonexistent" as MaterialPresetType);
    expect(result).toEqual({});
  });

  it("should return soft diffuse filter for matte", () => {
    const result = getMaterialCssOverrides("matte");
    expect(result.filter).toBe("brightness(0.95) saturate(0.9)");
    expect(result.opacity).toBeUndefined();
    expect(result.boxShadow).toBeUndefined();
  });

  it("should return warm sepia-tinted filter for warmMatte", () => {
    const result = getMaterialCssOverrides("warmMatte");
    expect(result.filter).toBe("brightness(1.0) saturate(0.85) sepia(0.08)");
  });

  it("should return bright contrast filter and specular highlight for plastic", () => {
    const result = getMaterialCssOverrides("plastic");
    expect(result.filter).toBe("brightness(1.05) contrast(1.05)");
    expect(result.boxShadow).toContain("inset");
  });

  it("should return strong metallic filter and specular for metal", () => {
    const result = getMaterialCssOverrides("metal");
    expect(result.filter).toBe("brightness(1.1) contrast(1.15) saturate(1.2)");
    expect(result.boxShadow).toBeDefined();
  });

  it("should return dark edge lighting for dkEdge", () => {
    const result = getMaterialCssOverrides("dkEdge");
    expect(result.filter).toBe("brightness(0.85) contrast(1.2)");
  });

  it("should return soft diffuse filter for softEdge", () => {
    const result = getMaterialCssOverrides("softEdge");
    expect(result.filter).toBe("brightness(1.05) contrast(0.9)");
  });

  it("should return empty overrides for flat", () => {
    const result = getMaterialCssOverrides("flat");
    expect(result).toEqual({});
  });

  it("should return mild metallic filter and soft specular for softmetal", () => {
    const result = getMaterialCssOverrides("softmetal");
    expect(result.filter).toBe("brightness(1.05) contrast(1.08) saturate(1.1)");
    expect(result.boxShadow).toBeDefined();
  });

  it("should return translucent appearance for clear", () => {
    const result = getMaterialCssOverrides("clear");
    expect(result.opacity).toBe(0.7);
    expect(result.filter).toBe("brightness(1.15)");
  });

  it("should return powdery diffuse filter for powder", () => {
    const result = getMaterialCssOverrides("powder");
    expect(result.filter).toBe("brightness(1.1) contrast(0.85) saturate(0.8)");
  });

  it("should return translucent powdery appearance for translucentPowder", () => {
    const result = getMaterialCssOverrides("translucentPowder");
    expect(result.opacity).toBe(0.75);
    expect(result.filter).toBe("brightness(1.1) contrast(0.85)");
  });

  it("should not set mixBlendMode for any preset", () => {
    const presets: MaterialPresetType[] = [
      "matte",
      "warmMatte",
      "plastic",
      "metal",
      "dkEdge",
      "softEdge",
      "flat",
      "softmetal",
      "clear",
      "powder",
      "translucentPowder",
    ];
    for (const preset of presets) {
      expect(getMaterialCssOverrides(preset).mixBlendMode).toBeUndefined();
    }
  });

  // ── backgroundImage gradient tests ──────────────────────────────────────

  it("should return subtle diffuse gradient for matte", () => {
    const result = getMaterialCssOverrides("matte");
    expect(result.backgroundImage).toBeDefined();
    expect(result.backgroundImage).toContain("linear-gradient");
  });

  it("should return warm-toned gradient for warmMatte", () => {
    const result = getMaterialCssOverrides("warmMatte");
    expect(result.backgroundImage).toBeDefined();
    expect(result.backgroundImage).toContain("linear-gradient");
    expect(result.backgroundImage).toContain("rgba(255,240,220");
  });

  it("should return specular highlight radial gradient for plastic", () => {
    const result = getMaterialCssOverrides("plastic");
    expect(result.backgroundImage).toBeDefined();
    expect(result.backgroundImage).toContain("radial-gradient");
  });

  it("should return directional specular band gradient for metal", () => {
    const result = getMaterialCssOverrides("metal");
    expect(result.backgroundImage).toBeDefined();
    expect(result.backgroundImage).toContain("linear-gradient");
    // Metal has strong highlight
    expect(result.backgroundImage).toContain("rgba(255,255,255,0.25)");
  });

  it("should return darkened-edge radial gradient for dkEdge", () => {
    const result = getMaterialCssOverrides("dkEdge");
    expect(result.backgroundImage).toBeDefined();
    expect(result.backgroundImage).toContain("radial-gradient");
    expect(result.backgroundImage).toContain("rgba(0,0,0,0.1)");
  });

  it("should return center highlight gradient for softEdge", () => {
    const result = getMaterialCssOverrides("softEdge");
    expect(result.backgroundImage).toBeDefined();
    expect(result.backgroundImage).toContain("radial-gradient");
  });

  it("should not return backgroundImage for flat", () => {
    const result = getMaterialCssOverrides("flat");
    expect(result.backgroundImage).toBeUndefined();
  });

  it("should return softer specular gradient for softmetal", () => {
    const result = getMaterialCssOverrides("softmetal");
    expect(result.backgroundImage).toBeDefined();
    expect(result.backgroundImage).toContain("linear-gradient");
  });

  it("should return glass-like gradient for clear", () => {
    const result = getMaterialCssOverrides("clear");
    expect(result.backgroundImage).toBeDefined();
    expect(result.backgroundImage).toContain("linear-gradient");
    expect(result.boxShadow).toBeDefined();
    expect(result.boxShadow).toContain("inset");
  });

  it("should return diffuse gradient for powder", () => {
    const result = getMaterialCssOverrides("powder");
    expect(result.backgroundImage).toBeDefined();
    expect(result.backgroundImage).toContain("linear-gradient");
  });

  it("should return translucent glow gradient for translucentPowder", () => {
    const result = getMaterialCssOverrides("translucentPowder");
    expect(result.backgroundImage).toBeDefined();
    expect(result.backgroundImage).toContain("radial-gradient");
  });

  // ── Enhanced box-shadow tests ────────────────────────────────────────────

  it("should return multi-layer specular for plastic box-shadow", () => {
    const result = getMaterialCssOverrides("plastic");
    expect(result.boxShadow).toBeDefined();
    // Now has both primary and secondary specular
    const insetCount = (result.boxShadow!.match(/inset/g) ?? []).length;
    expect(insetCount).toBeGreaterThanOrEqual(2);
  });

  it("should return 3-layer specular for metal box-shadow", () => {
    const result = getMaterialCssOverrides("metal");
    expect(result.boxShadow).toBeDefined();
    // Metal: primary specular, secondary highlight, dark edge
    const insetCount = (result.boxShadow!.match(/inset/g) ?? []).length;
    expect(insetCount).toBeGreaterThanOrEqual(3);
  });

  it("should return darkened perimeter shadow for dkEdge", () => {
    const result = getMaterialCssOverrides("dkEdge");
    expect(result.boxShadow).toBeDefined();
    const insetCount = (result.boxShadow!.match(/inset/g) ?? []).length;
    expect(insetCount).toBeGreaterThanOrEqual(2);
    expect(result.boxShadow).toContain("rgba(0,0,0,");
  });

  it("should return glass-like dual inset for clear", () => {
    const result = getMaterialCssOverrides("clear");
    expect(result.boxShadow).toBeDefined();
    const insetCount = (result.boxShadow!.match(/inset/g) ?? []).length;
    expect(insetCount).toBeGreaterThanOrEqual(2);
  });

  // ── All non-flat presets should have backgroundImage ──────────────────

  it("all non-flat presets should have a backgroundImage gradient", () => {
    const presetsWithGradient: MaterialPresetType[] = [
      "matte",
      "warmMatte",
      "plastic",
      "metal",
      "dkEdge",
      "softEdge",
      "softmetal",
      "clear",
      "powder",
      "translucentPowder",
    ];
    for (const preset of presetsWithGradient) {
      const result = getMaterialCssOverrides(preset);
      expect(result.backgroundImage).toBeDefined();
    }
  });
});
