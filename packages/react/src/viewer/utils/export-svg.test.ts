/**
 * Tests for SVG vector export utilities in export-svg.ts.
 *
 * The core SVG rendering logic lives in `SvgExporter` (pptx-viewer-core)
 * and is extensively tested there. These tests focus on the React-package
 * wrapper behaviour: font embedding, blob creation, multi-slide export
 * with progress tracking, and option pass-through.
 */
import { describe, it, expect, vi } from "vitest";

import {
  exportSlideToSvg,
  exportSlideToSvgBlob,
  exportAllSlidesToSvg,
  exportAllSlidesToSvgBlobs,
} from "./export-svg";
import type {
  SvgExportSingleSlideOptions,
  SvgExportAllOptions,
  FontFaceEntry,
} from "./export-svg";
import type { PptxSlide, PptxData } from "pptx-viewer-core";

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function makeSlide(overrides: Partial<PptxSlide> = {}): PptxSlide {
  return {
    id: "slide1",
    rId: "rId2",
    slideNumber: 1,
    elements: [],
    ...overrides,
  };
}

function makeData(
  slides: PptxSlide[],
  width = 960,
  height = 540,
): PptxData {
  return { slides, width, height };
}

function assertValidSvgStructure(svg: string): void {
  expect(svg).toMatch(/^<svg /);
  expect(svg).toMatch(/<\/svg>$/);
  expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(svg).toContain("viewBox=");
}

// ────────────────────────────────────────────────────────────────────
// exportSlideToSvg
// ────────────────────────────────────────────────────────────────────

describe("exportSlideToSvg", () => {
  it("produces valid SVG for an empty slide", () => {
    const svg = exportSlideToSvg(makeSlide(), 960, 540);
    assertValidSvgStructure(svg);
    expect(svg).toContain('viewBox="0 0 960 540"');
  });

  it("renders text elements", () => {
    const slide = makeSlide({
      elements: [
        {
          type: "text",
          id: "t1",
          x: 10,
          y: 20,
          width: 200,
          height: 40,
          text: "Hello",
          textStyle: { fontSize: 18 },
        } as any,
      ],
    });
    const svg = exportSlideToSvg(slide, 960, 540);
    assertValidSvgStructure(svg);
    expect(svg).toContain("Hello");
    expect(svg).toContain("<text");
  });

  it("renders shape elements", () => {
    const slide = makeSlide({
      elements: [
        {
          type: "shape",
          id: "s1",
          x: 50,
          y: 50,
          width: 100,
          height: 80,
          shapeType: "rect",
          shapeStyle: { fillColor: "#FF0000" },
        } as any,
      ],
    });
    const svg = exportSlideToSvg(slide, 960, 540);
    assertValidSvgStructure(svg);
    expect(svg).toContain("<rect");
    expect(svg).toContain('fill="#FF0000"');
  });

  it("renders image elements with embedded data", () => {
    const slide = makeSlide({
      elements: [
        {
          type: "image",
          id: "i1",
          x: 0,
          y: 0,
          width: 200,
          height: 150,
          imageData: "data:image/png;base64,iVBOR",
        } as any,
      ],
    });
    const svg = exportSlideToSvg(slide, 960, 540);
    assertValidSvgStructure(svg);
    expect(svg).toContain("<image");
    expect(svg).toContain("data:image/png;base64,iVBOR");
  });

  it("passes through defaultFontFamily option", () => {
    const slide = makeSlide({
      elements: [
        {
          type: "text",
          id: "t1",
          x: 0,
          y: 0,
          width: 200,
          height: 40,
          text: "Styled",
        } as any,
      ],
    });
    const svg = exportSlideToSvg(slide, 960, 540, {
      defaultFontFamily: "Helvetica",
    });
    expect(svg).toContain('font-family="Helvetica"');
  });

  it("includes custom background colour", () => {
    const slide = makeSlide({ backgroundColor: "#112233" });
    const svg = exportSlideToSvg(slide, 960, 540);
    expect(svg).toContain('fill="#112233"');
  });
});

// ────────────────────────────────────────────────────────────────────
// Font embedding
// ────────────────────────────────────────────────────────────────────

