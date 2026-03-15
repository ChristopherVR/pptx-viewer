import { describe, it, expect } from "vitest";
import type React from "react";

import {
  apply3dEffects,
  build3DExtrusionData,
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

  it("caps at 40 layers for large extrusion values", () => {
    const result = getExtrusionShadow({
      extrusionHeight: 9525 * 100, // 100px → capped to 40 layers with stepping
      extrusionColor: "#FF0000",
    });
    expect(result).toBeDefined();
    // Count shadow entries by looking for "px" offset pairs followed by spread or blur
    // Each shadow entry starts with a pixel offset like "1px 1px"
    const entryCount = (result!.match(/\d+px \-?\d+px/g) ?? []).length;
    // 40 depth layers + 1 soft shadow = 41
    expect(entryCount).toBeLessThanOrEqual(42);
    expect(entryCount).toBeGreaterThanOrEqual(30);
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
    // Flood now includes a subtle wash gradient for even illumination
    expect(result.backgroundImage).toBeDefined();
    expect(result.backgroundImage).toContain("linear-gradient");
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

  it("should compose transform with existing transform", () => {
    const base: React.CSSProperties = { transform: "scaleX(-1)" };
    apply3dEffects(base, { cameraPreset: "perspectiveAbove" }, undefined);
    expect(base.transform).toContain("scaleX(-1)");
    expect(base.transform).toContain("rotateX(-20deg)");
  });

  it("should add translateZ for extrusion depth", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(base, undefined, {
      extrusionHeight: 95250, // 10px
    });
    expect(base.transform).toContain("translateZ(");
  });
});

// ── build3DExtrusionData ─────────────────────────────────────────────────

