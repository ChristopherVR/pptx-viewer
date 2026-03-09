import { describe, it, expect } from "vitest";
import { applyScene3dStyle, applyShape3dStyle } from "./shape-style-3d-helpers";
import type { Shape3dStyleContext } from "./shape-style-3d-helpers";
import type { ShapeStyle, XmlObject } from "../../types";

function makeStyle(overrides: Partial<ShapeStyle> = {}): ShapeStyle {
  return { ...overrides } as ShapeStyle;
}

function makeContext(
  overrides: Partial<Shape3dStyleContext> = {},
): Shape3dStyleContext {
  return {
    parseColor: (colorNode: XmlObject | undefined) => {
      if (!colorNode) return undefined;
      const srgb = colorNode["a:srgbClr"] as XmlObject | undefined;
      if (srgb) return `#${srgb["@_val"]}`;
      return undefined;
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// applyScene3dStyle
// ---------------------------------------------------------------------------

describe("applyScene3dStyle", () => {
  it("does nothing when a:scene3d is absent", () => {
    const style = makeStyle();
    applyScene3dStyle({}, style);
    expect(style.scene3d).toBeUndefined();
  });

  it("extracts camera preset type", () => {
    const shapeProps: XmlObject = {
      "a:scene3d": {
        "a:camera": { "@_prst": "orthographicFront" },
      },
    };
    const style = makeStyle();
    applyScene3dStyle(shapeProps, style);
    expect(style.scene3d?.cameraPreset).toBe("orthographicFront");
  });

  it("extracts camera rotation (lat/lon/rev)", () => {
    const shapeProps: XmlObject = {
      "a:scene3d": {
        "a:camera": {
          "@_prst": "perspectiveFront",
          "a:rot": {
            "@_lat": "3000000",
            "@_lon": "1200000",
            "@_rev": "600000",
          },
        },
      },
    };
    const style = makeStyle();
    applyScene3dStyle(shapeProps, style);
    expect(style.scene3d?.cameraPreset).toBe("perspectiveFront");
    expect(style.scene3d?.cameraRotX).toBe(3000000);
    expect(style.scene3d?.cameraRotY).toBe(1200000);
    expect(style.scene3d?.cameraRotZ).toBe(600000);
  });

  it("extracts light rig type and direction", () => {
    const shapeProps: XmlObject = {
      "a:scene3d": {
        "a:lightRig": { "@_rig": "threePt", "@_dir": "t" },
      },
    };
    const style = makeStyle();
    applyScene3dStyle(shapeProps, style);
    expect(style.scene3d?.lightRigType).toBe("threePt");
    expect(style.scene3d?.lightRigDirection).toBe("t");
  });

  it("handles missing camera and lightRig gracefully", () => {
    const shapeProps: XmlObject = { "a:scene3d": {} };
    const style = makeStyle();
    applyScene3dStyle(shapeProps, style);
    expect(style.scene3d).toBeDefined();
    expect(style.scene3d?.cameraPreset).toBeUndefined();
    expect(style.scene3d?.lightRigType).toBeUndefined();
  });

  it("extracts backdrop properties", () => {
    const shapeProps: XmlObject = {
      "a:scene3d": {
        "a:backdrop": {
          "a:anchor": { "@_x": "100", "@_y": "200", "@_z": "300" },
        },
      },
    };
    const style = makeStyle();
    applyScene3dStyle(shapeProps, style);
    expect(style.scene3d?.hasBackdrop).toBe(true);
    expect(style.scene3d?.backdropAnchorX).toBe(100);
    expect(style.scene3d?.backdropAnchorY).toBe(200);
    expect(style.scene3d?.backdropAnchorZ).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// applyShape3dStyle
// ---------------------------------------------------------------------------

describe("applyShape3dStyle", () => {
  it("does nothing when a:sp3d is absent", () => {
    const style = makeStyle();
    applyShape3dStyle({}, style, makeContext());
    expect(style.shape3d).toBeUndefined();
  });

  it("extracts extrusion height", () => {
    const shapeProps: XmlObject = {
      "a:sp3d": { "@_extrusionH": "76200" },
    };
    const style = makeStyle();
    applyShape3dStyle(shapeProps, style, makeContext());
    expect(style.shape3d?.extrusionHeight).toBe(76200);
  });

  it("extracts extrusion color", () => {
    const shapeProps: XmlObject = {
      "a:sp3d": {
        "a:extrusionClr": {
          "a:srgbClr": { "@_val": "4F81BD" },
        },
      },
    };
    const style = makeStyle();
    applyShape3dStyle(shapeProps, style, makeContext());
    expect(style.shape3d?.extrusionColor).toBe("#4F81BD");
  });

  it("extracts bevel top properties", () => {
    const shapeProps: XmlObject = {
      "a:sp3d": {
        "a:bevelT": { "@_prst": "relaxedInset", "@_w": "25400", "@_h": "12700" },
      },
    };
    const style = makeStyle();
    applyShape3dStyle(shapeProps, style, makeContext());
    expect(style.shape3d?.bevelTopType).toBe("relaxedInset");
    expect(style.shape3d?.bevelTopWidth).toBe(25400);
    expect(style.shape3d?.bevelTopHeight).toBe(12700);
  });

  it("extracts bevel bottom properties", () => {
    const shapeProps: XmlObject = {
      "a:sp3d": {
        "a:bevelB": { "@_prst": "angle", "@_w": "19050", "@_h": "9525" },
      },
    };
    const style = makeStyle();
    applyShape3dStyle(shapeProps, style, makeContext());
    expect(style.shape3d?.bevelBottomType).toBe("angle");
    expect(style.shape3d?.bevelBottomWidth).toBe(19050);
    expect(style.shape3d?.bevelBottomHeight).toBe(9525);
  });

  it("extracts preset material", () => {
    const shapeProps: XmlObject = {
      "a:sp3d": { "@_prstMaterial": "metal" },
    };
    const style = makeStyle();
    applyShape3dStyle(shapeProps, style, makeContext());
    expect(style.shape3d?.presetMaterial).toBe("metal");
  });

  it("extracts contour width and color", () => {
    const shapeProps: XmlObject = {
      "a:sp3d": {
        "@_contourW": "12700",
        "a:contourClr": {
          "a:srgbClr": { "@_val": "FF0000" },
        },
      },
    };
    const style = makeStyle();
    applyShape3dStyle(shapeProps, style, makeContext());
    expect(style.shape3d?.contourWidth).toBe(12700);
    expect(style.shape3d?.contourColor).toBe("#FF0000");
  });

  it("defaults bevel type to 'circle' when prst is missing", () => {
    const shapeProps: XmlObject = {
      "a:sp3d": {
        "a:bevelT": { "@_w": "10000", "@_h": "5000" },
      },
    };
    const style = makeStyle();
    applyShape3dStyle(shapeProps, style, makeContext());
    expect(style.shape3d?.bevelTopType).toBe("circle");
  });

  it("extracts a complete 3D shape with all properties", () => {
    const shapeProps: XmlObject = {
      "a:sp3d": {
        "@_extrusionH": "57150",
        "@_prstMaterial": "plastic",
        "@_contourW": "9525",
        "a:bevelT": { "@_prst": "softRound", "@_w": "25400", "@_h": "25400" },
        "a:bevelB": { "@_prst": "circle", "@_w": "12700", "@_h": "12700" },
        "a:extrusionClr": { "a:srgbClr": { "@_val": "0000FF" } },
        "a:contourClr": { "a:srgbClr": { "@_val": "00FF00" } },
      },
    };
    const style = makeStyle();
    applyShape3dStyle(shapeProps, style, makeContext());
    expect(style.shape3d?.extrusionHeight).toBe(57150);
    expect(style.shape3d?.presetMaterial).toBe("plastic");
    expect(style.shape3d?.contourWidth).toBe(9525);
    expect(style.shape3d?.bevelTopType).toBe("softRound");
    expect(style.shape3d?.bevelTopWidth).toBe(25400);
    expect(style.shape3d?.bevelBottomType).toBe("circle");
    expect(style.shape3d?.bevelBottomWidth).toBe(12700);
    expect(style.shape3d?.extrusionColor).toBe("#0000FF");
    expect(style.shape3d?.contourColor).toBe("#00FF00");
  });
});
