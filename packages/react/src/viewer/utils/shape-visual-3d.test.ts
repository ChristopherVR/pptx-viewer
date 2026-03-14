import { describe, it, expect } from "vitest";
import type React from "react";

import {
  apply3dEffects,
  getCameraTransform,
  getExtrusionShadow,
  get3DBevelShadow,
  get3DMaterialFilter,
  get3DTransformStyle,
  getLightRigCss,
} from "./shape-visual-3d";

// ── getCameraTransform ───────────────────────────────────────────────────

describe("getCameraTransform", () => {
  it("returns zeros when scene3d is undefined", () => {
    const result = getCameraTransform(undefined);
    expect(result.perspective).toBeUndefined();
    expect(result.rotateX).toBe(0);
    expect(result.rotateY).toBe(0);
    expect(result.rotateZ).toBe(0);
  });

  it("maps orthographicFront to no perspective and no rotation", () => {
    const result = getCameraTransform({ cameraPreset: "orthographicFront" });
    expect(result.perspective).toBeUndefined();
    expect(result.rotateX).toBe(0);
    expect(result.rotateY).toBe(0);
  });

  it("maps perspectiveFront to 1000px perspective with no rotation", () => {
    const result = getCameraTransform({ cameraPreset: "perspectiveFront" });
    expect(result.perspective).toBe("1000px");
    expect(result.rotateX).toBe(0);
    expect(result.rotateY).toBe(0);
  });

  it("maps perspectiveAbove to rotateX -20deg", () => {
    const result = getCameraTransform({ cameraPreset: "perspectiveAbove" });
    expect(result.perspective).toBe("1000px");
    expect(result.rotateX).toBe(-20);
    expect(result.rotateY).toBe(0);
  });

  it("maps perspectiveBelow to rotateX 20deg", () => {
    const result = getCameraTransform({ cameraPreset: "perspectiveBelow" });
    expect(result.perspective).toBe("1000px");
    expect(result.rotateX).toBe(20);
  });

  it("maps perspectiveLeft to rotateY 20deg", () => {
    const result = getCameraTransform({ cameraPreset: "perspectiveLeft" });
    expect(result.perspective).toBe("1000px");
    expect(result.rotateY).toBe(20);
  });

  it("maps perspectiveRight to rotateY -20deg", () => {
    const result = getCameraTransform({ cameraPreset: "perspectiveRight" });
    expect(result.perspective).toBe("1000px");
    expect(result.rotateY).toBe(-20);
  });

  it("maps isometric presets with both X and Y rotation", () => {
    const result = getCameraTransform({ cameraPreset: "isometricLeftDown" });
    expect(result.perspective).toBe("1200px");
    expect(result.rotateX).toBe(-35);
    expect(result.rotateY).toBe(45);
  });

  it("explicit rotation angles override preset defaults", () => {
    const result = getCameraTransform({
      cameraPreset: "perspectiveFront",
      cameraRotX: 1800000, // 30deg
      cameraRotY: 2700000, // 45deg
    });
    expect(result.perspective).toBe("1000px");
    expect(result.rotateX).toBe(-30);
    expect(result.rotateY).toBe(45);
  });

  it("applies default 800px perspective for explicit rotations without preset", () => {
    const result = getCameraTransform({ cameraRotX: 600000 }); // 10deg
    expect(result.perspective).toBe("800px");
    expect(result.rotateX).toBe(-10);
  });

  it("returns fallback for unknown preset with no rotation", () => {
    const result = getCameraTransform({ cameraPreset: "unknownPreset" });
    // Unknown preset — no perspective, no rotation
    expect(result.perspective).toBeUndefined();
    expect(result.rotateX).toBe(0);
  });
});

// ── getExtrusionShadow ───────────────────────────────────────────────────

