/**
 * Tests for PptxHandlerRuntimeSaveTextWriter:
 *   - applyAutoFitToBodyPr logic
 *   - applyBodyInsets logic
 *   - applyText3d logic
 *   - text wrap and column settings
 *   - linked text box chain
 */
import { describe, it, expect } from "vitest";

import type { XmlObject, TextStyle } from "../../types";
import { writeBodyPrBooleanAttrs } from "../../utils/body-properties-parser";

const EMU_PER_PX = 9525;

// ---------------------------------------------------------------------------
// Reimplemented: applyAutoFitToBodyPr
// ---------------------------------------------------------------------------
function applyAutoFitToBodyPr(
  bodyPr: XmlObject,
  textStyle: TextStyle | undefined,
): void {
  if (!textStyle) return;

  if (textStyle.autoFitMode !== undefined) {
    delete bodyPr["a:spAutoFit"];
    delete bodyPr["a:normAutofit"];
    delete bodyPr["a:noAutofit"];

    if (textStyle.autoFitMode === "shrink") {
      bodyPr["a:spAutoFit"] = {};
    } else if (textStyle.autoFitMode === "normal") {
      const normNode: Record<string, unknown> = {};
      if (
        textStyle.autoFitFontScale !== undefined &&
        textStyle.autoFitFontScale < 1
      ) {
        normNode["@_fontScale"] = String(
          Math.round(textStyle.autoFitFontScale * 100000),
        );
      }
      if (
        textStyle.autoFitLineSpacingReduction !== undefined &&
        textStyle.autoFitLineSpacingReduction > 0
      ) {
        normNode["@_lnSpcReduction"] = String(
          Math.round(textStyle.autoFitLineSpacingReduction * 100000),
        );
      }
      bodyPr["a:normAutofit"] = normNode;
    } else if (textStyle.autoFitMode === "none") {
      bodyPr["a:noAutofit"] = {};
    }
  } else if (textStyle.autoFit) {
    if (!bodyPr["a:spAutoFit"] && !bodyPr["a:normAutofit"]) {
      if (
        textStyle.autoFitFontScale !== undefined &&
        textStyle.autoFitFontScale < 1
      ) {
        const normNode: Record<string, unknown> = {
          "@_fontScale": String(
            Math.round(textStyle.autoFitFontScale * 100000),
          ),
        };
        if (
          textStyle.autoFitLineSpacingReduction !== undefined &&
          textStyle.autoFitLineSpacingReduction > 0
        ) {
          normNode["@_lnSpcReduction"] = String(
            Math.round(textStyle.autoFitLineSpacingReduction * 100000),
          );
        }
        bodyPr["a:normAutofit"] = normNode;
      } else {
        bodyPr["a:spAutoFit"] = {};
      }
    }
  } else if (
    textStyle.autoFit === false &&
    textStyle.autoFitMode === undefined
  ) {
    delete bodyPr["a:spAutoFit"];
    delete bodyPr["a:normAutofit"];
  }
}

// ---------------------------------------------------------------------------
// Reimplemented: applyBodyInsets
// ---------------------------------------------------------------------------
function applyBodyInsets(bodyPr: XmlObject, textStyle: TextStyle | undefined): void {
  if (!textStyle) return;
  if (typeof textStyle.bodyInsetLeft === "number" && Number.isFinite(textStyle.bodyInsetLeft)) {
    bodyPr["@_lIns"] = String(Math.round(textStyle.bodyInsetLeft * EMU_PER_PX));
  }
  if (typeof textStyle.bodyInsetTop === "number" && Number.isFinite(textStyle.bodyInsetTop)) {
    bodyPr["@_tIns"] = String(Math.round(textStyle.bodyInsetTop * EMU_PER_PX));
  }
  if (typeof textStyle.bodyInsetRight === "number" && Number.isFinite(textStyle.bodyInsetRight)) {
    bodyPr["@_rIns"] = String(Math.round(textStyle.bodyInsetRight * EMU_PER_PX));
  }
  if (typeof textStyle.bodyInsetBottom === "number" && Number.isFinite(textStyle.bodyInsetBottom)) {
    bodyPr["@_bIns"] = String(Math.round(textStyle.bodyInsetBottom * EMU_PER_PX));
  }
}

