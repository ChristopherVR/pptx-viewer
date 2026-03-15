import { describe, it, expect } from "vitest";
import { renderPictureBullet, resolveUnderlineDecorationStyle } from "./text-segment-helpers";
import type { BulletInfo } from "pptx-viewer-core";

describe("renderPictureBullet", () => {
  const elementId = "el-1";
  const segmentIndex = 0;
  const baseFontSize = 16;

  it("should render an <img> when imageDataUrl is provided", () => {
    const bulletInfo: BulletInfo = {
      imageDataUrl: "data:image/png;base64,iVBOR",
      imageRelId: "rId5",
    };

    const result = renderPictureBullet(
      elementId,
      segmentIndex,
      bulletInfo,
      baseFontSize,
    ) as React.ReactElement;

    expect(result).toBeTruthy();
    expect(result.type).toBe("img");
    expect(result.props.src).toBe("data:image/png;base64,iVBOR");
    expect(result.props.alt).toBe("Bullet");
    expect(result.props.style.width).toBe(baseFontSize);
    expect(result.props.style.height).toBe(baseFontSize);
    expect(result.props.style.objectFit).toBe("contain");
  });

  it("should fall back to a character bullet when imageDataUrl is missing", () => {
    const bulletInfo: BulletInfo = {
      imageRelId: "rId5",
    };

    const result = renderPictureBullet(
      elementId,
      segmentIndex,
      bulletInfo,
      baseFontSize,
    ) as React.ReactElement;

    expect(result).toBeTruthy();
    expect(result.type).toBe("span");
    // Should contain the bullet character
    expect(result.props.children).toContain("\u2022");
    expect(result.props["aria-label"]).toBe("Bullet");
    expect(result.props.style.fontSize).toBe(baseFontSize);
  });

  it("should size the image bullet using sizePts when provided", () => {
    const bulletInfo: BulletInfo = {
      imageDataUrl: "data:image/png;base64,abc",
      sizePts: 24,
    };

    const result = renderPictureBullet(
      elementId,
      segmentIndex,
      bulletInfo,
      baseFontSize,
    ) as React.ReactElement;

    expect(result.type).toBe("img");
    expect(result.props.style.width).toBe(24);
    expect(result.props.style.height).toBe(24);
  });

  it("should size the image bullet using sizePercent when provided", () => {
    const bulletInfo: BulletInfo = {
      imageDataUrl: "data:image/png;base64,abc",
      sizePercent: 150,
    };

    const result = renderPictureBullet(
      elementId,
      segmentIndex,
      bulletInfo,
      baseFontSize,
    ) as React.ReactElement;

    expect(result.type).toBe("img");
    // 16 * (150 / 100) = 24
    expect(result.props.style.width).toBe(24);
    expect(result.props.style.height).toBe(24);
  });

  it("should default sizing to baseFontSize when no sizing info is provided", () => {
    const bulletInfo: BulletInfo = {
      imageDataUrl: "data:image/png;base64,abc",
    };

    const result = renderPictureBullet(
      elementId,
      segmentIndex,
      bulletInfo,
      baseFontSize,
    ) as React.ReactElement;

    expect(result.type).toBe("img");
    expect(result.props.style.width).toBe(baseFontSize);
    expect(result.props.style.height).toBe(baseFontSize);
  });

  it("should apply bullet color to the fallback character bullet", () => {
    const bulletInfo: BulletInfo = {
      imageRelId: "rId5",
      color: "#FF0000",
    };

    const result = renderPictureBullet(
      elementId,
      segmentIndex,
      bulletInfo,
      baseFontSize,
    ) as React.ReactElement;

    expect(result.type).toBe("span");
    expect(result.props.style.color).toBe("#FF0000");
  });

  it("should apply bullet fontFamily to the fallback character bullet", () => {
    const bulletInfo: BulletInfo = {
      imageRelId: "rId5",
      fontFamily: "Arial",
    };

    const result = renderPictureBullet(
      elementId,
      segmentIndex,
      bulletInfo,
      baseFontSize,
    ) as React.ReactElement;

    expect(result.type).toBe("span");
    expect(result.props.style.fontFamily).toBe("Arial");
  });

  it("should use sizePts for fallback character bullet sizing", () => {
    const bulletInfo: BulletInfo = {
      imageRelId: "rId5",
      sizePts: 20,
    };

    const result = renderPictureBullet(
      elementId,
      segmentIndex,
      bulletInfo,
      baseFontSize,
    ) as React.ReactElement;

    expect(result.type).toBe("span");
    expect(result.props.style.fontSize).toBe(20);
  });
});