describe("getExtrusionShadow", () => {
  it("returns undefined when no extrusion height", () => {
    expect(getExtrusionShadow(undefined)).toBeUndefined();
    expect(getExtrusionShadow({})).toBeUndefined();
    expect(getExtrusionShadow({ extrusionHeight: 0 })).toBeUndefined();
  });

  it("generates shadow layers for extrusion height", () => {
    // 9525 EMU = 1px, so 95250 = 10px depth
    const result = getExtrusionShadow({
      extrusionHeight: 95250,
      extrusionColor: "#4472C4",
    });
    expect(result).toBeDefined();
    expect(result).toContain("#4472C4");
    // Should have multiple layers (10 depth + 1 soft shadow)
    const layers = result!.split(",");
    expect(layers.length).toBeGreaterThan(5);
  });

  it("caps at 20 layers for large extrusion values", () => {
    const result = getExtrusionShadow({
      extrusionHeight: 9525 * 100, // 100px → capped to 20
      extrusionColor: "#FF0000",
    });
    expect(result).toBeDefined();
    // Count shadow entries by looking for "px" offset pairs followed by "0 " or blur
    // Each shadow entry starts with a pixel offset like "1px 1px"
    const entryCount = (result!.match(/\d+px \-?\d+px/g) ?? []).length;
    // 20 depth layers + 1 soft shadow = 21
    expect(entryCount).toBeLessThanOrEqual(22);
    expect(entryCount).toBeGreaterThanOrEqual(20);
  });

  it("uses default color when extrusionColor is not set", () => {
    const result = getExtrusionShadow({ extrusionHeight: 28575 });
    expect(result).toBeDefined();
    expect(result).toContain("#888888");
  });

  it("adjusts shadow direction based on camera rotation", () => {
    // Camera from above (rotateX < 0) → extrusion goes down (positive dy)
    const fromAbove = getExtrusionShadow(
      { extrusionHeight: 28575, extrusionColor: "#000" },
      -20,
      0,
    );
    expect(fromAbove).toContain("1px 1px");

    // Camera from below (rotateX > 0) → extrusion goes up (negative dy)
    const fromBelow = getExtrusionShadow(
      { extrusionHeight: 28575, extrusionColor: "#000" },
      20,
      0,
    );
    expect(fromBelow).toContain("1px -1px");

    // Camera from left (rotateY > 5) → extrusion goes left (negative dx)
    const fromLeft = getExtrusionShadow(
      { extrusionHeight: 28575, extrusionColor: "#000" },
      0,
      20,
    );
    expect(fromLeft).toContain("-1px 1px");
  });

  it("darkens deeper layers for depth perception", () => {
    const result = getExtrusionShadow({
      extrusionHeight: 9525 * 15, // 15px deep
      extrusionColor: "#FFFFFF",
    });
    expect(result).toBeDefined();
    // Last content layers should use rgb() (darkened) instead of #FFFFFF
    expect(result).toContain("rgb(");
  });
});

// ── get3DBevelShadow ─────────────────────────────────────────────────────

describe("get3DBevelShadow", () => {
  it("returns undefined when no shape3d", () => {
    expect(get3DBevelShadow(undefined)).toBeUndefined();
  });

  it("returns undefined when no bevel types set", () => {
    expect(get3DBevelShadow({})).toBeUndefined();
    expect(get3DBevelShadow({ bevelTopType: "none" })).toBeUndefined();
  });

  it("generates inset shadow for circle bevel", () => {
    const result = get3DBevelShadow({
      bevelTopType: "circle",
      bevelTopWidth: 28575,
      bevelTopHeight: 28575,
    });
    expect(result).toBeDefined();
    expect(result).toContain("inset");
    expect(result).toContain("rgba(255,255,255,");
    expect(result).toContain("rgba(0,0,0,");
  });

  it("generates sharp shadow for hardEdge bevel", () => {
    const result = get3DBevelShadow({
      bevelTopType: "hardEdge",
      bevelTopWidth: 19050,
      bevelTopHeight: 19050,
    });
    expect(result).toBeDefined();
    expect(result).toContain("inset");
    // hardEdge has 0 blur
    expect(result).toContain("0 rgba(");
  });

  it("generates cross-axis shadows for cross bevel", () => {
    const result = get3DBevelShadow({
      bevelTopType: "cross",
      bevelTopWidth: 19050,
      bevelTopHeight: 19050,
    });
    expect(result).toBeDefined();
    // cross bevel should have X-only and Y-only shadow directions
    expect(result).toContain("inset 2px 0");
    expect(result).toContain("inset 0 2px");
  });

  it("handles both top and bottom bevel simultaneously", () => {
    const result = get3DBevelShadow({
      bevelTopType: "circle",
      bevelTopWidth: 19050,
      bevelTopHeight: 19050,
      bevelBottomType: "hardEdge",
      bevelBottomWidth: 9525,
      bevelBottomHeight: 9525,
    });
    expect(result).toBeDefined();
    // Should have shadows from both bevels
    const layers = result!.split(", inset");
    expect(layers.length).toBeGreaterThanOrEqual(3);
  });

  it("uses default sizes when bevel dimensions are not specified", () => {
    const result = get3DBevelShadow({ bevelTopType: "circle" });
    expect(result).toBeDefined();
    // Default 3px dimensions
    expect(result).toContain("3px");
  });

  it("generates art deco multi-layer bevel", () => {
    const result = get3DBevelShadow({
      bevelTopType: "artDeco",
      bevelTopWidth: 19050,
      bevelTopHeight: 19050,
    });
    expect(result).toBeDefined();
    // artDeco has multiple crisp layers
    const layers = result!.split(",");
    expect(layers.length).toBeGreaterThanOrEqual(3);
  });
});