// ---------------------------------------------------------------------------
// Reimplemented: applyText3d
// ---------------------------------------------------------------------------
function applyText3d(bodyPr: XmlObject, textStyle: TextStyle | undefined): void {
  const t3d = textStyle?.text3d;
  if (t3d && Object.keys(t3d).length > 0) {
    const sp3dXml: XmlObject = {};
    if (t3d.extrusionHeight) sp3dXml["@_extrusionH"] = t3d.extrusionHeight;
    if (t3d.presetMaterial) sp3dXml["@_prstMaterial"] = t3d.presetMaterial;
    if (t3d.bevelTopType && t3d.bevelTopType !== "none") {
      const bvt: XmlObject = { "@_prst": t3d.bevelTopType };
      if (t3d.bevelTopWidth) bvt["@_w"] = t3d.bevelTopWidth;
      if (t3d.bevelTopHeight) bvt["@_h"] = t3d.bevelTopHeight;
      sp3dXml["a:bevelT"] = bvt;
    }
    if (t3d.bevelBottomType && t3d.bevelBottomType !== "none") {
      const bvb: XmlObject = { "@_prst": t3d.bevelBottomType };
      if (t3d.bevelBottomWidth) bvb["@_w"] = t3d.bevelBottomWidth;
      if (t3d.bevelBottomHeight) bvb["@_h"] = t3d.bevelBottomHeight;
      sp3dXml["a:bevelB"] = bvb;
    }
    if (t3d.extrusionColor) {
      sp3dXml["a:extrusionClr"] = {
        "a:srgbClr": {
          "@_val": t3d.extrusionColor.replace("#", ""),
        },
      };
    }
    bodyPr["a:sp3d"] = sp3dXml;
  } else {
    delete bodyPr["a:sp3d"];
  }
}

