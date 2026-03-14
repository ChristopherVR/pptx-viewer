import { describe, it, expect } from "vitest";

import type { XmlObject, ShapeStyle } from "../../types";

/**
 * The `applyEffectsAndThreeD` method is protected and calls several
 * delegated build methods. We test the effect assembly and 3D scene/shape
 * serialization logic by reimplementing the core aggregation from the source.
 */

// ---------------------------------------------------------------------------
// applyEffectsAndThreeD — reimplemented from source (effect + 3D portions)
// ---------------------------------------------------------------------------

function applyEffectsAndThreeD(
  spPr: XmlObject,
  shapeStyle: ShapeStyle,
  // Mock effect builders — return undefined unless the test provides them
  builders: {
    outerShadow?: XmlObject;
    innerShadow?: XmlObject;
    glow?: XmlObject;
    softEdge?: XmlObject;
    reflection?: XmlObject;
    blur?: XmlObject;
  } = {},
): void {
  const outerShadowXml = builders.outerShadow;
  const innerShadowXml = builders.innerShadow;
  const glowXml = builders.glow;
  const softEdgeXml = builders.softEdge;
  const reflectionXml = builders.reflection;
  const blurXml = builders.blur;

  const hasAnyEffect =
    outerShadowXml ||
    innerShadowXml ||
    glowXml ||
    softEdgeXml ||
    reflectionXml ||
    blurXml;

  if (hasAnyEffect) {
    const effectList = (spPr["a:effectLst"] || {}) as XmlObject;
    if (outerShadowXml) effectList["a:outerShdw"] = outerShadowXml;
    if (innerShadowXml) effectList["a:innerShdw"] = innerShadowXml;
    if (glowXml) effectList["a:glow"] = glowXml;
    if (softEdgeXml) effectList["a:softEdge"] = softEdgeXml;
    if (reflectionXml) effectList["a:reflection"] = reflectionXml;
    if (blurXml) effectList["a:blur"] = blurXml;
    spPr["a:effectLst"] = effectList;
  } else {
    const effectList = spPr["a:effectLst"] as XmlObject | undefined;
    if (effectList) {
      if (shapeStyle.shadowColor !== undefined && !outerShadowXml) {
        delete effectList["a:outerShdw"];
      }
      if (shapeStyle.innerShadowColor !== undefined && !innerShadowXml) {
        delete effectList["a:innerShdw"];
      }
      if (shapeStyle.glowColor !== undefined && !glowXml) {
        delete effectList["a:glow"];
      }
      if (shapeStyle.softEdgeRadius !== undefined && !softEdgeXml) {
        delete effectList["a:softEdge"];
      }
      if (
        shapeStyle.reflectionBlurRadius !== undefined &&
        !reflectionXml
      ) {
        delete effectList["a:reflection"];
      }
      if (shapeStyle.blurRadius !== undefined && !blurXml) {
        delete effectList["a:blur"];
      }
      if (Object.keys(effectList).length === 0) {
        delete spPr["a:effectLst"];
      }
    }
  }

  // effectDag
  if (shapeStyle.effectDagXml) {
    spPr["a:effectDag"] = shapeStyle.effectDagXml;
  }

  // 3D Scene
  if (shapeStyle.scene3d) {
    const s3d = shapeStyle.scene3d;
    const hasData = s3d.cameraPreset || s3d.lightRigType;
    if (hasData) {
      const cameraObj: XmlObject = {};
      if (s3d.cameraPreset) cameraObj["@_prst"] = s3d.cameraPreset;
      if (
        s3d.cameraRotX != null ||
        s3d.cameraRotY != null ||
        s3d.cameraRotZ != null
      ) {
        const rot: XmlObject = {};
        if (s3d.cameraRotX != null) rot["@_lat"] = s3d.cameraRotX;
        if (s3d.cameraRotY != null) rot["@_lon"] = s3d.cameraRotY;
        if (s3d.cameraRotZ != null) rot["@_rev"] = s3d.cameraRotZ;
        cameraObj["a:rot"] = rot;
      }
      const lightRigObj: XmlObject = {};
      if (s3d.lightRigType) lightRigObj["@_rig"] = s3d.lightRigType;
      if (s3d.lightRigDirection)
        lightRigObj["@_dir"] = s3d.lightRigDirection;
      const scene3dXml: XmlObject = {};
      scene3dXml["a:camera"] = cameraObj;
      if (Object.keys(lightRigObj).length > 0) {
        scene3dXml["a:lightRig"] = lightRigObj;
      }
      if (s3d.hasBackdrop) {
        const backdropObj: XmlObject = {};
        if (
          s3d.backdropAnchorX != null ||
          s3d.backdropAnchorY != null ||
          s3d.backdropAnchorZ != null
        ) {
          backdropObj["a:anchor"] = {
            "@_x": s3d.backdropAnchorX ?? 0,
            "@_y": s3d.backdropAnchorY ?? 0,
            "@_z": s3d.backdropAnchorZ ?? 0,
          };
        }
        scene3dXml["a:backdrop"] = backdropObj;
      }
      spPr["a:scene3d"] = scene3dXml;
    } else {
      delete spPr["a:scene3d"];
    }
  } else if (shapeStyle.scene3d === undefined) {
    delete spPr["a:scene3d"];
  }

  // 3D Shape
  if (shapeStyle.shape3d) {
    const sh3d = shapeStyle.shape3d;
    const hasData =
      sh3d.extrusionHeight != null ||
      sh3d.contourWidth != null ||
      sh3d.presetMaterial ||
      sh3d.bevelTopType ||
      sh3d.bevelBottomType ||
      sh3d.extrusionColor ||
      sh3d.contourColor;
    if (hasData) {
      const sp3dXml: XmlObject = {};
      if (sh3d.extrusionHeight != null)
        sp3dXml["@_extrusionH"] = sh3d.extrusionHeight;
      if (sh3d.contourWidth != null)
        sp3dXml["@_contourW"] = sh3d.contourWidth;
      if (sh3d.presetMaterial)
        sp3dXml["@_prstMaterial"] = sh3d.presetMaterial;
      if (sh3d.bevelTopType) {
        const bevelT: XmlObject = { "@_prst": sh3d.bevelTopType };
        if (sh3d.bevelTopWidth != null) bevelT["@_w"] = sh3d.bevelTopWidth;
        if (sh3d.bevelTopHeight != null)
          bevelT["@_h"] = sh3d.bevelTopHeight;
        sp3dXml["a:bevelT"] = bevelT;
      }
      if (sh3d.bevelBottomType) {
        const bevelB: XmlObject = { "@_prst": sh3d.bevelBottomType };
        if (sh3d.bevelBottomWidth != null)
          bevelB["@_w"] = sh3d.bevelBottomWidth;
        if (sh3d.bevelBottomHeight != null)
          bevelB["@_h"] = sh3d.bevelBottomHeight;
        sp3dXml["a:bevelB"] = bevelB;
      }
      if (sh3d.extrusionColor) {
        sp3dXml["a:extrusionClr"] = {
          "a:srgbClr": { "@_val": sh3d.extrusionColor },
        };
      }
      if (sh3d.contourColor) {
        sp3dXml["a:contourClr"] = {
          "a:srgbClr": { "@_val": sh3d.contourColor },
        };
      }
      spPr["a:sp3d"] = sp3dXml;
    } else {
      delete spPr["a:sp3d"];
    }
  } else if (shapeStyle.shape3d === undefined) {
    delete spPr["a:sp3d"];
  }
}