// ── get3DMaterialFilter ──────────────────────────────────────────────────

describe("get3DMaterialFilter", () => {
  it("returns undefined when no shape3d", () => {
    expect(get3DMaterialFilter(undefined)).toBeUndefined();
  });

  it("returns undefined when no presetMaterial", () => {
    expect(get3DMaterialFilter({})).toBeUndefined();
  });

  it("returns brightness filter for matte material", () => {
    const result = get3DMaterialFilter({ presetMaterial: "matte" });
    expect(result).toBeDefined();
    expect(result).toContain("brightness(0.95)");
  });

  it("returns combined filters for plastic material", () => {
    const result = get3DMaterialFilter({ presetMaterial: "plastic" });
    expect(result).toBeDefined();
    expect(result).toContain("brightness");
    expect(result).toContain("contrast");
  });

  it("returns metallic filters for metal material", () => {
    const result = get3DMaterialFilter({ presetMaterial: "metal" });
    expect(result).toBeDefined();
    expect(result).toContain("brightness");
    expect(result).toContain("contrast");
    expect(result).toContain("saturate");
  });

  it("returns sepia filter for warmMatte material", () => {
    const result = get3DMaterialFilter({ presetMaterial: "warmMatte" });
    expect(result).toBeDefined();
    expect(result).toContain("sepia");
  });

  it("returns undefined for flat material", () => {
    const result = get3DMaterialFilter({ presetMaterial: "flat" });
    expect(result).toBeUndefined();
  });
});

// ── get3DTransformStyle ──────────────────────────────────────────────────