describe("build3DExtrusionData", () => {
  it("returns hasExtrusion: false when no shape3d", () => {
    const result = build3DExtrusionData(undefined, undefined, "#000", 100, 100);
    expect(result.hasExtrusion).toBe(false);
    expect(result.panels).toHaveLength(0);
  });

  it("returns hasExtrusion: false when extrusionHeight is zero", () => {
    const result = build3DExtrusionData(
      { extrusionHeight: 0 },
      undefined,
      "#000",
      100,
      100,
    );
    expect(result.hasExtrusion).toBe(false);
  });

  it("returns hasExtrusion: true with panels for valid extrusion", () => {
    const result = build3DExtrusionData(
      { extrusionHeight: 95250, extrusionColor: "#4472C4" }, // 10px
      { cameraPreset: "perspectiveFront" },
      "#4472C4",
      200,
      150,
    );
    expect(result.hasExtrusion).toBe(true);
    expect(result.panels.length).toBeGreaterThan(0);
    expect(result.panels.length).toBeLessThanOrEqual(4);
  });

  it("wrapper style has preserve-3d and perspective", () => {
    const result = build3DExtrusionData(
      { extrusionHeight: 95250 },
      { cameraPreset: "perspectiveFront" },
      "#888",
      200,
      100,
    );
    expect(result.wrapperStyle.transformStyle).toBe("preserve-3d");
    expect(result.wrapperStyle.perspective).toBe("1000px");
    expect(result.wrapperStyle.pointerEvents).toBe("none");
  });

  it("front face style has translateZ", () => {
    const result = build3DExtrusionData(
      { extrusionHeight: 95250 }, // 10px depth
      undefined,
      "#888",
      200,
      100,
    );
    expect(result.frontFaceStyle.transform).toContain("translateZ(");
    expect(result.frontFaceStyle.backfaceVisibility).toBe("hidden");
  });

  it("generates side panels with correct dimensions", () => {
    const result = build3DExtrusionData(
      { extrusionHeight: 95250 }, // 10px depth
      { cameraPreset: "perspectiveFront" },
      "#888",
      200,
      100,
    );
    // With no rotation, all 4 sides should be visible
    const sides = result.panels.map((p) => p.side);
    expect(sides).toContain("bottom");
    expect(sides).toContain("top");
    expect(sides).toContain("left");
    expect(sides).toContain("right");
  });

  it("bottom panel has correct width and depth", () => {
    const result = build3DExtrusionData(
      { extrusionHeight: 95250 }, // 10px
      { cameraPreset: "perspectiveFront" },
      "#888",
      200,
      100,
    );
    const bottom = result.panels.find((p) => p.side === "bottom");
    expect(bottom).toBeDefined();
    expect(bottom!.style.width).toBe(200);
    expect(bottom!.style.height).toBe(10); // depth in px
  });

  it("right panel has correct height and depth", () => {
    const result = build3DExtrusionData(
      { extrusionHeight: 95250 }, // 10px
      { cameraPreset: "perspectiveFront" },
      "#888",
      200,
      100,
    );
    const right = result.panels.find((p) => p.side === "right");
    expect(right).toBeDefined();
    expect(right!.style.width).toBe(10); // depth in px
    expect(right!.style.height).toBe(100);
  });

  it("panels have rotateX/Y transforms for perspective camera", () => {
    const result = build3DExtrusionData(
      { extrusionHeight: 95250 },
      { cameraPreset: "perspectiveAbove" }, // rotateX = -20
      "#888",
      200,
      100,
    );
    const bottom = result.panels.find((p) => p.side === "bottom");
    expect(bottom?.style.transform).toContain("rotateX(-20deg)");
    expect(bottom?.style.transform).toContain("rotateX(-90deg)");
  });

  it("uses extrusionColor for side face colouring", () => {
    const result = build3DExtrusionData(
      { extrusionHeight: 95250, extrusionColor: "#FF0000" },
      undefined,
      "#0000FF",
      200,
      100,
    );
    // All panels should use the extrusion colour (darkened)
    for (const panel of result.panels) {
      expect(panel.style.background).toBeDefined();
    }
  });

  it("falls back to fillColor when extrusionColor not set", () => {
    const result = build3DExtrusionData(
      { extrusionHeight: 95250 },
      undefined,
      "#00FF00",
      200,
      100,
    );
    // Panels should be generated (using fill colour)
    expect(result.panels.length).toBeGreaterThan(0);
  });

  it("caps extrusion depth at 80px", () => {
    const result = build3DExtrusionData(
      { extrusionHeight: 9525 * 200 }, // 200px raw, should cap at 80
      undefined,
      "#888",
      200,
      100,
    );
    const bottom = result.panels.find((p) => p.side === "bottom");
    expect(bottom!.style.height).toBe(80);
  });

  it("includes material overlay for plastic material", () => {
    const result = build3DExtrusionData(
      { extrusionHeight: 95250, presetMaterial: "plastic" },
      undefined,
      "#888",
      200,
      100,
    );
    expect(result.materialOverlay).toBeDefined();
    expect(result.materialOverlay).toContain("linear-gradient");
  });

  it("includes material overlay for metal material", () => {
    const result = build3DExtrusionData(
      { extrusionHeight: 95250, presetMaterial: "metal" },
      undefined,
      "#888",
      200,
      100,
    );
    expect(result.materialOverlay).toBeDefined();
    expect(result.materialOverlay).toContain("linear-gradient");
    // Metal should have high-contrast specular highlights
    expect(result.materialOverlay).toContain("rgba(255,255,255,0.3)");
  });

  it("returns no material overlay for flat material", () => {
    const result = build3DExtrusionData(
      { extrusionHeight: 95250, presetMaterial: "flat" },
      undefined,
      "#888",
      200,
      100,
    );
    expect(result.materialOverlay).toBeUndefined();
  });

  it("applies default 800px perspective when no scene3d", () => {
    const result = build3DExtrusionData(
      { extrusionHeight: 95250 },
      undefined,
      "#888",
      200,
      100,
    );
    expect(result.wrapperStyle.perspective).toBe("800px");
  });

  it("uses scene3d perspective when provided", () => {
    const result = build3DExtrusionData(
      { extrusionHeight: 95250 },
      { cameraPreset: "perspectiveHeroicLeftFacing" }, // 600px
      "#888",
      200,
      100,
    );
    expect(result.wrapperStyle.perspective).toBe("600px");
  });

  it("selectively shows panels based on camera angle", () => {
    // Camera from far left: rotateY > 5 hides left, shows right
    const result = build3DExtrusionData(
      { extrusionHeight: 95250 },
      { cameraPreset: "perspectiveHeroicExtremeLeftFacing" }, // rotateY = 45
      "#888",
      200,
      100,
    );
    const sides = result.panels.map((p) => p.side);
    // With rotateY = 45, left panel should NOT be visible (rotateY >= -5 is the check)
    // but right panel should be (rotateY <= 5 fails since 45 > 5, so right NOT shown)
    // Actually the logic is: showRight = rotateY <= 5, showLeft = rotateY >= -5
    // rotateY = 45: showRight = false, showLeft = true
    expect(sides).toContain("left");
    expect(sides).not.toContain("right");
  });

  it("uses direction-aware gradients on side panels based on camera angle", () => {
    // Camera from above-left: bottom and right panels should be lit
    const result = build3DExtrusionData(
      { extrusionHeight: 95250 }, // 10px
      { cameraPreset: "perspectiveAboveLeftFacing" }, // rotateX = -20, rotateY = 25
      "#888888",
      200,
      100,
    );
    // Bottom panel should have the lighter gradient (camera from above => lit from top)
    const bottom = result.panels.find((p) => p.side === "bottom");
    expect(bottom).toBeDefined();
    expect(bottom!.style.background).toBeDefined();
    const bottomBg = bottom!.style.background as string;
    expect(bottomBg).toContain("linear-gradient");

    // Left panel is visible (rotateY >= -5 => yes since rotateY = 25)
    const left = result.panels.find((p) => p.side === "left");
    expect(left).toBeDefined();
  });

  it("applies camera-aware material gradient overlay", () => {
    // With camera rotation, the material gradient angle should shift
    const resultFront = build3DExtrusionData(
      { extrusionHeight: 95250, presetMaterial: "metal" },
      { cameraPreset: "perspectiveFront" }, // rotateX = 0, rotateY = 0
      "#888",
      200,
      100,
    );
    expect(resultFront.materialOverlay).toBeDefined();
    expect(resultFront.materialOverlay).toContain("135deg"); // default angle

    const resultRight = build3DExtrusionData(
      { extrusionHeight: 95250, presetMaterial: "metal" },
      { cameraPreset: "perspectiveRight" }, // rotateY = -20
      "#888",
      200,
      100,
    );
    expect(resultRight.materialOverlay).toBeDefined();
    // Camera right (rotateY = -20) should shift highlight angle
    expect(resultRight.materialOverlay).not.toContain("135deg");
  });

  it("includes softEdge material gradient overlay", () => {
    const result = build3DExtrusionData(
      { extrusionHeight: 95250, presetMaterial: "softEdge" },
      undefined,
      "#888",
      200,
      100,
    );
    expect(result.materialOverlay).toBeDefined();
    expect(result.materialOverlay).toContain("radial-gradient");
  });
});