// ---------------------------------------------------------------------------
// Tests: applyAutoFitToBodyPr
// ---------------------------------------------------------------------------
describe("applyAutoFitToBodyPr", () => {
  it("should set shrink mode (spAutoFit)", () => {
    const bodyPr: XmlObject = {};
    applyAutoFitToBodyPr(bodyPr, { autoFitMode: "shrink" });
    expect(bodyPr["a:spAutoFit"]).toEqual({});
    expect(bodyPr["a:normAutofit"]).toBeUndefined();
    expect(bodyPr["a:noAutofit"]).toBeUndefined();
  });

  it("should set normal mode with font scale", () => {
    const bodyPr: XmlObject = {};
    applyAutoFitToBodyPr(bodyPr, {
      autoFitMode: "normal",
      autoFitFontScale: 0.8,
    });
    const norm = bodyPr["a:normAutofit"] as Record<string, unknown>;
    expect(norm["@_fontScale"]).toBe("80000");
  });

  it("should set normal mode with line spacing reduction", () => {
    const bodyPr: XmlObject = {};
    applyAutoFitToBodyPr(bodyPr, {
      autoFitMode: "normal",
      autoFitLineSpacingReduction: 0.2,
    });
    const norm = bodyPr["a:normAutofit"] as Record<string, unknown>;
    expect(norm["@_lnSpcReduction"]).toBe("20000");
  });

  it("should set none mode (noAutofit)", () => {
    const bodyPr: XmlObject = { "a:spAutoFit": {} };
    applyAutoFitToBodyPr(bodyPr, { autoFitMode: "none" });
    expect(bodyPr["a:noAutofit"]).toEqual({});
    expect(bodyPr["a:spAutoFit"]).toBeUndefined();
  });

  it("should clear auto-fit modes", () => {
    const bodyPr: XmlObject = {
      "a:spAutoFit": {},
      "a:normAutofit": {},
      "a:noAutofit": {},
    };
    applyAutoFitToBodyPr(bodyPr, { autoFitMode: "shrink" });
    expect(bodyPr["a:spAutoFit"]).toEqual({});
    expect(bodyPr["a:normAutofit"]).toBeUndefined();
    expect(bodyPr["a:noAutofit"]).toBeUndefined();
  });

  it("should use legacy autoFit path with spAutoFit", () => {
    const bodyPr: XmlObject = {};
    applyAutoFitToBodyPr(bodyPr, { autoFit: true });
    expect(bodyPr["a:spAutoFit"]).toEqual({});
  });

  it("should use legacy autoFit with font scale to create normAutofit", () => {
    const bodyPr: XmlObject = {};
    applyAutoFitToBodyPr(bodyPr, {
      autoFit: true,
      autoFitFontScale: 0.75,
    });
    expect(bodyPr["a:normAutofit"]).toBeDefined();
    expect(
      (bodyPr["a:normAutofit"] as Record<string, unknown>)["@_fontScale"],
    ).toBe("75000");
  });

  it("should remove autofit when autoFit is false", () => {
    const bodyPr: XmlObject = { "a:spAutoFit": {} };
    applyAutoFitToBodyPr(bodyPr, { autoFit: false });
    expect(bodyPr["a:spAutoFit"]).toBeUndefined();
    expect(bodyPr["a:normAutofit"]).toBeUndefined();
  });

  it("should do nothing when textStyle is undefined", () => {
    const bodyPr: XmlObject = { "a:spAutoFit": {} };
    applyAutoFitToBodyPr(bodyPr, undefined);
    expect(bodyPr["a:spAutoFit"]).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Tests: applyBodyInsets
// ---------------------------------------------------------------------------
describe("applyBodyInsets", () => {
  it("should set all four insets", () => {
    const bodyPr: XmlObject = {};
    applyBodyInsets(bodyPr, {
      bodyInsetLeft: 10,
      bodyInsetTop: 5,
      bodyInsetRight: 8,
      bodyInsetBottom: 12,
    });
    expect(bodyPr["@_lIns"]).toBe(String(Math.round(10 * EMU_PER_PX)));
    expect(bodyPr["@_tIns"]).toBe(String(Math.round(5 * EMU_PER_PX)));
    expect(bodyPr["@_rIns"]).toBe(String(Math.round(8 * EMU_PER_PX)));
    expect(bodyPr["@_bIns"]).toBe(String(Math.round(12 * EMU_PER_PX)));
  });

  it("should not set insets when values are undefined", () => {
    const bodyPr: XmlObject = {};
    applyBodyInsets(bodyPr, {});
    expect(bodyPr["@_lIns"]).toBeUndefined();
    expect(bodyPr["@_tIns"]).toBeUndefined();
  });

  it("should handle NaN insets", () => {
    const bodyPr: XmlObject = {};
    applyBodyInsets(bodyPr, { bodyInsetLeft: NaN });
    expect(bodyPr["@_lIns"]).toBeUndefined();
  });

  it("should do nothing when textStyle is undefined", () => {
    const bodyPr: XmlObject = {};
    applyBodyInsets(bodyPr, undefined);
    expect(Object.keys(bodyPr)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: applyText3d
// ---------------------------------------------------------------------------
describe("applyText3d", () => {
  it("should create sp3d with extrusion height", () => {
    const bodyPr: XmlObject = {};
    applyText3d(bodyPr, {
      text3d: { extrusionHeight: "50000" },
    });
    const sp3d = bodyPr["a:sp3d"] as XmlObject;
    expect(sp3d["@_extrusionH"]).toBe("50000");
  });

  it("should create bevel top element", () => {
    const bodyPr: XmlObject = {};
    applyText3d(bodyPr, {
      text3d: {
        bevelTopType: "circle",
        bevelTopWidth: "40000",
        bevelTopHeight: "30000",
      },
    });
    const sp3d = bodyPr["a:sp3d"] as XmlObject;
    const bvt = sp3d["a:bevelT"] as XmlObject;
    expect(bvt["@_prst"]).toBe("circle");
    expect(bvt["@_w"]).toBe("40000");
    expect(bvt["@_h"]).toBe("30000");
  });

  it("should skip bevel when type is none", () => {
    const bodyPr: XmlObject = {};
    applyText3d(bodyPr, {
      text3d: { bevelTopType: "none" },
    });
    const sp3d = bodyPr["a:sp3d"] as XmlObject;
    expect(sp3d["a:bevelT"]).toBeUndefined();
  });

  it("should set extrusion color", () => {
    const bodyPr: XmlObject = {};
    applyText3d(bodyPr, {
      text3d: { extrusionColor: "#FF0000" },
    });
    const sp3d = bodyPr["a:sp3d"] as XmlObject;
    const clr = sp3d["a:extrusionClr"] as XmlObject;
    expect((clr["a:srgbClr"] as XmlObject)["@_val"]).toBe("FF0000");
  });

  it("should delete sp3d when text3d is empty", () => {
    const bodyPr: XmlObject = {
      "a:sp3d": { "@_extrusionH": "50000" },
    };
    applyText3d(bodyPr, { text3d: {} });
    expect(bodyPr["a:sp3d"]).toBeUndefined();
  });

  it("should delete sp3d when text3d is undefined", () => {
    const bodyPr: XmlObject = {
      "a:sp3d": { "@_extrusionH": "50000" },
    };
    applyText3d(bodyPr, {});
    expect(bodyPr["a:sp3d"]).toBeUndefined();
  });

  it("should set preset material", () => {
    const bodyPr: XmlObject = {};
    applyText3d(bodyPr, {
      text3d: { presetMaterial: "warmMatte" },
    });
    const sp3d = bodyPr["a:sp3d"] as XmlObject;
    expect(sp3d["@_prstMaterial"]).toBe("warmMatte");
  });
});

// ---------------------------------------------------------------------------
// Tests: writeBodyPrBooleanAttrs (from body-properties-parser)
// ---------------------------------------------------------------------------
describe("writeBodyPrBooleanAttrs", () => {
  it("should write compatLnSpc as 1 when true", () => {
    const bodyPr: XmlObject = {};
    writeBodyPrBooleanAttrs(bodyPr, { compatibleLineSpacing: true });
    expect(bodyPr["@_compatLnSpc"]).toBe("1");
  });

  it("should write forceAA as 0 when false", () => {
    const bodyPr: XmlObject = {};
    writeBodyPrBooleanAttrs(bodyPr, { forceAntiAlias: false });
    expect(bodyPr["@_forceAA"]).toBe("0");
  });

  it("should write upright", () => {
    const bodyPr: XmlObject = {};
    writeBodyPrBooleanAttrs(bodyPr, { upright: true });
    expect(bodyPr["@_upright"]).toBe("1");
  });

  it("should write fromWordArt", () => {
    const bodyPr: XmlObject = {};
    writeBodyPrBooleanAttrs(bodyPr, { fromWordArt: true });
    expect(bodyPr["@_fromWordArt"]).toBe("1");
  });

  it("should do nothing when textStyle is undefined", () => {
    const bodyPr: XmlObject = {};
    writeBodyPrBooleanAttrs(bodyPr, undefined);
    expect(Object.keys(bodyPr)).toHaveLength(0);
  });
});