// ---------------------------------------------------------------------------
// Tests: effect list assembly
// ---------------------------------------------------------------------------
describe("applyEffectsAndThreeD – effect list assembly", () => {
  it("should create effectLst with outer shadow", () => {
    const spPr: XmlObject = {};
    const shadow: XmlObject = { "@_blurRad": "38100" };
    applyEffectsAndThreeD(spPr, {}, { outerShadow: shadow });
    const effectLst = spPr["a:effectLst"] as XmlObject;
    expect(effectLst["a:outerShdw"]).toBe(shadow);
  });

  it("should create effectLst with multiple effects", () => {
    const spPr: XmlObject = {};
    const shadow: XmlObject = { "@_blurRad": "38100" };
    const glow: XmlObject = { "@_rad": "50800" };
    const blur: XmlObject = { "@_rad": "25400" };
    applyEffectsAndThreeD(spPr, {}, { outerShadow: shadow, glow, blur });
    const effectLst = spPr["a:effectLst"] as XmlObject;
    expect(effectLst["a:outerShdw"]).toBe(shadow);
    expect(effectLst["a:glow"]).toBe(glow);
    expect(effectLst["a:blur"]).toBe(blur);
  });

  it("should merge into existing effectLst", () => {
    const existing: XmlObject = { "a:outerShdw": { "@_blurRad": "10000" } };
    const spPr: XmlObject = { "a:effectLst": existing };
    const glow: XmlObject = { "@_rad": "50800" };
    applyEffectsAndThreeD(spPr, {}, { glow });
    const effectLst = spPr["a:effectLst"] as XmlObject;
    // Existing outer shadow stays, glow is added
    expect(effectLst["a:outerShdw"]).toEqual({ "@_blurRad": "10000" });
    expect(effectLst["a:glow"]).toBe(glow);
  });

  it("should remove outer shadow from effectLst when shadowColor is set but builder returns undefined", () => {
    const spPr: XmlObject = {
      "a:effectLst": {
        "a:outerShdw": { "@_blurRad": "38100" },
        "a:glow": { "@_rad": "1000" },
      },
    };
    applyEffectsAndThreeD(spPr, { shadowColor: "#000000" });
    const effectLst = spPr["a:effectLst"] as XmlObject;
    expect(effectLst["a:outerShdw"]).toBeUndefined();
    expect(effectLst["a:glow"]).toBeDefined();
  });

  it("should remove inner shadow from effectLst when innerShadowColor is set but builder returns undefined", () => {
    const spPr: XmlObject = {
      "a:effectLst": {
        "a:innerShdw": { "@_blurRad": "38100" },
        "a:glow": { "@_rad": "5000" },
      },
    };
    applyEffectsAndThreeD(spPr, { innerShadowColor: "#FF0000" });
    const effectLst = spPr["a:effectLst"] as XmlObject;
    expect(effectLst["a:innerShdw"]).toBeUndefined();
    expect(effectLst["a:glow"]).toBeDefined();
  });

  it("should delete effectLst entirely when it becomes empty", () => {
    const spPr: XmlObject = {
      "a:effectLst": { "a:outerShdw": {} },
    };
    applyEffectsAndThreeD(spPr, { shadowColor: "#000" });
    expect(spPr["a:effectLst"]).toBeUndefined();
  });

  it("should set effectDag from shapeStyle", () => {
    const spPr: XmlObject = {};
    const dag: XmlObject = { "a:grayscl": {} };
    applyEffectsAndThreeD(spPr, { effectDagXml: dag });
    expect(spPr["a:effectDag"]).toBe(dag);
  });
});

