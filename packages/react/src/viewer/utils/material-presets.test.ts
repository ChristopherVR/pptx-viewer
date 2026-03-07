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
});