describe("exportSlideToSvg font embedding", () => {
  const fontFaces: FontFaceEntry[] = [
    {
      family: "Calibri",
      css: "@font-face { font-family: 'Calibri'; src: url(data:font/woff2;base64,abc) format('woff2'); }",
    },
    {
      family: "Arial",
      css: "@font-face { font-family: 'Arial'; src: url(data:font/woff2;base64,def) format('woff2'); }",
    },
  ];

  it("does not embed fonts when embedFonts is false", () => {
    const svg = exportSlideToSvg(makeSlide(), 960, 540, {
      embedFonts: false,
      fontFaces,
    });
    expect(svg).not.toContain("@font-face");
    expect(svg).not.toContain("<style");
  });

  it("does not embed fonts when embedFonts is true but fontFaces is empty", () => {
    const svg = exportSlideToSvg(makeSlide(), 960, 540, {
      embedFonts: true,
      fontFaces: [],
    });
    expect(svg).not.toContain("@font-face");
  });

  it("does not embed fonts when embedFonts is true but fontFaces is omitted", () => {
    const svg = exportSlideToSvg(makeSlide(), 960, 540, {
      embedFonts: true,
    });
    expect(svg).not.toContain("@font-face");
  });

  it("embeds font-face declarations when embedFonts is true", () => {
    const svg = exportSlideToSvg(makeSlide(), 960, 540, {
      embedFonts: true,
      fontFaces,
    });

    assertValidSvgStructure(svg);
    expect(svg).toContain("<style");
    expect(svg).toContain("@font-face");
    expect(svg).toContain("Calibri");
    expect(svg).toContain("Arial");
  });

  it("inserts font-face inside existing <defs> block", () => {
    // A connector with an arrow marker creates a <defs> block
    const slide = makeSlide({
      elements: [
        {
          type: "connector",
          id: "c1",
          x: 0,
          y: 0,
          width: 100,
          height: 0,
          shapeStyle: {
            strokeColor: "#000",
            connectorEndArrow: "triangle",
          },
        } as any,
      ],
    });

    const svg = exportSlideToSvg(slide, 960, 540, {
      embedFonts: true,
      fontFaces,
    });

    assertValidSvgStructure(svg);
    // The <defs> should contain both the marker and the style
    expect(svg).toContain("<defs>");
    expect(svg).toContain("<style");
    expect(svg).toContain("<marker");
    // There should only be one <defs> block
    const defsCount = (svg.match(/<defs>/g) || []).length;
    expect(defsCount).toBe(1);
  });

  it("creates a <defs> block when SVG has none", () => {
    const svg = exportSlideToSvg(makeSlide(), 960, 540, {
      embedFonts: true,
      fontFaces: [fontFaces[0]],
    });

    expect(svg).toContain("<defs>");
    expect(svg).toContain("</defs>");
    expect(svg).toContain("<style");
  });
});

// ────────────────────────────────────────────────────────────────────
// exportSlideToSvgBlob
// ────────────────────────────────────────────────────────────────────

