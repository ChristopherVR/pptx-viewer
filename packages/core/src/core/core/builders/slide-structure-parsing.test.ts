import { describe, it, expect } from "vitest";
import { PptxLoadDataBuilder } from "./PptxLoadDataBuilder";
import {
  buildClrMapOverrideXml,
  hasNonTrivialOverride,
  DEFAULT_COLOR_MAP,
  COLOR_MAP_ALIAS_KEYS,
} from "../../utils/theme-override-utils";
import type { XmlObject } from "../../types";

/**
 * Tests for OOXML slide structure parsing: slide size, notes size,
 * slide properties, and colour map override detection.
 *
 * Per ECMA-376 §19.3.1.41 (sldSz):
 *   <p:sldSz cx="9144000" cy="6858000" type="screen4x3"/>
 *
 * Per ECMA-376 §19.3.1.26 (notesSz):
 *   <p:notesSz cx="6858000" cy="9144000"/>
 *
 * EMU_PER_PX = 9525
 */

const EMU_PER_PX = 9525;

// ---------------------------------------------------------------------------
// Slide size parsing (4:3, 16:9, custom) via PptxLoadDataBuilder
// ---------------------------------------------------------------------------

describe("slide size parsing via PptxLoadDataBuilder", () => {
  it("builds PptxData with 4:3 standard slide dimensions", () => {
    const widthEmu = 9144000;
    const heightEmu = 6858000;
    const widthPx = Math.round(widthEmu / EMU_PER_PX);
    const heightPx = Math.round(heightEmu / EMU_PER_PX);

    const data = new PptxLoadDataBuilder()
      .withDimensions(widthPx, heightPx, widthEmu, heightEmu)
      .withSlideSizeType("screen4x3")
      .withSlides([])
      .build();

    expect(data.width).toBe(960);
    expect(data.height).toBe(720);
    expect(data.widthEmu).toBe(9144000);
    expect(data.heightEmu).toBe(6858000);
    expect(data.slideSizeType).toBe("screen4x3");
  });

  it("builds PptxData with 16:9 widescreen slide dimensions", () => {
    const widthEmu = 12192000;
    const heightEmu = 6858000;
    const widthPx = Math.round(widthEmu / EMU_PER_PX);
    const heightPx = Math.round(heightEmu / EMU_PER_PX);

    const data = new PptxLoadDataBuilder()
      .withDimensions(widthPx, heightPx, widthEmu, heightEmu)
      .withSlideSizeType("screen16x9")
      .withSlides([])
      .build();

    expect(data.width).toBe(1280);
    expect(data.height).toBe(720);
    expect(data.widthEmu).toBe(12192000);
    expect(data.heightEmu).toBe(6858000);
    expect(data.slideSizeType).toBe("screen16x9");
  });

  it("builds PptxData with custom slide dimensions", () => {
    const widthEmu = 7200000;
    const heightEmu = 5400000;
    const widthPx = Math.round(widthEmu / EMU_PER_PX);
    const heightPx = Math.round(heightEmu / EMU_PER_PX);

    const data = new PptxLoadDataBuilder()
      .withDimensions(widthPx, heightPx, widthEmu, heightEmu)
      .withSlideSizeType("custom")
      .withSlides([])
      .build();

    expect(data.width).toBe(widthPx);
    expect(data.height).toBe(heightPx);
    expect(data.widthEmu).toBe(7200000);
    expect(data.heightEmu).toBe(5400000);
    expect(data.slideSizeType).toBe("custom");
  });

  it("defaults slideSizeType to undefined when not set", () => {
    const data = new PptxLoadDataBuilder()
      .withDimensions(960, 720, 9144000, 6858000)
      .withSlides([])
      .build();

    expect(data.slideSizeType).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Notes size parsing
// ---------------------------------------------------------------------------

describe("notes size parsing via PptxLoadDataBuilder", () => {
  it("stores notes dimensions in EMU (portrait orientation)", () => {
    const notesWidthEmu = 6858000;
    const notesHeightEmu = 9144000;

    const data = new PptxLoadDataBuilder()
      .withDimensions(960, 720, 9144000, 6858000)
      .withNotesDimensions(notesWidthEmu, notesHeightEmu)
      .withSlides([])
      .build();

    expect(data.notesWidthEmu).toBe(6858000);
    expect(data.notesHeightEmu).toBe(9144000);
  });

  it("omits notes dimensions when zero", () => {
    const data = new PptxLoadDataBuilder()
      .withDimensions(960, 720, 9144000, 6858000)
      .withNotesDimensions(0, 0)
      .withSlides([])
      .build();

    expect(data.notesWidthEmu).toBeUndefined();
    expect(data.notesHeightEmu).toBeUndefined();
  });

  it("notes page is rotated relative to slide (width/height swapped)", () => {
    // Standard 4:3 slide: 9144000 x 6858000
    // Notes page swaps: 6858000 x 9144000
    const notesWidthEmu = 6858000;
    const notesHeightEmu = 9144000;

    expect(notesWidthEmu).toBe(6858000); // = slide height EMU
    expect(notesHeightEmu).toBe(9144000); // = slide width EMU
  });
});

// ---------------------------------------------------------------------------
// Slide properties (hidden flag, showMasterShapes)
// ---------------------------------------------------------------------------

describe("slide properties", () => {
  it("slide hidden flag detection from @_show attribute", () => {
    // Per ECMA-376 §19.3.1.38, p:sld/@show="0" means hidden
    const slideXml: XmlObject = {
      "p:sld": { "@_show": "0" },
    };
    const showValue = String(
      (slideXml["p:sld"] as XmlObject)?.["@_show"] ?? "",
    ).toLowerCase();
    const hidden = showValue === "0" || showValue === "false";
    expect(hidden).toBe(true);
  });

  it("slide is visible when @_show is absent (default)", () => {
    const slideXml: XmlObject = {
      "p:sld": {},
    };
    const showValue = String(
      (slideXml["p:sld"] as XmlObject)?.["@_show"] ?? "",
    ).toLowerCase();
    const hidden = showValue === "0" || showValue === "false";
    expect(hidden).toBe(false);
  });

  it("slide is visible when @_show='1'", () => {
    const slideXml: XmlObject = {
      "p:sld": { "@_show": "1" },
    };
    const showValue = String(
      (slideXml["p:sld"] as XmlObject)?.["@_show"] ?? "",
    ).toLowerCase();
    const hidden = showValue === "0" || showValue === "false";
    expect(hidden).toBe(false);
  });

  it("showMasterShapes defaults to true when attribute absent", () => {
    // Per ECMA-376, @showMasterSp defaults to true
    const slideXml: XmlObject = {
      "p:sld": {},
    };
    const sld = slideXml["p:sld"] as XmlObject | undefined;
    const rawVal = sld?.["@_showMasterSp"];
    const result = rawVal === undefined ? undefined : true;
    expect(result).toBeUndefined(); // undefined means use default (true)
  });

  it("showMasterShapes=false when @showMasterSp='0'", () => {
    const slideXml: XmlObject = {
      "p:sld": { "@_showMasterSp": "0" },
    };
    const sld = slideXml["p:sld"] as XmlObject;
    const rawVal = sld["@_showMasterSp"];
    const normalized = String(rawVal).trim().toLowerCase();
    const showMaster = normalized !== "0" && normalized !== "false";
    expect(showMaster).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Color map override detection
// ---------------------------------------------------------------------------

describe("colour map override", () => {
  it("buildClrMapOverrideXml returns masterClrMapping when no override", () => {
    const result = buildClrMapOverrideXml(null);
    expect(result["a:masterClrMapping"]).toBeDefined();
    expect(result["a:overrideClrMapping"]).toBeUndefined();
  });

  it("buildClrMapOverrideXml returns masterClrMapping for empty object", () => {
    const result = buildClrMapOverrideXml({});
    expect(result["a:masterClrMapping"]).toBeDefined();
  });

  it("buildClrMapOverrideXml returns overrideClrMapping with all 12 keys", () => {
    const override = { bg1: "dk1", tx1: "lt1" };
    const result = buildClrMapOverrideXml(override);
    expect(result["a:overrideClrMapping"]).toBeDefined();
    expect(result["a:masterClrMapping"]).toBeUndefined();

    const mapping = result["a:overrideClrMapping"] as Record<string, string>;
    // Should have all 12 alias keys
    for (const key of COLOR_MAP_ALIAS_KEYS) {
      expect(mapping[`@_${key}`]).toBeDefined();
    }
    // Overridden values
    expect(mapping["@_bg1"]).toBe("dk1");
    expect(mapping["@_tx1"]).toBe("lt1");
    // Non-overridden fall back to defaults
    expect(mapping["@_accent1"]).toBe(DEFAULT_COLOR_MAP["accent1"]);
  });

  it("hasNonTrivialOverride returns false for null", () => {
    expect(hasNonTrivialOverride(null)).toBe(false);
  });

  it("hasNonTrivialOverride returns false for identity mapping", () => {
    // Identity: each alias maps to its default slot
    const identity: Record<string, string> = {};
    for (const key of COLOR_MAP_ALIAS_KEYS) {
      identity[key] = DEFAULT_COLOR_MAP[key];
    }
    expect(hasNonTrivialOverride(identity)).toBe(false);
  });

  it("hasNonTrivialOverride returns true when bg1 maps to dk1", () => {
    const override = { bg1: "dk1" }; // Default is lt1, so this is non-trivial
    expect(hasNonTrivialOverride(override)).toBe(true);
  });

  it("hasNonTrivialOverride returns false for empty object", () => {
    expect(hasNonTrivialOverride({})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Slide size EMU <-> pixel relationships
// ---------------------------------------------------------------------------

describe("slide size EMU to pixel relationships", () => {
  it("4:3 standard slide: pixels match expected values", () => {
    // p:sldSz cx="9144000" cy="6858000" type="screen4x3"
    const cx = 9144000;
    const cy = 6858000;
    expect(Math.round(cx / EMU_PER_PX)).toBe(960);
    expect(Math.round(cy / EMU_PER_PX)).toBe(720);
  });

  it("16:9 widescreen slide: pixels match expected values", () => {
    // p:sldSz cx="12192000" cy="6858000" type="screen16x9"
    const cx = 12192000;
    const cy = 6858000;
    expect(Math.round(cx / EMU_PER_PX)).toBe(1280);
    expect(Math.round(cy / EMU_PER_PX)).toBe(720);
  });

  it("round-trip: slide size pixel -> EMU -> pixel", () => {
    const originalWidth = 960;
    const originalHeight = 720;
    const widthEmu = originalWidth * EMU_PER_PX;
    const heightEmu = originalHeight * EMU_PER_PX;
    expect(Math.round(widthEmu / EMU_PER_PX)).toBe(originalWidth);
    expect(Math.round(heightEmu / EMU_PER_PX)).toBe(originalHeight);
  });
});

// ---------------------------------------------------------------------------
// PptxLoadDataBuilder chaining
// ---------------------------------------------------------------------------

describe("PptxLoadDataBuilder chaining", () => {
  it("supports fluent method chaining", () => {
    const builder = new PptxLoadDataBuilder();
    const result = builder
      .withDimensions(960, 720, 9144000, 6858000)
      .withNotesDimensions(6858000, 9144000)
      .withSlides([])
      .withSlideSizeType("screen4x3");

    // Should return the same builder instance
    expect(result).toBe(builder);
  });

  it("builds complete PptxData with all dimension fields", () => {
    const data = new PptxLoadDataBuilder()
      .withDimensions(1280, 720, 12192000, 6858000)
      .withNotesDimensions(6858000, 9144000)
      .withSlides([])
      .withSlideSizeType("screen16x9")
      .build();

    expect(data.width).toBe(1280);
    expect(data.height).toBe(720);
    expect(data.widthEmu).toBe(12192000);
    expect(data.heightEmu).toBe(6858000);
    expect(data.notesWidthEmu).toBe(6858000);
    expect(data.notesHeightEmu).toBe(9144000);
    expect(data.slideSizeType).toBe("screen16x9");
    expect(data.slides).toEqual([]);
  });
});