describe("get3DTransformStyle", () => {
  it("returns empty object when no params", () => {
    const result = get3DTransformStyle(undefined);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("includes perspective for camera presets", () => {
    const result = get3DTransformStyle({ cameraPreset: "perspectiveFront" });
    expect(result.perspective).toBe("1000px");
    expect(result.willChange).toBe("transform");
  });

  it("includes rotation transforms", () => {
    const result = get3DTransformStyle({
      cameraPreset: "perspectiveAbove",
    });
    expect(result.transform).toContain("rotateX(-20deg)");
    expect(result.perspective).toBe("1000px");
  });

  it("sets willChange when shape3d exists", () => {
    const result = get3DTransformStyle(undefined, { presetMaterial: "metal" });
    expect(result.willChange).toBe("transform");
  });
});

// ── getLightRigCss ───────────────────────────────────────────────────────

describe("getLightRigCss", () => {
  it("returns empty for undefined rig type", () => {
    const result = getLightRigCss(undefined, undefined);
    expect(result.backgroundImage).toBeUndefined();
    expect(result.filter).toBeUndefined();
  });

  it("returns gradient for threePt rig", () => {
    const result = getLightRigCss("threePt", undefined);
    expect(result.backgroundImage).toBeDefined();
    expect(result.backgroundImage).toContain("linear-gradient");
    expect(result.backgroundImage).toContain("rgba(255,255,255,");
  });

  it("returns high-contrast settings for harsh rig", () => {
    const result = getLightRigCss("harsh", undefined);
    expect(result.backgroundImage).toBeDefined();
    expect(result.filter).toContain("contrast");
  });

  it("returns brightness filter for flood rig", () => {
    const result = getLightRigCss("flood", undefined);
    expect(result.filter).toContain("brightness");
    expect(result.backgroundImage).toBeUndefined();
  });

  it("returns empty for flat rig", () => {
    const result = getLightRigCss("flat", undefined);
    expect(result.backgroundImage).toBeUndefined();
    expect(result.filter).toBeUndefined();
  });

  it("adjusts gradient direction based on lightRigDirection", () => {
    const resultTop = getLightRigCss("threePt", "t");
    expect(resultTop.backgroundImage).toContain("180deg");

    const resultLeft = getLightRigCss("threePt", "l");
    expect(resultLeft.backgroundImage).toContain("90deg");

    const resultRight = getLightRigCss("threePt", "r");
    expect(resultRight.backgroundImage).toContain("270deg");
  });

  it("returns empty for unknown rig type", () => {
    const result = getLightRigCss("unknownRig", undefined);
    expect(result.backgroundImage).toBeUndefined();
    expect(result.filter).toBeUndefined();
  });

  it("returns radial gradient for glow rig", () => {
    const result = getLightRigCss("glow", undefined);
    expect(result.backgroundImage).toContain("radial-gradient");
  });
});

// ── apply3dEffects (integration) ─────────────────────────────────────────

describe("apply3dEffects", () => {
  it("should not modify base when no 3D params provided", () => {
    const base: React.CSSProperties = { backgroundColor: "red" };
    apply3dEffects(base, undefined, undefined);
    expect(base.perspective).toBeUndefined();
    expect(base.transform).toBeUndefined();
  });

  it("should apply perspective and rotateX for camera X rotation", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(base, { cameraRotX: 1800000 }, undefined);
    expect(base.perspective).toBe("800px");
    // 1800000 / 60000 = 30 degrees (negated)
    expect(base.transform).toContain("rotateX(-30deg)");
  });

  it("should apply rotateY for camera Y rotation", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(base, { cameraRotY: 2700000 }, undefined);
    // 2700000 / 60000 = 45 degrees
    expect(base.transform).toContain("rotateY(45deg)");
  });

  it("should apply rotateZ for camera Z rotation", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(base, { cameraRotZ: 5400000 }, undefined);
    // 5400000 / 60000 = 90 degrees
    expect(base.transform).toContain("rotateZ(90deg)");
  });

  it("should combine multiple rotation axes", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(
      base,
      {
        cameraRotX: 600000,
        cameraRotY: 1200000,
        cameraRotZ: 1800000,
      },
      undefined,
    );
    expect(base.perspective).toBe("800px");
    expect(base.transform).toContain("rotateX(-10deg)");
    expect(base.transform).toContain("rotateY(20deg)");
    expect(base.transform).toContain("rotateZ(30deg)");
  });

  it("should apply camera preset perspective", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(base, { cameraPreset: "perspectiveFront" }, undefined);
    expect(base.perspective).toBe("1000px");
  });

  it("should apply camera preset rotation", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(base, { cameraPreset: "perspectiveAbove" }, undefined);
    expect(base.perspective).toBe("1000px");
    expect(base.transform).toContain("rotateX(-20deg)");
  });

  it("should add extrusion depth as stacked box-shadows", () => {
    const base: React.CSSProperties = {};
    // 9525 EMU = 1px, so 95250 = 10px depth
    apply3dEffects(base, undefined, {
      extrusionHeight: 95250,
      extrusionColor: "#888888",
    });
    expect(base.boxShadow).toBeDefined();
    expect(base.boxShadow).toContain("#888888");
    // Should have multiple shadow layers
    const layers = (base.boxShadow as string).split(",");
    expect(layers.length).toBeGreaterThan(1);
  });

  it("should add bevel top as inset highlight/shadow", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(base, undefined, {
      bevelTopType: "circle",
      bevelTopWidth: 28575,
      bevelTopHeight: 28575,
    });
    expect(base.boxShadow).toBeDefined();
    expect(base.boxShadow).toContain("inset");
    expect(base.boxShadow).toContain("rgba(255,255,255,");
  });

  it("should add backdrop ground-plane shadow", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(base, { hasBackdrop: true }, undefined);
    expect(base.boxShadow).toBeDefined();
    expect(base.boxShadow).toContain("rgba(0,0,0,0.25)");
  });

  it("should apply material preset CSS overrides", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(base, undefined, { presetMaterial: "metal" });
    expect(base.filter).toContain("brightness");
    expect(base.filter).toContain("contrast");
    expect(base.boxShadow).toContain("inset");
  });

  it("should apply material opacity for clear material", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(base, undefined, { presetMaterial: "clear" });
    expect(base.opacity).toBe(0.7);
  });

  it("should set willChange for performance optimization", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(base, { cameraPreset: "perspectiveFront" }, undefined);
    expect(base.willChange).toBe("transform");
  });

  it("should apply light rig gradient overlay", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(
      base,
      { lightRigType: "threePt", lightRigDirection: "tl" },
      undefined,
    );
    expect(base.backgroundImage).toBeDefined();
    expect(base.backgroundImage).toContain("linear-gradient");
  });

  it("should apply harsh light rig filter", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(
      base,
      { lightRigType: "harsh", lightRigDirection: "t" },
      undefined,
    );
    expect(base.filter).toContain("contrast");
    expect(base.backgroundImage).toContain("linear-gradient");
  });

  it("should layer light gradient on top of existing background image", () => {
    const base: React.CSSProperties = {
      backgroundImage: "linear-gradient(red, blue)",
    };
    apply3dEffects(base, { lightRigType: "threePt" }, undefined);
    expect(base.backgroundImage).toContain("linear-gradient(red, blue)");
    expect(base.backgroundImage).toContain("rgba(255,255,255,");
  });

  it("should combine all 3D effects without conflicts", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(
      base,
      {
        cameraPreset: "perspectiveAbove",
        lightRigType: "threePt",
        hasBackdrop: true,
      },
      {
        extrusionHeight: 47625,
        extrusionColor: "#4472C4",
        bevelTopType: "circle",
        bevelTopWidth: 19050,
        bevelTopHeight: 19050,
        presetMaterial: "plastic",
      },
    );

    expect(base.perspective).toBe("1000px");
    expect(base.transform).toContain("rotateX(-20deg)");
    expect(base.boxShadow).toBeDefined();
    expect(base.boxShadow).toContain("#4472C4"); // extrusion
    expect(base.boxShadow).toContain("inset"); // bevel + material
    expect(base.boxShadow).toContain("rgba(0,0,0,0.25)"); // backdrop
    expect(base.filter).toContain("brightness"); // material + light rig
    expect(base.backgroundImage).toContain("linear-gradient"); // light rig
    expect(base.willChange).toBe("transform");
  });

  it("should handle contour width and color", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(base, undefined, {
      contourWidth: 19050,
      contourColor: "#FF0000",
    });
    expect(base.boxShadow).toBeDefined();
    expect(base.boxShadow).toContain("#FF0000");
  });

  it("should not apply extrusion for zero height", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(base, undefined, { extrusionHeight: 0 });
    expect(base.boxShadow).toBeUndefined();
  });

  it("should preserve existing boxShadow when adding 3D shadows", () => {
    const base: React.CSSProperties = {
      boxShadow: "2px 2px 4px rgba(0,0,0,0.5)",
    };
    apply3dEffects(base, undefined, {
      extrusionHeight: 28575,
      extrusionColor: "#000",
    });
    expect(base.boxShadow).toContain("2px 2px 4px rgba(0,0,0,0.5)");
    expect(base.boxShadow).toContain("#000");
  });

  it("should preserve existing filter when adding material filter", () => {
    const base: React.CSSProperties = { filter: "blur(2px)" };
    apply3dEffects(base, undefined, { presetMaterial: "metal" });
    expect(base.filter).toContain("blur(2px)");
    expect(base.filter).toContain("brightness");
  });
});
