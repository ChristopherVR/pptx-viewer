import { describe, it, expect } from "vitest";
import {
  getArtisticFilterId,
  needsSvgArtisticFilter,
  buildArtisticEffectDescriptor,
} from "./artistic-effects";

// ---------------------------------------------------------------------------
// getArtisticFilterId
// ---------------------------------------------------------------------------

describe("getArtisticFilterId", () => {
  it("generates a stable filter ID from element ID", () => {
    expect(getArtisticFilterId("img-1")).toBe("artistic-fx-img-1");
  });

  it("handles empty element ID", () => {
    expect(getArtisticFilterId("")).toBe("artistic-fx-");
  });

  it("produces different IDs for different elements", () => {
    expect(getArtisticFilterId("a")).not.toBe(getArtisticFilterId("b"));
  });
});

// ---------------------------------------------------------------------------
// needsSvgArtisticFilter
// ---------------------------------------------------------------------------

describe("needsSvgArtisticFilter", () => {
  it("returns false for undefined", () => {
    expect(needsSvgArtisticFilter(undefined)).toBe(false);
  });

  it("returns false for CSS-only effects", () => {
    expect(needsSvgArtisticFilter("blur")).toBe(false);
    expect(needsSvgArtisticFilter("artisticBlur")).toBe(false);
    expect(needsSvgArtisticFilter("lineDrawing")).toBe(false);
    expect(needsSvgArtisticFilter("paintStrokes")).toBe(false);
    expect(needsSvgArtisticFilter("photocopy")).toBe(false);
    expect(needsSvgArtisticFilter("pastelsSmooth")).toBe(false);
    expect(needsSvgArtisticFilter("marker")).toBe(false);
    expect(needsSvgArtisticFilter("plasticWrap")).toBe(false);
    expect(needsSvgArtisticFilter("lightScreen")).toBe(false);
    expect(needsSvgArtisticFilter("glowDiffused")).toBe(false);
    expect(needsSvgArtisticFilter("sharpen")).toBe(false);
  });

  it("returns true for film grain", () => {
    expect(needsSvgArtisticFilter("filmGrain")).toBe(true);
    expect(needsSvgArtisticFilter("artisticFilmGrain")).toBe(true);
  });

  it("returns true for cutout", () => {
    expect(needsSvgArtisticFilter("cutout")).toBe(true);
    expect(needsSvgArtisticFilter("artisticCutout")).toBe(true);
  });

  it("returns true for cement", () => {
    expect(needsSvgArtisticFilter("cement")).toBe(true);
    expect(needsSvgArtisticFilter("artisticCement")).toBe(true);
  });

  it("returns true for texturizer", () => {
    expect(needsSvgArtisticFilter("texturizer")).toBe(true);
    expect(needsSvgArtisticFilter("artisticTexturizer")).toBe(true);
  });

  it("returns true for crisscross etching", () => {
    expect(needsSvgArtisticFilter("crisscrossEtching")).toBe(true);
    expect(needsSvgArtisticFilter("artisticCrisscrossEtching")).toBe(true);
  });

  it("returns true for mosaic effects", () => {
    expect(needsSvgArtisticFilter("mosaic")).toBe(true);
    expect(needsSvgArtisticFilter("artisticMosaic")).toBe(true);
    expect(needsSvgArtisticFilter("artisticMosaicBubbles")).toBe(true);
    expect(needsSvgArtisticFilter("mosaicBubbles")).toBe(true);
  });

  it("returns true for glow edges", () => {
    expect(needsSvgArtisticFilter("glowEdges")).toBe(true);
    expect(needsSvgArtisticFilter("artisticGlowEdges")).toBe(true);
    expect(needsSvgArtisticFilter("glow_edges")).toBe(true);
  });

  it("returns true for chalk/sketch effects", () => {
    expect(needsSvgArtisticFilter("chalkSketch")).toBe(true);
    expect(needsSvgArtisticFilter("artisticChalkSketch")).toBe(true);
    expect(needsSvgArtisticFilter("chalk")).toBe(true);
  });

  it("returns true for pencil sketch effects", () => {
    expect(needsSvgArtisticFilter("pencilSketch")).toBe(true);
    expect(needsSvgArtisticFilter("artisticPencilSketch")).toBe(true);
    expect(needsSvgArtisticFilter("pencilGrayscale")).toBe(true);
    expect(needsSvgArtisticFilter("artisticPencilGrayscale")).toBe(true);
    expect(needsSvgArtisticFilter("grayPencil")).toBe(true);
  });

  it("returns false for unknown effects", () => {
    expect(needsSvgArtisticFilter("someUnknownEffect")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildArtisticEffectDescriptor
// ---------------------------------------------------------------------------

describe("buildArtisticEffectDescriptor", () => {
  it("returns undefined for CSS-only effects", () => {
    expect(buildArtisticEffectDescriptor("el1", "blur", 5)).toBeUndefined();
    expect(buildArtisticEffectDescriptor("el1", "artisticBlur", 5)).toBeUndefined();
  });

  it("returns descriptor for film grain", () => {
    const desc = buildArtisticEffectDescriptor("el1", "artisticFilmGrain", 10);
    expect(desc).toBeDefined();
    expect(desc!.filterId).toBe("artistic-fx-el1");
    expect(desc!.cssFilter).toBe("url(#artistic-fx-el1)");
    expect(desc!.needsSvgFilter).toBe(true);
  });

  it("returns descriptor for cutout", () => {
    const desc = buildArtisticEffectDescriptor("el2", "cutout", 50);
    expect(desc).toBeDefined();
    expect(desc!.filterId).toBe("artistic-fx-el2");
    expect(desc!.cssFilter).toContain("url(#artistic-fx-el2)");
    expect(desc!.needsSvgFilter).toBe(true);
  });

  it("returns descriptor for mosaic", () => {
    const desc = buildArtisticEffectDescriptor("el3", "mosaic", 8);
    expect(desc).toBeDefined();
    expect(desc!.needsSvgFilter).toBe(true);
  });

  it("returns descriptor for glow edges", () => {
    const desc = buildArtisticEffectDescriptor("el4", "artisticGlowEdges", 15);
    expect(desc).toBeDefined();
    expect(desc!.needsSvgFilter).toBe(true);
  });

  it("returns descriptor for chalk sketch", () => {
    const desc = buildArtisticEffectDescriptor("el5", "chalk", 20);
    expect(desc).toBeDefined();
    expect(desc!.needsSvgFilter).toBe(true);
  });

  it("returns descriptor for pencil sketch", () => {
    const desc = buildArtisticEffectDescriptor("el6", "pencilSketch", 30);
    expect(desc).toBeDefined();
    expect(desc!.needsSvgFilter).toBe(true);
  });

  it("returns descriptor for pencil grayscale", () => {
    const desc = buildArtisticEffectDescriptor("el7", "pencilGrayscale", 10);
    expect(desc).toBeDefined();
    expect(desc!.needsSvgFilter).toBe(true);
  });

  it("returns descriptor for cement", () => {
    const desc = buildArtisticEffectDescriptor("el8", "cement", 10);
    expect(desc).toBeDefined();
    expect(desc!.needsSvgFilter).toBe(true);
  });

  it("returns descriptor for texturizer", () => {
    const desc = buildArtisticEffectDescriptor("el9", "texturizer", 10);
    expect(desc).toBeDefined();
    expect(desc!.needsSvgFilter).toBe(true);
  });

  it("returns descriptor for crisscross etching", () => {
    const desc = buildArtisticEffectDescriptor("el10", "crisscrossEtching", 10);
    expect(desc).toBeDefined();
    expect(desc!.needsSvgFilter).toBe(true);
  });
});
