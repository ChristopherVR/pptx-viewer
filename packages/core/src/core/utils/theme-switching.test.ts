import { describe, it, expect } from "vitest";
import {
  reResolveSlideColors,
  applyThemeToData,
  buildThemeColorMap,
} from "./theme-switching";
import type {
  PptxSlide,
  PptxElement,
  PptxThemeColorScheme,
  PptxData,
  TextSegment,
} from "../types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const OFFICE_COLORS: PptxThemeColorScheme = {
  dk1: "#000000",
  lt1: "#FFFFFF",
  dk2: "#44546A",
  lt2: "#E7E6E6",
  accent1: "#4472C4",
  accent2: "#ED7D31",
  accent3: "#A5A5A5",
  accent4: "#FFC000",
  accent5: "#5B9BD5",
  accent6: "#70AD47",
  hlink: "#0563C1",
  folHlink: "#954F72",
};

const ION_COLORS: PptxThemeColorScheme = {
  dk1: "#000000",
  lt1: "#FFFFFF",
  dk2: "#1B1D2C",
  lt2: "#D4D4D8",
  accent1: "#B01513",
  accent2: "#EA6312",
  accent3: "#E6B729",
  accent4: "#6AAC90",
  accent5: "#54849A",
  accent6: "#9E5E9B",
  hlink: "#58C1BA",
  folHlink: "#F4B183",
};

function makeOldColorMap(): Record<string, string> {
  return buildThemeColorMap(OFFICE_COLORS);
}

function makeTextElement(overrides: Partial<PptxElement> = {}): PptxElement {
  return {
    type: "text",
    id: "txt_1",
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    text: "Hello",
    textStyle: { color: "#4472C4", fontSize: 24 },
    ...overrides,
  } as PptxElement;
}

function makeShapeElement(overrides: Partial<PptxElement> = {}): PptxElement {
  return {
    type: "shape",
    id: "shp_1",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    shapeStyle: { fillColor: "#4472C4", strokeColor: "#ED7D31" },
    ...overrides,
  } as PptxElement;
}

function makeSlide(elements: PptxElement[]): PptxSlide {
  return {
    elements,
    slideNumber: 1,
  } as PptxSlide;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildThemeColorMap", () => {
  it("builds map with all 12 scheme keys plus aliases", () => {
    const map = buildThemeColorMap(OFFICE_COLORS);
    expect(map.dk1).toBe("000000");
    expect(map.accent1).toBe("4472C4");
    expect(map.tx1).toBe("000000"); // alias for dk1
    expect(map.bg1).toBe("FFFFFF"); // alias for lt1
    expect(map.tx2).toBe("44546A"); // alias for dk2
    expect(map.bg2).toBe("E7E6E6"); // alias for lt2
  });
});

