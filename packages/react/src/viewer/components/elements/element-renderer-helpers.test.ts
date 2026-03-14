import { describe, it, expect } from "vitest";
import { getContainerStyle } from "./element-renderer-helpers";
import type { PptxElement } from "pptx-viewer-core";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeElement(overrides: Partial<PptxElement> = {}): PptxElement {
  return {
    id: "el-1",
    type: "shape",
    x: 100,
    y: 200,
    width: 300,
    height: 150,
    ...overrides,
  } as PptxElement;
}

const BASE_PARAMS = {
  el: makeElement(),
  isFullscreenMedia: false,
  isImg: false,
  zIndex: 5,
  opacity: 1,
  animationState: undefined,
  shapeVisualStyle: {} as CSSProperties,
};

// ---------------------------------------------------------------------------
// getContainerStyle
// ---------------------------------------------------------------------------

describe("getContainerStyle", () => {
  it("sets left and top from element position", () => {
    const style = getContainerStyle(BASE_PARAMS);
    expect(style.left).toBe(100);
    expect(style.top).toBe(200);
  });

  it("sets width and height from element dimensions", () => {
    const style = getContainerStyle(BASE_PARAMS);
    expect(style.width).toBe(300);
    expect(style.height).toBe(150);
  });

  it("enforces minimum element size for small elements", () => {
    const style = getContainerStyle({
      ...BASE_PARAMS,
      el: makeElement({ width: 1, height: 2 }),
    });
    // MIN_ELEMENT_SIZE is 12
    expect(style.width).toBe(12);
    expect(style.height).toBe(12);
  });

  it("sets zIndex from parameter", () => {
    const style = getContainerStyle(BASE_PARAMS);
    expect(style.zIndex).toBe(5);
  });

  it("sets opacity from parameter", () => {
    const style = getContainerStyle({ ...BASE_PARAMS, opacity: 0.5 });
    expect(style.opacity).toBe(0.5);
  });

  it("sets visibility to visible when no animation state", () => {
    const style = getContainerStyle(BASE_PARAMS);
    expect(style.visibility).toBe("visible");
  });

  it("sets visibility to hidden when animationState.visible is false", () => {
    const style = getContainerStyle({
      ...BASE_PARAMS,
      animationState: { visible: false } as any,
    });
    expect(style.visibility).toBe("hidden");
  });

  it("sets cssAnimation from animation state", () => {
    const style = getContainerStyle({
      ...BASE_PARAMS,
      animationState: { visible: true, cssAnimation: "fadeIn 1s" } as any,
    });
    expect(style.animation).toBe("fadeIn 1s");
  });

  it("sets overflow to hidden for images", () => {
    const style = getContainerStyle({ ...BASE_PARAMS, isImg: true });
    expect(style.overflow).toBe("hidden");
  });

  it("does not set overflow for non-images", () => {
    const style = getContainerStyle({ ...BASE_PARAMS, isImg: false });
    expect(style.overflow).toBeUndefined();
  });

  it("sets transformOrigin to center", () => {
    const style = getContainerStyle(BASE_PARAMS);
    expect(style.transformOrigin).toBe("center");
  });

  // Fullscreen media mode
  it("uses 0 for left/top when fullscreen", () => {
    const style = getContainerStyle({
      ...BASE_PARAMS,
      isFullscreenMedia: true,
    });
    expect(style.left).toBe(0);
    expect(style.top).toBe(0);
  });

  it("uses 100% for width/height when fullscreen", () => {
    const style = getContainerStyle({
      ...BASE_PARAMS,
      isFullscreenMedia: true,
    });
    expect(style.width).toBe("100%");
    expect(style.height).toBe("100%");
  });

  it("sets transform to none when fullscreen", () => {
    const style = getContainerStyle({
      ...BASE_PARAMS,
      isFullscreenMedia: true,
    });
    expect(style.transform).toBe("none");
  });

  it("sets zIndex to 20 when fullscreen", () => {
    const style = getContainerStyle({
      ...BASE_PARAMS,
      isFullscreenMedia: true,
    });
    expect(style.zIndex).toBe(20);
  });

  it("sets background to #000 when fullscreen", () => {
    const style = getContainerStyle({
      ...BASE_PARAMS,
      isFullscreenMedia: true,
    });
    expect(style.background).toBe("#000");
  });

  it("sets transition when fullscreen", () => {
    const style = getContainerStyle({
      ...BASE_PARAMS,
      isFullscreenMedia: true,
    });
    expect(style.transition).toContain("ease");
  });

  it("sets borderColor to transparent when fullscreen", () => {
    const style = getContainerStyle({
      ...BASE_PARAMS,
      isFullscreenMedia: true,
    });
    expect(style.borderColor).toBe("transparent");
  });

  it("does not set background when not fullscreen", () => {
    const style = getContainerStyle(BASE_PARAMS);
    expect(style.background).toBeUndefined();
  });

  it("spreads shapeVisualStyle into the result", () => {
    const style = getContainerStyle({
      ...BASE_PARAMS,
      shapeVisualStyle: { backgroundColor: "red", borderRadius: "4px" },
    });
    expect(style.backgroundColor).toBe("red");
    expect(style.borderRadius).toBe("4px");
  });
});