describe("resolveUnderlineDecorationStyle", () => {
  it("should return double style for double strikethrough", () => {
    const result = resolveUnderlineDecorationStyle(true);
    expect(result).toEqual({ textDecorationStyle: "double" });
  });

  it("should return undefined when no underline style is provided and no double strike", () => {
    expect(resolveUnderlineDecorationStyle(false)).toBeUndefined();
    expect(resolveUnderlineDecorationStyle(false, undefined)).toBeUndefined();
  });

  it("should return undefined for 'none' underline style", () => {
    expect(resolveUnderlineDecorationStyle(false, "none")).toBeUndefined();
  });

  it("should return undefined for unknown underline style", () => {
    expect(resolveUnderlineDecorationStyle(false, "unknownType")).toBeUndefined();
  });

  // ── Single ──
  it("sng → solid, 1px", () => {
    expect(resolveUnderlineDecorationStyle(false, "sng")).toEqual({
      textDecorationStyle: "solid",
      textDecorationThickness: "1px",
    });
  });

  // ── Double ──
  it("dbl → double, 1px", () => {
    expect(resolveUnderlineDecorationStyle(false, "dbl")).toEqual({
      textDecorationStyle: "double",
      textDecorationThickness: "1px",
    });
  });

  // ── Heavy ──
  it("heavy → solid, 3px", () => {
    expect(resolveUnderlineDecorationStyle(false, "heavy")).toEqual({
      textDecorationStyle: "solid",
      textDecorationThickness: "3px",
    });
  });

  // ── Dotted ──
  it("dotted → dotted, 1px", () => {
    expect(resolveUnderlineDecorationStyle(false, "dotted")).toEqual({
      textDecorationStyle: "dotted",
      textDecorationThickness: "1px",
    });
  });

  it("dottedHeavy → dotted, 3px", () => {
    expect(resolveUnderlineDecorationStyle(false, "dottedHeavy")).toEqual({
      textDecorationStyle: "dotted",
      textDecorationThickness: "3px",
    });
  });

  // ── Dashed ──
  it("dash → dashed, 1px", () => {
    expect(resolveUnderlineDecorationStyle(false, "dash")).toEqual({
      textDecorationStyle: "dashed",
      textDecorationThickness: "1px",
    });
  });

  it("dashHeavy → dashed, 3px", () => {
    expect(resolveUnderlineDecorationStyle(false, "dashHeavy")).toEqual({
      textDecorationStyle: "dashed",
      textDecorationThickness: "3px",
    });
  });

  // ── Long dashed ──
  it("dashLong → dashed, 1px, offset 3px", () => {
    expect(resolveUnderlineDecorationStyle(false, "dashLong")).toEqual({
      textDecorationStyle: "dashed",
      textDecorationThickness: "1px",
      textUnderlineOffset: "3px",
    });
  });

  it("dashLongHeavy → dashed, 3px, offset 3px", () => {
    expect(resolveUnderlineDecorationStyle(false, "dashLongHeavy")).toEqual({
      textDecorationStyle: "dashed",
      textDecorationThickness: "3px",
      textUnderlineOffset: "3px",
    });
  });

  // ── Dot-dash ──
  it("dotDash → dashed, 1px, offset 2px", () => {
    expect(resolveUnderlineDecorationStyle(false, "dotDash")).toEqual({
      textDecorationStyle: "dashed",
      textDecorationThickness: "1px",
      textUnderlineOffset: "2px",
    });
  });

  it("dotDashHeavy → dashed, 3px, offset 2px", () => {
    expect(resolveUnderlineDecorationStyle(false, "dotDashHeavy")).toEqual({
      textDecorationStyle: "dashed",
      textDecorationThickness: "3px",
      textUnderlineOffset: "2px",
    });
  });

  // ── Dot-dot-dash ──
  it("dotDotDash → dotted, 1px, offset 3px", () => {
    expect(resolveUnderlineDecorationStyle(false, "dotDotDash")).toEqual({
      textDecorationStyle: "dotted",
      textDecorationThickness: "1px",
      textUnderlineOffset: "3px",
    });
  });

  it("dotDotDashHeavy → dotted, 3px, offset 3px", () => {
    expect(resolveUnderlineDecorationStyle(false, "dotDotDashHeavy")).toEqual({
      textDecorationStyle: "dotted",
      textDecorationThickness: "3px",
      textUnderlineOffset: "3px",
    });
  });

  // ── Wavy ──
  it("wavy → wavy, 1px", () => {
    expect(resolveUnderlineDecorationStyle(false, "wavy")).toEqual({
      textDecorationStyle: "wavy",
      textDecorationThickness: "1px",
    });
  });

  it("wavyHeavy → wavy, 3px", () => {
    expect(resolveUnderlineDecorationStyle(false, "wavyHeavy")).toEqual({
      textDecorationStyle: "wavy",
      textDecorationThickness: "3px",
    });
  });

  // ── Wavy double (approximation) ──
  it("wavyDbl → wavy, 2px, offset 1px", () => {
    expect(resolveUnderlineDecorationStyle(false, "wavyDbl")).toEqual({
      textDecorationStyle: "wavy",
      textDecorationThickness: "2px",
      textUnderlineOffset: "1px",
    });
  });

  // ── All 16 underline types produce distinct CSS output ──
  it("all 16 underline types produce unique CSS output combinations", () => {
    const types = [
      "sng", "dbl", "heavy",
      "dotted", "dottedHeavy",
      "dash", "dashHeavy",
      "dashLong", "dashLongHeavy",
      "dotDash", "dotDashHeavy",
      "dotDotDash", "dotDotDashHeavy",
      "wavy", "wavyHeavy", "wavyDbl",
    ];

    const outputs = types.map((t) => {
      const result = resolveUnderlineDecorationStyle(false, t);
      // Every type must produce a non-undefined result
      expect(result).toBeDefined();
      return JSON.stringify(result);
    });

    // All 16 should be unique
    const unique = new Set(outputs);
    expect(unique.size).toBe(16);
  });
});