describe("reResolveSlideColors", () => {
  it("remaps text colour from old accent1 to new accent1", () => {
    const slides = [makeSlide([makeTextElement()])];
    const result = reResolveSlideColors(slides, makeOldColorMap(), ION_COLORS);

    const el = result[0].elements![0] as { textStyle?: { color?: string } };
    expect(el.textStyle?.color).toBe("#B01513");
  });

  it("remaps shape fill and stroke colours", () => {
    const slides = [makeSlide([makeShapeElement()])];
    const result = reResolveSlideColors(slides, makeOldColorMap(), ION_COLORS);

    const el = result[0].elements![0] as {
      shapeStyle?: { fillColor?: string; strokeColor?: string };
    };
    expect(el.shapeStyle?.fillColor).toBe("#B01513"); // accent1
    expect(el.shapeStyle?.strokeColor).toBe("#EA6312"); // accent2
  });

  it("does not modify colours that are not from the theme", () => {
    const el = makeTextElement({
      textStyle: { color: "#FF0000", fontSize: 16 },
    } as Partial<PptxElement>);
    const slides = [makeSlide([el])];
    const result = reResolveSlideColors(slides, makeOldColorMap(), ION_COLORS);

    const resultEl = result[0].elements![0] as {
      textStyle?: { color?: string };
    };
    expect(resultEl.textStyle?.color).toBe("#FF0000");
  });

  it("returns original array when no colours changed", () => {
    const slides = [makeSlide([makeTextElement()])];
    const result = reResolveSlideColors(
      slides,
      makeOldColorMap(),
      OFFICE_COLORS,
    );
    expect(result).toBe(slides); // Same reference — no changes needed
  });

  it("remaps text segment colours", () => {
    const segments: TextSegment[] = [
      { text: "Hello", style: { color: "#4472C4" } },
      { text: " World", style: { color: "#FF0000" } },
    ];
    const el = makeTextElement({ textSegments: segments } as Partial<PptxElement>);
    const slides = [makeSlide([el])];
    const result = reResolveSlideColors(slides, makeOldColorMap(), ION_COLORS);

    const resultEl = result[0].elements![0] as {
      textSegments?: TextSegment[];
    };
    expect(resultEl.textSegments?.[0]?.style?.color).toBe("#B01513");
    expect(resultEl.textSegments?.[1]?.style?.color).toBe("#FF0000"); // unchanged
  });

  it("remaps slide background colour", () => {
    const slide = makeSlide([]);
    slide.backgroundColor = "#E7E6E6"; // lt2
    const result = reResolveSlideColors([slide], makeOldColorMap(), ION_COLORS);
    expect(result[0].backgroundColor).toBe("#D4D4D8"); // ION lt2
  });

  it("remaps group child element colours recursively", () => {
    const child = makeShapeElement();
    const group: PptxElement = {
      type: "group",
      id: "grp_1",
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      children: [child],
    } as PptxElement;
    const slides = [makeSlide([group])];
    const result = reResolveSlideColors(slides, makeOldColorMap(), ION_COLORS);

    const grp = result[0].elements![0] as { children?: PptxElement[] };
    const resultChild = grp.children?.[0] as {
      shapeStyle?: { fillColor?: string };
    };
    expect(resultChild.shapeStyle?.fillColor).toBe("#B01513");
  });

  it("remaps gradient stop colours", () => {
    const el = makeShapeElement({
      shapeStyle: {
        fillMode: "gradient",
        fillGradientType: "linear",
        fillGradientAngle: 90,
        fillGradientStops: [
          { color: "#4472C4", position: 0 },
          { color: "#ED7D31", position: 1 },
        ],
        fillGradient: "linear-gradient(90deg, #4472C4 0%, #ED7D31 100%)",
      },
    } as Partial<PptxElement>);
    const slides = [makeSlide([el])];
    const result = reResolveSlideColors(slides, makeOldColorMap(), ION_COLORS);

    const resultEl = result[0].elements![0] as {
      shapeStyle?: {
        fillGradientStops?: Array<{ color: string; position: number }>;
      };
    };
    expect(resultEl.shapeStyle?.fillGradientStops?.[0]?.color).toBe(
      "#B01513",
    );
    expect(resultEl.shapeStyle?.fillGradientStops?.[1]?.color).toBe(
      "#EA6312",
    );
  });

  it("remaps shadow and glow colours", () => {
    const el = makeShapeElement({
      shapeStyle: {
        fillColor: "#FFFFFF",
        shadowColor: "#44546A", // dk2
        glowColor: "#0563C1", // hlink
      },
    } as Partial<PptxElement>);
    const slides = [makeSlide([el])];
    const result = reResolveSlideColors(slides, makeOldColorMap(), ION_COLORS);

    const resultEl = result[0].elements![0] as {
      shapeStyle?: { shadowColor?: string; glowColor?: string };
    };
    expect(resultEl.shapeStyle?.shadowColor).toBe("#1B1D2C"); // ION dk2
    expect(resultEl.shapeStyle?.glowColor).toBe("#58C1BA"); // ION hlink
  });
});

describe("applyThemeToData", () => {
  it("updates slides, themeColorMap, and theme object", () => {
    const data: PptxData = {
      slides: [makeSlide([makeTextElement()])],
      themeColorMap: makeOldColorMap(),
      theme: { colorScheme: OFFICE_COLORS },
    } as PptxData;

    const result = applyThemeToData(data, ION_COLORS, undefined, "Ion");

    // Slides are re-resolved
    const el = result.slides[0].elements![0] as {
      textStyle?: { color?: string };
    };
    expect(el.textStyle?.color).toBe("#B01513");

    // themeColorMap is updated
    expect(result.themeColorMap?.accent1).toBe("B01513");

    // Theme object is updated
    expect(result.theme?.colorScheme?.accent1).toBe("#B01513");
    expect(result.theme?.name).toBe("Ion");
  });

  it("preserves font scheme when provided", () => {
    const data: PptxData = {
      slides: [],
      themeColorMap: makeOldColorMap(),
      theme: { colorScheme: OFFICE_COLORS },
    } as PptxData;

    const fontScheme = {
      majorFont: { latin: "Century Gothic" },
      minorFont: { latin: "Century Gothic" },
    };
    const result = applyThemeToData(data, ION_COLORS, fontScheme, "Ion");
    expect(result.theme?.fontScheme?.majorFont?.latin).toBe("Century Gothic");
  });
});