describe("exportSlideToSvgBlob", () => {
  it("returns a Blob with image/svg+xml type", () => {
    const blob = exportSlideToSvgBlob(makeSlide(), 960, 540);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/svg+xml;charset=utf-8");
  });

  it("blob content matches the SVG string", async () => {
    const slide = makeSlide({ backgroundColor: "#AABBCC" });
    const blob = exportSlideToSvgBlob(slide, 960, 540);
    const expected = exportSlideToSvg(slide, 960, 540);
    const blobText = await blob.text();
    expect(blobText).toBe(expected);
  });

  it("blob size is non-zero", () => {
    const blob = exportSlideToSvgBlob(makeSlide(), 960, 540);
    expect(blob.size).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// exportAllSlidesToSvg
// ────────────────────────────────────────────────────────────────────

describe("exportAllSlidesToSvg", () => {
  it("exports all slides", () => {
    const data = makeData([
      makeSlide({ id: "s1", slideNumber: 1 }),
      makeSlide({ id: "s2", slideNumber: 2 }),
      makeSlide({ id: "s3", slideNumber: 3 }),
    ]);
    const svgs = exportAllSlidesToSvg(data);
    expect(svgs).toHaveLength(3);
    for (const svg of svgs) {
      assertValidSvgStructure(svg);
    }
  });

  it("skips hidden slides by default", () => {
    const data = makeData([
      makeSlide({ id: "s1", slideNumber: 1 }),
      makeSlide({ id: "s2", slideNumber: 2, hidden: true }),
    ]);
    const svgs = exportAllSlidesToSvg(data);
    expect(svgs).toHaveLength(1);
  });

  it("includes hidden slides when includeHidden is true", () => {
    const data = makeData([
      makeSlide({ id: "s1", slideNumber: 1 }),
      makeSlide({ id: "s2", slideNumber: 2, hidden: true }),
    ]);
    const svgs = exportAllSlidesToSvg(data, { includeHidden: true });
    expect(svgs).toHaveLength(2);
  });

  it("respects slideIndices option", () => {
    const data = makeData([
      makeSlide({ id: "s1", slideNumber: 1 }),
      makeSlide({ id: "s2", slideNumber: 2 }),
      makeSlide({ id: "s3", slideNumber: 3 }),
    ]);
    const svgs = exportAllSlidesToSvg(data, { slideIndices: [0, 2] });
    expect(svgs).toHaveLength(2);
  });

  it("calls onProgress callback during export", () => {
    const data = makeData([
      makeSlide({ id: "s1", slideNumber: 1 }),
      makeSlide({ id: "s2", slideNumber: 2 }),
    ]);
    const progress: [number, number][] = [];
    exportAllSlidesToSvg(data, {
      onProgress: (current, total) => {
        progress.push([current, total]);
      },
    });

    // Called once before each slide + once at the end
    expect(progress).toHaveLength(3);
    expect(progress[0]).toEqual([0, 2]);
    expect(progress[1]).toEqual([1, 2]);
    expect(progress[2]).toEqual([2, 2]);
  });

  it("embeds fonts in all slides when embedFonts is true", () => {
    const data = makeData([
      makeSlide({ id: "s1", slideNumber: 1 }),
      makeSlide({ id: "s2", slideNumber: 2 }),
    ]);
    const fontFaces: FontFaceEntry[] = [
      {
        family: "TestFont",
        css: "@font-face { font-family: 'TestFont'; src: url(data:font/woff2;base64,xyz); }",
      },
    ];

    const svgs = exportAllSlidesToSvg(data, {
      embedFonts: true,
      fontFaces,
    });

    expect(svgs).toHaveLength(2);
    for (const svg of svgs) {
      expect(svg).toContain("@font-face");
      expect(svg).toContain("TestFont");
    }
  });

  it("returns empty array for presentation with only hidden slides", () => {
    const data = makeData([
      makeSlide({ id: "s1", slideNumber: 1, hidden: true }),
      makeSlide({ id: "s2", slideNumber: 2, hidden: true }),
    ]);
    const svgs = exportAllSlidesToSvg(data);
    expect(svgs).toHaveLength(0);
  });

  it("returns empty array for empty presentation", () => {
    const data = makeData([]);
    const svgs = exportAllSlidesToSvg(data);
    expect(svgs).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// exportAllSlidesToSvgBlobs
// ────────────────────────────────────────────────────────────────────

describe("exportAllSlidesToSvgBlobs", () => {
  it("returns Blob array matching slide count", () => {
    const data = makeData([
      makeSlide({ id: "s1", slideNumber: 1 }),
      makeSlide({ id: "s2", slideNumber: 2 }),
    ]);
    const blobs = exportAllSlidesToSvgBlobs(data);
    expect(blobs).toHaveLength(2);
    for (const blob of blobs) {
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe("image/svg+xml;charset=utf-8");
    }
  });

  it("blob contents match SVG strings", async () => {
    const data = makeData([
      makeSlide({ id: "s1", slideNumber: 1, backgroundColor: "#AA0000" }),
    ]);
    const blobs = exportAllSlidesToSvgBlobs(data);
    const svgs = exportAllSlidesToSvg(data);

    expect(blobs).toHaveLength(1);
    const blobText = await blobs[0].text();
    expect(blobText).toBe(svgs[0]);
  });
});

// ────────────────────────────────────────────────────────────────────
// Type shape tests
// ────────────────────────────────────────────────────────────────────

describe("export-svg types", () => {
  it("SvgExportSingleSlideOptions accepts all expected properties", () => {
    const opts: SvgExportSingleSlideOptions = {
      embedFonts: true,
      fontFaces: [{ family: "Arial", css: "@font-face {}" }],
      defaultFontFamily: "Helvetica",
      defaultFontSize: 14,
      includeHidden: false,
      slideIndices: [0],
    };
    expect(opts.embedFonts).toBe(true);
    expect(opts.fontFaces).toHaveLength(1);
  });

  it("SvgExportAllOptions extends single-slide options with onProgress", () => {
    const opts: SvgExportAllOptions = {
      embedFonts: false,
      onProgress: (_c, _t) => {},
    };
    expect(typeof opts.onProgress).toBe("function");
  });

  it("FontFaceEntry requires family and css", () => {
    const entry: FontFaceEntry = {
      family: "Calibri",
      css: "@font-face { font-family: 'Calibri'; }",
    };
    expect(entry.family).toBe("Calibri");
    expect(entry.css).toContain("@font-face");
  });

  it("all options can be omitted", () => {
    // Should compile and run with empty options
    const svg = exportSlideToSvg(makeSlide(), 960, 540, {});
    assertValidSvgStructure(svg);
  });
});