// ===========================================================================
// renderPictureBullet
// ===========================================================================

import { renderPictureBullet } from "./text-segment-helpers";
import type { BulletInfo } from "pptx-viewer-core";

describe("renderPictureBullet", () => {
  it("should render an <img> when imageDataUrl is provided", () => {
    const bulletInfo: BulletInfo = {
      imageDataUrl: "data:image/png;base64,iVBOR",
    };
    const result = renderPictureBullet("el-1", 0, bulletInfo, 14) as React.ReactElement;
    expect(result.type).toBe("img");
    expect(result.props.src).toBe("data:image/png;base64,iVBOR");
  });

  it("should size bullet by sizePts when provided", () => {
    const bulletInfo: BulletInfo = {
      imageDataUrl: "data:image/png;base64,abc",
      sizePts: 20,
    };
    const result = renderPictureBullet("el-1", 0, bulletInfo, 14) as React.ReactElement;
    expect(result.props.style.width).toBe(20);
    expect(result.props.style.height).toBe(20);
  });

  it("should use marginInlineEnd on <img> for RTL compatibility", () => {
    const bulletInfo: BulletInfo = {
      imageDataUrl: "data:image/png;base64,abc",
    };
    const result = renderPictureBullet("el-1", 0, bulletInfo, 14) as React.ReactElement;
    expect(result.props.style.marginInlineEnd).toBe(4);
  });

  it("should fall back to a character bullet when imageDataUrl is missing", () => {
    const bulletInfo: BulletInfo = {
      char: "•",
    };
    const result = renderPictureBullet("el-1", 0, bulletInfo, 14) as React.ReactElement;
    expect(result.type).toBe("span");
  });

  it("should use sizePercent for sizing when sizePts is absent", () => {
    const bulletInfo: BulletInfo = {
      imageDataUrl: "data:image/png;base64,abc",
      sizePercent: 150,
    };
    const result = renderPictureBullet("el-1", 0, bulletInfo, 10) as React.ReactElement;
    expect(result.props.style.width).toBe(15);
    expect(result.props.style.height).toBe(15);
  });

  it("should use baseFontSize as default when no size props", () => {
    const bulletInfo: BulletInfo = {
      imageDataUrl: "data:image/png;base64,abc",
    };
    const result = renderPictureBullet("el-1", 0, bulletInfo, 16) as React.ReactElement;
    expect(result.props.style.width).toBe(16);
    expect(result.props.style.height).toBe(16);
  });
});