// ── Enhanced lighting (multi-gradient rigs) ───────────────────────────────

describe("getLightRigCss (enhanced multi-gradient)", () => {
  it("threePt rig produces multi-layer gradient", () => {
    const result = getLightRigCss("threePt", undefined);
    expect(result.backgroundImage).toBeDefined();
    // Should have multiple gradient layers (key, fill, back)
    const layers = result.backgroundImage!.split("linear-gradient");
    expect(layers.length).toBeGreaterThanOrEqual(3); // 3 linear-gradients
  });

  it("contrasting rig produces key and fill gradients", () => {
    const result = getLightRigCss("contrasting", undefined);
    expect(result.backgroundImage).toBeDefined();
    const layers = result.backgroundImage!.split("linear-gradient");
    expect(layers.length).toBeGreaterThanOrEqual(2);
    expect(result.filter).toContain("contrast");
  });

  it("balanced rig produces soft multi-directional gradients", () => {
    const result = getLightRigCss("balanced", undefined);
    expect(result.backgroundImage).toBeDefined();
    // 3 directional gradients: top, bottom, left
    const layers = result.backgroundImage!.split("linear-gradient");
    expect(layers.length).toBeGreaterThanOrEqual(3);
  });

  it("sunrise rig includes both linear and radial gradients", () => {
    const result = getLightRigCss("sunrise", undefined);
    expect(result.backgroundImage).toBeDefined();
    expect(result.backgroundImage).toContain("linear-gradient");
    expect(result.backgroundImage).toContain("radial-gradient");
  });

  it("rotates all gradient angles when direction is specified", () => {
    // Default threePt has angles 135, 315, 0 deg
    const resultDefault = getLightRigCss("threePt", undefined);
    const resultRight = getLightRigCss("threePt", "r");

    expect(resultDefault.backgroundImage).toBeDefined();
    expect(resultRight.backgroundImage).toBeDefined();

    // "r" direction = 270deg, default is 135deg, delta = +135
    // 135 + 135 = 270, 315 + 135 = 90, 0 + 135 = 135
    expect(resultRight.backgroundImage).toContain("270deg");
    expect(resultRight.backgroundImage).toContain("90deg");
  });

  it("does not rotate radial gradients in mixed layers", () => {
    // sunrise has radial-gradient + linear-gradient
    const resultTop = getLightRigCss("sunrise", "t");
    expect(resultTop.backgroundImage).toBeDefined();
    // radial-gradient should remain untouched
    expect(resultTop.backgroundImage).toContain("radial-gradient(ellipse at 20% 80%");
  });

  it("legacy harsh rigs use multi-layer gradients", () => {
    const result = getLightRigCss("legacyHarsh1", undefined);
    expect(result.backgroundImage).toBeDefined();
    expect(result.filter).toContain("contrast");
    // Should have both highlight and shadow gradients
    const layers = result.backgroundImage!.split("linear-gradient");
    expect(layers.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Enhanced bevel rendering ─────────────────────────────────────────────

describe("get3DBevelShadow (enhanced multi-layer)", () => {
  it("circle bevel produces 4 shadow layers (highlight + inner glow + shadow + inner shadow)", () => {
    const result = get3DBevelShadow({
      bevelTopType: "circle",
      bevelTopWidth: 19050, // 2px
      bevelTopHeight: 19050, // 2px
    });
    expect(result).toBeDefined();
    // circle bevel now has 4 layers
    const layers = result!.split(", inset");
    expect(layers.length).toBeGreaterThanOrEqual(4);
  });

  it("relaxedInset bevel includes ambient shadow layer", () => {
    const result = get3DBevelShadow({
      bevelTopType: "relaxedInset",
      bevelTopWidth: 19050,
      bevelTopHeight: 19050,
    });
    expect(result).toBeDefined();
    // relaxedInset has 3 layers (highlight, shadow, ambient)
    const layers = result!.split(", inset");
    expect(layers.length).toBeGreaterThanOrEqual(3);
    // Should contain an ambient shadow (0 0 Npx)
    expect(result).toContain("inset 0 0");
  });

  it("hardEdge bevel includes secondary highlight layer", () => {
    const result = get3DBevelShadow({
      bevelTopType: "hardEdge",
      bevelTopWidth: 19050,
      bevelTopHeight: 19050,
    });
    expect(result).toBeDefined();
    // hardEdge now has 3 layers (primary highlight, primary shadow, secondary highlight)
    const layers = result!.split(", inset");
    expect(layers.length).toBeGreaterThanOrEqual(3);
  });

  it("artDeco bevel produces 5 layers with geometric nesting", () => {
    const result = get3DBevelShadow({
      bevelTopType: "artDeco",
      bevelTopWidth: 19050,
      bevelTopHeight: 19050,
    });
    expect(result).toBeDefined();
    // artDeco: 3 highlight layers (1x, 2x, 3x offset) + 2 shadow layers
    const layers = result!.split(", inset");
    expect(layers.length).toBeGreaterThanOrEqual(5);
  });

  it("convex bevel includes central glow and edge shadow", () => {
    const result = get3DBevelShadow({
      bevelTopType: "convex",
      bevelTopWidth: 19050,
      bevelTopHeight: 19050,
    });
    expect(result).toBeDefined();
    // convex: central glow + directional highlight + directional shadow + deep shadow
    const layers = result!.split(", inset");
    expect(layers.length).toBeGreaterThanOrEqual(4);
    // Central glow has 0 offset
    expect(result).toContain("inset 0 0");
  });

  it("riblet bevel has 4 layers with alternating ridges", () => {
    const result = get3DBevelShadow({
      bevelTopType: "riblet",
      bevelTopWidth: 19050,
      bevelTopHeight: 19050,
    });
    expect(result).toBeDefined();
    // riblet: highlight ridge + shadow ridge + 2nd highlight + 2nd shadow
    const layers = result!.split(", inset");
    expect(layers.length).toBeGreaterThanOrEqual(4);
  });

  it("coolSlant bevel has asymmetric highlight with 3 layers", () => {
    const result = get3DBevelShadow({
      bevelTopType: "coolSlant",
      bevelTopWidth: 19050,
      bevelTopHeight: 19050,
    });
    expect(result).toBeDefined();
    const layers = result!.split(", inset");
    expect(layers.length).toBeGreaterThanOrEqual(3);
  });

  it("divot bevel includes ambient shadow at center", () => {
    const result = get3DBevelShadow({
      bevelTopType: "divot",
      bevelTopWidth: 19050,
      bevelTopHeight: 19050,
    });
    expect(result).toBeDefined();
    // divot: reversed highlight + shadow + ambient
    expect(result).toContain("inset 0 0");
  });
});

// ── Material backgroundImage integration in apply3dEffects ──────────────

describe("apply3dEffects (material backgroundImage)", () => {
  it("applies material backgroundImage for plastic material", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(base, undefined, { presetMaterial: "plastic" });
    expect(base.backgroundImage).toBeDefined();
    expect(base.backgroundImage).toContain("radial-gradient");
  });

  it("applies material backgroundImage for metal material", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(base, undefined, { presetMaterial: "metal" });
    expect(base.backgroundImage).toBeDefined();
    expect(base.backgroundImage).toContain("linear-gradient");
  });

  it("layers material backgroundImage with light rig gradient", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(
      base,
      { lightRigType: "threePt" },
      { presetMaterial: "plastic" },
    );
    expect(base.backgroundImage).toBeDefined();
    // Should contain both material radial-gradient and light rig linear-gradient
    expect(base.backgroundImage).toContain("radial-gradient");
    expect(base.backgroundImage).toContain("linear-gradient");
  });

  it("layers material backgroundImage on top of existing background", () => {
    const base: React.CSSProperties = {
      backgroundImage: "url(existing.png)",
    };
    apply3dEffects(base, undefined, { presetMaterial: "matte" });
    expect(base.backgroundImage).toContain("url(existing.png)");
    expect(base.backgroundImage).toContain("linear-gradient");
  });

  it("does not add backgroundImage for flat material", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(base, undefined, { presetMaterial: "flat" });
    expect(base.backgroundImage).toBeUndefined();
  });

  it("applies dkEdge material with darkened edge box-shadow", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(base, undefined, { presetMaterial: "dkEdge" });
    expect(base.filter).toContain("brightness(0.85)");
    expect(base.boxShadow).toBeDefined();
    expect(base.boxShadow).toContain("inset");
    expect(base.backgroundImage).toBeDefined();
    expect(base.backgroundImage).toContain("radial-gradient");
  });

  it("applies clear material with opacity and backgroundImage", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(base, undefined, { presetMaterial: "clear" });
    expect(base.opacity).toBe(0.7);
    expect(base.backgroundImage).toBeDefined();
    expect(base.backgroundImage).toContain("linear-gradient");
    expect(base.boxShadow).toBeDefined();
  });

  it("applies softmetal material with specular and gradient", () => {
    const base: React.CSSProperties = {};
    apply3dEffects(base, undefined, { presetMaterial: "softmetal" });
    expect(base.filter).toContain("brightness(1.05)");
    expect(base.filter).toContain("contrast(1.08)");
    expect(base.boxShadow).toContain("inset");
    expect(base.backgroundImage).toBeDefined();
    expect(base.backgroundImage).toContain("linear-gradient");
  });
});