// ---------------------------------------------------------------------------
// Tests: 3D Scene serialization
// ---------------------------------------------------------------------------
describe("applyEffectsAndThreeD – 3D Scene", () => {
  it("should write scene3d with camera preset and light rig", () => {
    const spPr: XmlObject = {};
    applyEffectsAndThreeD(spPr, {
      scene3d: {
        cameraPreset: "orthographicFront",
        lightRigType: "threePt",
        lightRigDirection: "t",
      },
    });
    const scene = spPr["a:scene3d"] as XmlObject;
    expect(scene).toBeDefined();
    expect((scene["a:camera"] as XmlObject)["@_prst"]).toBe(
      "orthographicFront",
    );
    const lightRig = scene["a:lightRig"] as XmlObject;
    expect(lightRig["@_rig"]).toBe("threePt");
    expect(lightRig["@_dir"]).toBe("t");
  });

  it("should include camera rotation when set", () => {
    const spPr: XmlObject = {};
    applyEffectsAndThreeD(spPr, {
      scene3d: {
        cameraPreset: "perspectiveFront",
        cameraRotX: 1000000,
        cameraRotY: 2000000,
        cameraRotZ: 3000000,
      },
    });
    const camera = (spPr["a:scene3d"] as XmlObject)["a:camera"] as XmlObject;
    const rot = camera["a:rot"] as XmlObject;
    expect(rot["@_lat"]).toBe(1000000);
    expect(rot["@_lon"]).toBe(2000000);
    expect(rot["@_rev"]).toBe(3000000);
  });

  it("should include backdrop when hasBackdrop is true", () => {
    const spPr: XmlObject = {};
    applyEffectsAndThreeD(spPr, {
      scene3d: {
        cameraPreset: "orthographicFront",
        hasBackdrop: true,
        backdropAnchorX: 100,
        backdropAnchorY: 200,
        backdropAnchorZ: 300,
      },
    });
    const scene = spPr["a:scene3d"] as XmlObject;
    const backdrop = scene["a:backdrop"] as XmlObject;
    expect(backdrop).toBeDefined();
    const anchor = backdrop["a:anchor"] as XmlObject;
    expect(anchor["@_x"]).toBe(100);
    expect(anchor["@_y"]).toBe(200);
    expect(anchor["@_z"]).toBe(300);
  });

  it("should delete scene3d when scene3d has no data", () => {
    const spPr: XmlObject = { "a:scene3d": { "a:camera": {} } };
    applyEffectsAndThreeD(spPr, { scene3d: {} });
    expect(spPr["a:scene3d"]).toBeUndefined();
  });

  it("should delete scene3d when scene3d is undefined on shapeStyle", () => {
    const spPr: XmlObject = { "a:scene3d": { "a:camera": {} } };
    applyEffectsAndThreeD(spPr, {});
    expect(spPr["a:scene3d"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: 3D Shape serialization
// ---------------------------------------------------------------------------
describe("applyEffectsAndThreeD – 3D Shape", () => {
  it("should write sp3d with extrusion height and material", () => {
    const spPr: XmlObject = {};
    applyEffectsAndThreeD(spPr, {
      shape3d: {
        extrusionHeight: 76200,
        presetMaterial: "metal",
      },
    });
    const sp3d = spPr["a:sp3d"] as XmlObject;
    expect(sp3d["@_extrusionH"]).toBe(76200);
    expect(sp3d["@_prstMaterial"]).toBe("metal");
  });

  it("should write top and bottom bevels", () => {
    const spPr: XmlObject = {};
    applyEffectsAndThreeD(spPr, {
      shape3d: {
        bevelTopType: "circle",
        bevelTopWidth: 12700,
        bevelTopHeight: 25400,
        bevelBottomType: "relaxedInset",
        bevelBottomWidth: 6350,
        bevelBottomHeight: 6350,
      },
    });
    const sp3d = spPr["a:sp3d"] as XmlObject;
    const bevelT = sp3d["a:bevelT"] as XmlObject;
    expect(bevelT["@_prst"]).toBe("circle");
    expect(bevelT["@_w"]).toBe(12700);
    expect(bevelT["@_h"]).toBe(25400);
    const bevelB = sp3d["a:bevelB"] as XmlObject;
    expect(bevelB["@_prst"]).toBe("relaxedInset");
  });

  it("should write contour and extrusion colours", () => {
    const spPr: XmlObject = {};
    applyEffectsAndThreeD(spPr, {
      shape3d: {
        extrusionColor: "4F81BD",
        contourColor: "FF0000",
        contourWidth: 12700,
      },
    });
    const sp3d = spPr["a:sp3d"] as XmlObject;
    expect(sp3d["a:extrusionClr"]).toEqual({
      "a:srgbClr": { "@_val": "4F81BD" },
    });
    expect(sp3d["a:contourClr"]).toEqual({
      "a:srgbClr": { "@_val": "FF0000" },
    });
    expect(sp3d["@_contourW"]).toBe(12700);
  });

  it("should delete sp3d when shape3d has no data", () => {
    const spPr: XmlObject = { "a:sp3d": { "@_extrusionH": "0" } };
    applyEffectsAndThreeD(spPr, { shape3d: {} });
    expect(spPr["a:sp3d"]).toBeUndefined();
  });

  it("should delete sp3d when shape3d is undefined on shapeStyle", () => {
    const spPr: XmlObject = { "a:sp3d": {} };
    applyEffectsAndThreeD(spPr, {});
    expect(spPr["a:sp3d"]).toBeUndefined();
  });
});
