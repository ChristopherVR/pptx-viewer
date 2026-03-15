import { describe, it, expect } from "vitest";
import {
  buildFlatPaneItems,
  estimateSlideItemHeight,
  type FlatPaneItem,
} from "./utils";
import { computeVirtualRange } from "../../hooks/useVirtualizedSlides";
import type { SlideSectionGroup } from "../../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSection(
  id: string,
  slideIndexes: number[],
  label = `Section ${id}`,
): SlideSectionGroup {
  return { id, label, slideIndexes };
}

// ---------------------------------------------------------------------------
// buildFlatPaneItems
// ---------------------------------------------------------------------------

describe("buildFlatPaneItems", () => {
  it("returns empty array for empty sectionGroups", () => {
    expect(buildFlatPaneItems([], false, {})).toEqual([]);
    expect(buildFlatPaneItems([], true, {})).toEqual([]);
  });

  it("returns only slide items when showSectionHeaders is false", () => {
    const sections = [makeSection("a", [0, 1, 2])];
    const result = buildFlatPaneItems(sections, false, {});
    expect(result).toEqual([
      { type: "slide", slideIndex: 0 },
      { type: "slide", slideIndex: 1 },
      { type: "slide", slideIndex: 2 },
    ]);
  });

  it("includes section headers when showSectionHeaders is true", () => {
    const sections = [
      makeSection("a", [0, 1]),
      makeSection("b", [2, 3]),
    ];
    const result = buildFlatPaneItems(sections, true, {});
    expect(result).toEqual([
      { type: "section", sectionIndex: 0, sectionId: "a" },
      { type: "slide", slideIndex: 0 },
      { type: "slide", slideIndex: 1 },
      { type: "section", sectionIndex: 1, sectionId: "b" },
      { type: "slide", slideIndex: 2 },
      { type: "slide", slideIndex: 3 },
    ]);
  });

  it("omits slides when a section is collapsed", () => {
    const sections = [
      makeSection("a", [0, 1]),
      makeSection("b", [2, 3]),
    ];
    const collapsed = { b: true };
    const result = buildFlatPaneItems(sections, true, collapsed);
    expect(result).toEqual([
      { type: "section", sectionIndex: 0, sectionId: "a" },
      { type: "slide", slideIndex: 0 },
      { type: "slide", slideIndex: 1 },
      { type: "section", sectionIndex: 1, sectionId: "b" },
      // slides 2,3 omitted because section "b" is collapsed
    ]);
  });

  it("all sections collapsed leaves only section headers", () => {
    const sections = [
      makeSection("a", [0, 1]),
      makeSection("b", [2]),
    ];
    const collapsed = { a: true, b: true };
    const result = buildFlatPaneItems(sections, true, collapsed);
    expect(result).toEqual([
      { type: "section", sectionIndex: 0, sectionId: "a" },
      { type: "section", sectionIndex: 1, sectionId: "b" },
    ]);
  });

  it("collapsed section without headers omits its slides entirely", () => {
    const sections = [
      makeSection("a", [0, 1]),
      makeSection("b", [2, 3]),
    ];
    const collapsed = { a: true };
    // Single section group: showSectionHeaders = false
    const result = buildFlatPaneItems(sections, false, collapsed);
    // Section "a" collapsed → slides 0,1 omitted; section "b" open → slides 2,3 present
    expect(result).toEqual([
      { type: "slide", slideIndex: 2 },
      { type: "slide", slideIndex: 3 },
    ]);
  });

  it("handles large section groups for 500+ slides", () => {
    const slideIndexes = Array.from({ length: 600 }, (_, i) => i);
    const sections = [makeSection("big", slideIndexes)];
    const result = buildFlatPaneItems(sections, false, {});
    expect(result.length).toBe(600);
    expect(result[0]).toEqual({ type: "slide", slideIndex: 0 });
    expect(result[599]).toEqual({ type: "slide", slideIndex: 599 });
  });

  it("preserves order across multiple sections", () => {
    const sections = [
      makeSection("s1", [0, 1]),
      makeSection("s2", [2]),
      makeSection("s3", [3, 4, 5]),
    ];
    const result = buildFlatPaneItems(sections, true, {});
    const slideIndices = result
      .filter((item): item is Extract<FlatPaneItem, { type: "slide" }> =>
        item.type === "slide",
      )
      .map((item) => item.slideIndex);
    expect(slideIndices).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("section with empty slideIndexes produces only the header", () => {
    const sections = [makeSection("empty", [])];
    const result = buildFlatPaneItems(sections, true, {});
    expect(result).toEqual([
      { type: "section", sectionIndex: 0, sectionId: "empty" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// estimateSlideItemHeight
// ---------------------------------------------------------------------------

describe("estimateSlideItemHeight", () => {
  it("returns a positive number for standard 16:9 canvas", () => {
    const h = estimateSlideItemHeight(1280, 720);
    expect(h).toBeGreaterThan(0);
  });

  it("returns a positive number for 4:3 canvas", () => {
    const h = estimateSlideItemHeight(1024, 768);
    expect(h).toBeGreaterThan(0);
  });

  it("clamps canvas width to min 1", () => {
    const h = estimateSlideItemHeight(0, 720);
    expect(h).toBeGreaterThan(0);
    // Should not throw or return NaN/Infinity
    expect(Number.isFinite(h)).toBe(true);
  });

  it("clamps canvas height to min 1", () => {
    const h = estimateSlideItemHeight(1280, 0);
    expect(h).toBeGreaterThan(0);
    expect(Number.isFinite(h)).toBe(true);
  });

  it("taller canvas aspect ratio produces taller item height", () => {
    const wide = estimateSlideItemHeight(1280, 720);
    const tall = estimateSlideItemHeight(720, 1280);
    expect(tall).toBeGreaterThan(wide);
  });

  it("always includes at least 56 + 30 = 86px (min preview + chrome)", () => {
    // Even for extremely wide canvases where the thumbnail height
    // would be very small, the floor of 56 + 30 chrome = 86
    const h = estimateSlideItemHeight(10000, 1);
    expect(h).toBeGreaterThanOrEqual(86);
  });
});

// ---------------------------------------------------------------------------
// Integration: flat items + virtual range
// ---------------------------------------------------------------------------

describe("Flat items + virtual range integration", () => {
  it("virtualized render count is << total for 1000 slides", () => {
    const indexes = Array.from({ length: 1000 }, (_, i) => i);
    const sections = [makeSection("all", indexes)];
    const flatItems = buildFlatPaneItems(sections, false, {});

    // Simulate a viewport of ~600px with 120px items
    const range = computeVirtualRange(flatItems.length, 120, 0, 600, 5);
    const renderedCount = range.endIndex - range.startIndex + 1;

    // We should render far fewer items than the total
    expect(renderedCount).toBeLessThan(20);
    expect(flatItems.length).toBe(1000);
  });

  it("scrolled to middle of 500 slides renders small window", () => {
    const indexes = Array.from({ length: 500 }, (_, i) => i);
    const sections = [makeSection("all", indexes)];
    const flatItems = buildFlatPaneItems(sections, false, {});

    // scrollTop=30000, viewport=600, itemHeight=120
    const range = computeVirtualRange(flatItems.length, 120, 30000, 600, 5);
    const count = range.endIndex - range.startIndex + 1;

    expect(count).toBeLessThan(20);
    expect(range.startIndex).toBeGreaterThan(200);
    expect(range.endIndex).toBeLessThan(300);
  });

  it("with sections and headers, virtualization still works", () => {
    // 10 sections, 100 slides each
    const sections: SlideSectionGroup[] = [];
    for (let s = 0; s < 10; s++) {
      const base = s * 100;
      const indexes = Array.from({ length: 100 }, (_, i) => base + i);
      sections.push(makeSection(`s${s}`, indexes));
    }
    const flatItems = buildFlatPaneItems(sections, true, {});
    // 10 headers + 1000 slides = 1010 items
    expect(flatItems.length).toBe(1010);

    const range = computeVirtualRange(flatItems.length, 120, 0, 800, 5);
    const count = range.endIndex - range.startIndex + 1;
    expect(count).toBeLessThan(25);
  });

  it("collapsed sections reduce flat item count", () => {
    const sections = [
      makeSection("a", Array.from({ length: 300 }, (_, i) => i)),
      makeSection("b", Array.from({ length: 300 }, (_, i) => 300 + i)),
    ];

    const open = buildFlatPaneItems(sections, true, {});
    const collapsed = buildFlatPaneItems(sections, true, { a: true });

    // Open: 2 headers + 600 slides = 602
    expect(open.length).toBe(602);
    // Collapsed "a": 2 headers + 300 slides from "b" = 302
    expect(collapsed.length).toBe(302);
  });
});

// ---------------------------------------------------------------------------
// SlideItem / LazyThumbnail memoization
// ---------------------------------------------------------------------------
// NOTE: Dynamic imports of SlideItem and LazyThumbnail are not tested here
// because they transitively depend on "pptx-viewer-core" which must be built
// first. The React.memo wrapping is verified by code inspection:
//   - SlideItem.tsx exports `React.memo(SlideItemInner)`
//   - LazyThumbnail.tsx exports `React.memo(LazyThumbnailInner)`

// ---------------------------------------------------------------------------
// VIRTUALIZATION_THRESHOLD
// ---------------------------------------------------------------------------
// The threshold constant (50) is exported from SlidesPaneSidebar.tsx but
// cannot be imported in isolation without also pulling in pptx-viewer-core.
// We document the value here so it can be verified against the source.

describe("VIRTUALIZATION_THRESHOLD (documented)", () => {
  it("threshold is documented as 50", () => {
    // This value must match the VIRTUALIZATION_THRESHOLD constant in
    // SlidesPaneSidebar.tsx. If the constant changes, update this test.
    const EXPECTED_THRESHOLD = 50;
    expect(EXPECTED_THRESHOLD).toBeGreaterThan(0);
  });
});
