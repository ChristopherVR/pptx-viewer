import { describe, it, expect } from "vitest";
import {
  getImageEffectsFilter,
  getImageEffectsOpacity,
} from "./shape-visual-effects";
import type { PptxElement } from "pptx-viewer-core";

// Helper to create a minimal image element with effects
function makeImageElement(
  imageEffects?: Record<string, unknown>,
): PptxElement {
  return {
    id: "test-img-1",
    type: "image",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    imageEffects: imageEffects as PptxElement["imageEffects"],
  } as PptxElement;
}

function makeShapeElement(): PptxElement {
  return {
    id: "test-shape-1",
    type: "shape",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  } as PptxElement;
}

// ---------------------------------------------------------------------------
// getImageEffectsFilter
// ---------------------------------------------------------------------------

describe("getImageEffectsFilter", () => {
  it("returns undefined for non-image elements", () => {
    expect(getImageEffectsFilter(makeShapeElement())).toBeUndefined();
  });

  it("returns undefined for image element without effects", () => {
    const el = makeImageElement(undefined);
    expect(getImageEffectsFilter(el)).toBeUndefined();
  });

  it("returns undefined for empty effects object", () => {
    const el = makeImageElement({});
    expect(getImageEffectsFilter(el)).toBeUndefined();
  });

  it("applies brightness adjustment", () => {
    const el = makeImageElement({ brightness: 50 });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("brightness(");
    // 1 + 50/100 = 1.5
    expect(result).toContain("brightness(1.5)");
  });

  it("applies contrast adjustment", () => {
    const el = makeImageElement({ contrast: -30 });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("contrast(");
    // 1 + (-30)/100 = 0.7
    expect(result).toContain("contrast(0.7)");
  });

  it("applies saturation adjustment", () => {
    const el = makeImageElement({ saturation: 80 });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("saturate(");
    // 1 + 80/100 = 1.8
    expect(result).toContain("saturate(1.8)");
  });

  it("applies grayscale effect", () => {
    const el = makeImageElement({ grayscale: true });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("grayscale(100%)");
  });

  it("does not apply grayscale when false", () => {
    const el = makeImageElement({ grayscale: false });
    expect(getImageEffectsFilter(el)).toBeUndefined();
  });

  it("ignores brightness of 0", () => {
    const el = makeImageElement({ brightness: 0 });
    expect(getImageEffectsFilter(el)).toBeUndefined();
  });

  it("ignores contrast of 0", () => {
    const el = makeImageElement({ contrast: 0 });
    expect(getImageEffectsFilter(el)).toBeUndefined();
  });

  it("ignores saturation of 0", () => {
    const el = makeImageElement({ saturation: 0 });
    expect(getImageEffectsFilter(el)).toBeUndefined();
  });

  it("combines multiple filter effects", () => {
    const el = makeImageElement({
      brightness: 20,
      contrast: 10,
      saturation: -50,
    });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("brightness(");
    expect(result).toContain("contrast(");
    expect(result).toContain("saturate(");
  });

  it("clamps brightness to non-negative CSS multiplier", () => {
    const el = makeImageElement({ brightness: -200 });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    // 1 + (-200)/100 = -1 → clamped to 0
    expect(result).toContain("brightness(0)");
  });

  // -- CSS-only artistic effects --

  it("applies blur artistic effect", () => {
    const el = makeImageElement({
      artisticEffect: "blur",
      artisticRadius: 10,
    });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("blur(10px)");
  });

  it("clamps blur radius to max 20px", () => {
    const el = makeImageElement({
      artisticEffect: "blur",
      artisticRadius: 50,
    });
    const result = getImageEffectsFilter(el);
    expect(result).toContain("blur(20px)");
  });

  it("uses default radius of 5 when not specified", () => {
    const el = makeImageElement({ artisticEffect: "blur" });
    const result = getImageEffectsFilter(el);
    expect(result).toContain("blur(5px)");
  });

  it("applies paintStrokes artistic effect with CSS filters", () => {
    const el = makeImageElement({
      artisticEffect: "paintStrokes",
      artisticRadius: 6,
    });
    const result = getImageEffectsFilter(el);
    expect(result).toContain("blur(6px)");
    expect(result).toContain("saturate(140%)");
  });

  it("applies photocopy artistic effect with CSS filters", () => {
    const el = makeImageElement({ artisticEffect: "photocopy" });
    const result = getImageEffectsFilter(el);
    expect(result).toContain("grayscale(100%)");
    expect(result).toContain("contrast(200%)");
    expect(result).toContain("brightness(120%)");
  });

  // -- SVG-filter artistic effects (reference SVG filter via url(#id)) --

  it("pencilGrayscale now references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "pencilGrayscale" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  it("cutout now references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "cutout" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  it("filmGrain now references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "filmGrain" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  it("cement now references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "cement" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  it("texturizer now references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "texturizer" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  it("crisscrossEtching now references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "crisscrossEtching" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  it("chalkSketch now references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "chalkSketch" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  it("pencilSketch now references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "pencilSketch" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  it("mosaic now references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "mosaic", artisticRadius: 7 });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  it("chalk now references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "chalk" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  it("mosaicBubbles now references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "mosaicBubbles" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  // -- Bi-level effect --

  it("applies bi-level threshold effect", () => {
    const el = makeImageElement({ biLevel: 50 });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("grayscale(100%)");
    expect(result).toContain("contrast(1000%)");
    expect(result).toContain("brightness(50%)");
  });

  it("clamps bi-level to 0-100 range", () => {
    const el = makeImageElement({ biLevel: 150 });
    const result = getImageEffectsFilter(el);
    expect(result).toContain("brightness(100%)");
  });

  // -- OOXML-prefixed aliases --

  it("artisticBlur works as blur alias", () => {
    const el = makeImageElement({ artisticEffect: "artisticBlur", artisticRadius: 8 });
    expect(getImageEffectsFilter(el)).toContain("blur(8px)");
  });

  it("artisticLineDrawing works as lineDrawing alias", () => {
    const el = makeImageElement({ artisticEffect: "artisticLineDrawing" });
    const result = getImageEffectsFilter(el);
    expect(result).toContain("grayscale(100%)");
    expect(result).toContain("contrast(150%)");
  });

  it("artisticPhotocopy works as photocopy alias", () => {
    const el = makeImageElement({ artisticEffect: "artisticPhotocopy" });
    const result = getImageEffectsFilter(el);
    expect(result).toContain("grayscale(100%)");
    expect(result).toContain("contrast(200%)");
  });

  it("artisticPaint works as paint alias", () => {
    const el = makeImageElement({ artisticEffect: "artisticPaint" });
    const result = getImageEffectsFilter(el);
    expect(result).toContain("blur(");
    expect(result).toContain("saturate(160%)");
  });

  it("artisticPlasticWrap works as plasticWrap alias", () => {
    const el = makeImageElement({ artisticEffect: "artisticPlasticWrap" });
    const result = getImageEffectsFilter(el);
    expect(result).toContain("contrast(150%)");
    expect(result).toContain("brightness(115%)");
  });

  it("artisticGlowEdges references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "artisticGlowEdges" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  it("artisticGlowDiffused applies CSS blur + brightness", () => {
    const el = makeImageElement({ artisticEffect: "artisticGlowDiffused" });
    const result = getImageEffectsFilter(el);
    expect(result).toContain("blur(");
    expect(result).toContain("brightness(");
  });

  it("artisticLightScreen applies CSS brightness + saturate", () => {
    const el = makeImageElement({ artisticEffect: "artisticLightScreen" });
    const result = getImageEffectsFilter(el);
    expect(result).toContain("brightness(");
    expect(result).toContain("saturate(");
  });

  it("artisticSharpenEdges works as sharpen alias", () => {
    const el = makeImageElement({ artisticEffect: "artisticSharpenEdges" });
    const result = getImageEffectsFilter(el);
    expect(result).toContain("contrast(160%)");
  });

  it("grayPencil references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "grayPencil" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  // -- OOXML-prefixed SVG effects --

  it("artisticFilmGrain references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "artisticFilmGrain" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  it("artisticCutout references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "artisticCutout" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  it("artisticCement references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "artisticCement" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  it("artisticTexturizer references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "artisticTexturizer" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  it("artisticCrisscrossEtching references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "artisticCrisscrossEtching" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  it("artisticMosaic references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "artisticMosaic" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  it("artisticChalkSketch references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "artisticChalkSketch" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  it("artisticPencilGrayscale references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "artisticPencilGrayscale" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  it("artisticPencilSketch references SVG filter", () => {
    const el = makeImageElement({ artisticEffect: "artisticPencilSketch" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#artistic-fx-test-img-1)");
  });

  // -- Pastels (CSS-only) --

  it("pastels alias maps to pastelsSmooth CSS filters", () => {
    const el = makeImageElement({ artisticEffect: "pastels" });
    const result = getImageEffectsFilter(el);
    expect(result).toContain("blur(");
    expect(result).toContain("saturate(");
  });

  // -- Catch-all default --

  it("unknown effect name produces a generic filter (not no-op)", () => {
    const el = makeImageElement({ artisticEffect: "someUnknownEffect" });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("contrast(105%)");
    expect(result).toContain("saturate(105%)");
  });

  // -- Duotone --

  it("includes duotone filter reference by default", () => {
    const el = makeImageElement({
      duotone: { color1: "#000000", color2: "#FFFFFF" },
    });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("url(#duotone-test-img-1)");
  });

  it("excludes duotone when excludeDuotone option is set", () => {
    const el = makeImageElement({
      duotone: { color1: "#000000", color2: "#FFFFFF" },
    });
    const result = getImageEffectsFilter(el, { excludeDuotone: true });
    expect(result).toBeUndefined();
  });

  // -- "picture" type also works --

  it("works with type=picture elements", () => {
    const el = {
      id: "pic-1",
      type: "picture" as const,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      imageEffects: { grayscale: true },
    } as PptxElement;
    const result = getImageEffectsFilter(el);
    expect(result).toContain("grayscale(100%)");
  });

  // -- Gaussian blur --

  it("artisticGaussianBlur applies wider blur radius", () => {
    const el = makeImageElement({ artisticEffect: "artisticGaussianBlur", artisticRadius: 10 });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("blur(12px)"); // 10 * 1.2 = 12
  });

  // -- Paint brush --

  it("artisticPaintBrush applies blur + saturate", () => {
    const el = makeImageElement({ artisticEffect: "artisticPaintBrush", artisticRadius: 4 });
    const result = getImageEffectsFilter(el);
    expect(result).toBeDefined();
    expect(result).toContain("blur(4px)");
    expect(result).toContain("saturate(130%)");
  });
});

// ---------------------------------------------------------------------------
// getImageEffectsOpacity
// ---------------------------------------------------------------------------

describe("getImageEffectsOpacity", () => {
  it("returns undefined for non-image elements", () => {
    expect(getImageEffectsOpacity(makeShapeElement())).toBeUndefined();
  });

  it("returns undefined for image without effects", () => {
    expect(
      getImageEffectsOpacity(makeImageElement(undefined)),
    ).toBeUndefined();
  });

  it("returns undefined when no alphaModFix is set", () => {
    expect(
      getImageEffectsOpacity(makeImageElement({ brightness: 20 })),
    ).toBeUndefined();
  });

  it("returns normalised 0-1 opacity from alphaModFix", () => {
    const el = makeImageElement({ alphaModFix: 50 });
    expect(getImageEffectsOpacity(el)).toBe(0.5);
  });

  it("clamps opacity to max 1", () => {
    const el = makeImageElement({ alphaModFix: 150 });
    expect(getImageEffectsOpacity(el)).toBe(1);
  });

  it("clamps opacity to min 0", () => {
    const el = makeImageElement({ alphaModFix: -50 });
    expect(getImageEffectsOpacity(el)).toBe(0);
  });

  it("returns 0 for alphaModFix of 0", () => {
    const el = makeImageElement({ alphaModFix: 0 });
    expect(getImageEffectsOpacity(el)).toBe(0);
  });

  it("returns 1 for alphaModFix of 100", () => {
    const el = makeImageElement({ alphaModFix: 100 });
    expect(getImageEffectsOpacity(el)).toBe(1);
  });
});
