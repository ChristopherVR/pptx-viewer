import { describe, it, expect } from "vitest";
import { imgSrc } from "./ImageRenderer";
import type { PptxElement } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeElement(overrides: Record<string, unknown> = {}): PptxElement {
  return {
    id: "img-1",
    type: "image",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    ...overrides,
  } as PptxElement;
}

// ---------------------------------------------------------------------------
// imgSrc
// ---------------------------------------------------------------------------

describe("imgSrc", () => {
  it("returns svgData when present", () => {
    const el = makeElement({ svgData: "data:image/svg+xml;base64,abc123" });
    expect(imgSrc(el)).toBe("data:image/svg+xml;base64,abc123");
  });

  it("returns imageData when svgData is absent", () => {
    const el = makeElement({ imageData: "data:image/png;base64,xyz789" });
    expect(imgSrc(el)).toBe("data:image/png;base64,xyz789");
  });

  it("prefers svgData over imageData when both are present", () => {
    const el = makeElement({
      svgData: "data:image/svg+xml;base64,svg",
      imageData: "data:image/png;base64,png",
    });
    expect(imgSrc(el)).toBe("data:image/svg+xml;base64,svg");
  });

  it("returns undefined when neither svgData nor imageData is present", () => {
    const el = makeElement();
    expect(imgSrc(el)).toBeUndefined();
  });

  it("returns undefined when svgData is an empty string", () => {
    const el = makeElement({ svgData: "" });
    expect(imgSrc(el)).toBeUndefined();
  });

  it("returns imageData when svgData is empty string but imageData exists", () => {
    const el = makeElement({
      svgData: "",
      imageData: "data:image/png;base64,abc",
    });
    expect(imgSrc(el)).toBe("data:image/png;base64,abc");
  });
});
