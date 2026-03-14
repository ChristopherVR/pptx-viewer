import { describe, it, expect } from "vitest";
import {
  computeGridSpacingPx,
  computeVisibleSlideIndexes,
  computeSlideSectionGroups,
  computeMasterPseudoSlide,
} from "./useDerivedSlideState";
import type { PptxSlide, PptxSlideMaster, PptxSlideLayout } from "pptx-viewer-core";
import { EMU_PER_PX, GRID_SIZE, UNGROUPED_SECTION_ID } from "../constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSlide(
  overrides: Partial<PptxSlide> & { id: string; rId: string },
): PptxSlide {
  return {
    slideNumber: 1,
    elements: [],
    ...overrides,
  } as PptxSlide;
}

// ---------------------------------------------------------------------------
// computeGridSpacingPx
// ---------------------------------------------------------------------------

describe("computeGridSpacingPx", () => {
  it("returns GRID_SIZE when presentationGridSpacing is undefined", () => {
    expect(computeGridSpacingPx(undefined)).toBe(GRID_SIZE);
  });

  it("converts EMU to pixels and rounds", () => {
    // 9525 * 10 = 95250 EMU => 10 px
    expect(computeGridSpacingPx({ cx: EMU_PER_PX * 10 })).toBe(10);
  });

  it("returns GRID_SIZE when conversion yields zero", () => {
    expect(computeGridSpacingPx({ cx: 0 })).toBe(GRID_SIZE);
  });

  it("returns GRID_SIZE when conversion yields negative", () => {
    expect(computeGridSpacingPx({ cx: -1000 })).toBe(GRID_SIZE);
  });

  it("rounds to nearest integer", () => {
    // 9525 * 7.5 = 71437.5 => rounds to 7 or 8
    const result = computeGridSpacingPx({ cx: 71438 });
    expect(result).toBe(Math.round(71438 / EMU_PER_PX));
    expect(result).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// computeVisibleSlideIndexes
// ---------------------------------------------------------------------------

describe("computeVisibleSlideIndexes", () => {
  it("returns all non-hidden slide indexes when no custom show is active", () => {
    const slides = [
      makeSlide({ id: "s1", rId: "r1" }),
      makeSlide({ id: "s2", rId: "r2", hidden: true }),
      makeSlide({ id: "s3", rId: "r3" }),
    ];
    const result = computeVisibleSlideIndexes(slides, null, []);
    expect(result).toEqual([0, 2]);
  });

  it("returns all indexes when no slides are hidden", () => {
    const slides = [
      makeSlide({ id: "s1", rId: "r1" }),
      makeSlide({ id: "s2", rId: "r2" }),
    ];
    const result = computeVisibleSlideIndexes(slides, null, []);
    expect(result).toEqual([0, 1]);
  });

  it("returns custom show slide order based on rId mapping", () => {
    const slides = [
      makeSlide({ id: "s1", rId: "r1" }),
      makeSlide({ id: "s2", rId: "r2" }),
      makeSlide({ id: "s3", rId: "r3" }),
    ];
    const customShows = [
      { id: "show1", name: "My Show", slideRIds: ["r3", "r1"] },
    ];
    const result = computeVisibleSlideIndexes(slides, "show1", customShows);
    expect(result).toEqual([2, 0]);
  });

  it("filters out rIds not found in slides", () => {
    const slides = [
      makeSlide({ id: "s1", rId: "r1" }),
    ];
    const customShows = [
      { id: "show1", name: "Show", slideRIds: ["r1", "r999"] },
    ];
    const result = computeVisibleSlideIndexes(slides, "show1", customShows);
    expect(result).toEqual([0]);
  });

  it("falls back to all non-hidden when custom show not found", () => {
    const slides = [
      makeSlide({ id: "s1", rId: "r1" }),
      makeSlide({ id: "s2", rId: "r2" }),
    ];
    const customShows = [
      { id: "show1", name: "Show", slideRIds: ["r1"] },
    ];
    const result = computeVisibleSlideIndexes(slides, "show-missing", customShows);
    expect(result).toEqual([0, 1]);
  });

  it("returns empty array when all slides are hidden", () => {
    const slides = [
      makeSlide({ id: "s1", rId: "r1", hidden: true }),
      makeSlide({ id: "s2", rId: "r2", hidden: true }),
    ];
    const result = computeVisibleSlideIndexes(slides, null, []);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty slides", () => {
    expect(computeVisibleSlideIndexes([], null, [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// computeSlideSectionGroups
// ---------------------------------------------------------------------------

describe("computeSlideSectionGroups", () => {
  it("returns empty array for empty slides", () => {
    expect(computeSlideSectionGroups([], [])).toEqual([]);
  });

  it("returns single default group when no sections are defined", () => {
    const slides = [
      makeSlide({ id: "s1", rId: "r1" }),
      makeSlide({ id: "s2", rId: "r2" }),
    ];
    const result = computeSlideSectionGroups(slides, []);
    expect(result).toEqual([
      { id: "default", label: "Slides", slideIndexes: [0, 1] },
    ]);
  });

  it("groups slides by sectionId when sections are defined", () => {
    const slides = [
      makeSlide({ id: "s1", rId: "r1", sectionId: "sec1" }),
      makeSlide({ id: "s2", rId: "r2", sectionId: "sec1" }),
      makeSlide({ id: "s3", rId: "r3", sectionId: "sec2" }),
    ];
    const sections = [
      { id: "sec1", name: "Introduction" },
      { id: "sec2", name: "Content" },
    ];
    const result = computeSlideSectionGroups(slides, sections);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "sec1",
      label: "Introduction",
      slideIndexes: [0, 1],
    });
    expect(result[1]).toMatchObject({
      id: "sec2",
      label: "Content",
      slideIndexes: [2],
    });
  });

  it("adds ungrouped section for slides without sectionId", () => {
    const slides = [
      makeSlide({ id: "s1", rId: "r1", sectionId: "sec1" }),
      makeSlide({ id: "s2", rId: "r2" }),
    ];
    const sections = [{ id: "sec1", name: "Section 1" }];
    const result = computeSlideSectionGroups(slides, sections);
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      id: UNGROUPED_SECTION_ID,
      label: "Ungrouped Slides",
      slideIndexes: [1],
    });
  });

  it("returns default group when sections exist but no slides match", () => {
    const slides = [
      makeSlide({ id: "s1", rId: "r1" }),
      makeSlide({ id: "s2", rId: "r2" }),
    ];
    const sections = [{ id: "sec1", name: "Empty Section" }];
    const result = computeSlideSectionGroups(slides, sections);
    // All slides are ungrouped, but sections are defined with no matches
    // The ungrouped group is added, so we should get it
    expect(result.length).toBeGreaterThan(0);
    const ungrouped = result.find((g) => g.id === UNGROUPED_SECTION_ID);
    expect(ungrouped?.slideIndexes).toEqual([0, 1]);
  });

  it("preserves section color and collapsed flags", () => {
    const slides = [
      makeSlide({ id: "s1", rId: "r1", sectionId: "sec1" }),
    ];
    const sections = [
      { id: "sec1", name: "Colored", color: "#FF0000", collapsed: true },
    ];
    const result = computeSlideSectionGroups(slides, sections);
    expect(result[0].color).toBe("#FF0000");
    expect(result[0].defaultCollapsed).toBe(true);
  });

  it("filters out sections with no slides", () => {
    const slides = [
      makeSlide({ id: "s1", rId: "r1", sectionId: "sec2" }),
    ];
    const sections = [
      { id: "sec1", name: "Empty" },
      { id: "sec2", name: "Has Slides" },
    ];
    const result = computeSlideSectionGroups(slides, sections);
    const sectionIds = result.map((g) => g.id);
    expect(sectionIds).not.toContain("sec1");
    expect(sectionIds).toContain("sec2");
  });
});

// ---------------------------------------------------------------------------
// computeMasterPseudoSlide
// ---------------------------------------------------------------------------

describe("computeMasterPseudoSlide", () => {
  it("returns undefined when mode is not master", () => {
    expect(computeMasterPseudoSlide("edit", undefined, undefined)).toBeUndefined();
    expect(computeMasterPseudoSlide("preview", undefined, undefined)).toBeUndefined();
    expect(computeMasterPseudoSlide("present", undefined, undefined)).toBeUndefined();
  });

  it("returns undefined when mode is master but no layout or master", () => {
    expect(computeMasterPseudoSlide("master", undefined, undefined)).toBeUndefined();
  });

  it("builds pseudo-slide from active layout", () => {
    const layout: PptxSlideLayout = {
      path: "ppt/slideLayouts/slideLayout1.xml",
      name: "Title Slide",
      backgroundColor: "#FFFFFF",
      elements: [{ id: "el1", type: "shape", x: 0, y: 0, width: 100, height: 50 }] as any,
    };
    const master: PptxSlideMaster = {
      path: "ppt/slideMasters/slideMaster1.xml",
      backgroundColor: "#000000",
      backgroundImage: "data:image/png;base64,master",
    } as PptxSlideMaster;

    const result = computeMasterPseudoSlide("master", layout, master);
    expect(result).toBeDefined();
    expect(result!.id).toBe(layout.path);
    expect(result!.elements).toBe(layout.elements);
    expect(result!.backgroundColor).toBe("#FFFFFF");
    // Falls back to master's backgroundImage since layout has none
    expect(result!.backgroundImage).toBe("data:image/png;base64,master");
  });

  it("uses layout background over master background when both present", () => {
    const layout: PptxSlideLayout = {
      path: "layout.xml",
      backgroundColor: "#AAAAAA",
      backgroundImage: "data:image/png;base64,layout",
    };
    const master: PptxSlideMaster = {
      path: "master.xml",
      backgroundColor: "#BBBBBB",
      backgroundImage: "data:image/png;base64,master",
    } as PptxSlideMaster;

    const result = computeMasterPseudoSlide("master", layout, master);
    expect(result!.backgroundColor).toBe("#AAAAAA");
    expect(result!.backgroundImage).toBe("data:image/png;base64,layout");
  });

  it("builds pseudo-slide from master when no layout", () => {
    const master: PptxSlideMaster = {
      path: "ppt/slideMasters/slideMaster1.xml",
      backgroundColor: "#CCCCCC",
      elements: [{ id: "el2", type: "text", x: 10, y: 10, width: 200, height: 100 }] as any,
    } as PptxSlideMaster;

    const result = computeMasterPseudoSlide("master", undefined, master);
    expect(result).toBeDefined();
    expect(result!.id).toBe(master.path);
    expect(result!.elements).toBe(master.elements);
    expect(result!.backgroundColor).toBe("#CCCCCC");
  });

  it("sets slideNumber to 0 and empty rId", () => {
    const master: PptxSlideMaster = {
      path: "master.xml",
    } as PptxSlideMaster;
    const result = computeMasterPseudoSlide("master", undefined, master);
    expect(result!.slideNumber).toBe(0);
    expect(result!.rId).toBe("");
  });
});
