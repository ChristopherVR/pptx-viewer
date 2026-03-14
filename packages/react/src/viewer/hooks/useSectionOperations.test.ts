import { describe, it, expect, vi } from "vitest";
import type { PptxSection, PptxSlide } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Pure logic extracted from useSectionOperations for testing.
// These mirror the updater functions passed to setSections/setSlides.
// ---------------------------------------------------------------------------

function makeSlide(
  overrides: Partial<PptxSlide> & { id: string },
): PptxSlide {
  return {
    rId: "",
    slideNumber: 1,
    elements: [],
    ...overrides,
  } as PptxSlide;
}

function makeSection(
  overrides: Partial<PptxSection> & { id: string; name: string },
): PptxSection {
  return {
    slideIds: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rename section updaters
// ---------------------------------------------------------------------------

function renameSectionUpdater(
  sections: PptxSection[],
  sectionId: string,
  newName: string,
): PptxSection[] {
  return sections.map((sec) =>
    sec.id === sectionId ? { ...sec, name: newName } : sec,
  );
}

function renameSectionSlidesUpdater(
  slides: PptxSlide[],
  sectionId: string,
  newName: string,
): PptxSlide[] {
  return slides.map((s) =>
    s.sectionId === sectionId ? { ...s, sectionName: newName } : s,
  );
}

// ---------------------------------------------------------------------------
// Delete section updater
// ---------------------------------------------------------------------------

function deleteSectionUpdater(
  sections: PptxSection[],
  sectionId: string,
): PptxSection[] {
  const idx = sections.findIndex((sec) => sec.id === sectionId);
  if (idx === -1) return sections;

  const deletedSection = sections[idx];
  const prevSection = idx > 0 ? sections[idx - 1] : undefined;

  const updated = sections.filter((sec) => sec.id !== sectionId);
  if (prevSection && deletedSection) {
    return updated.map((sec) =>
      sec.id === prevSection.id
        ? {
            ...sec,
            slideIds: [...sec.slideIds, ...deletedSection.slideIds],
          }
        : sec,
    );
  }

  return updated;
}

function deleteSectionSlidesUpdater(
  slides: PptxSlide[],
  sectionId: string,
  sections: PptxSection[],
): PptxSlide[] {
  const sectionIdx = sections.findIndex((sec) => sec.id === sectionId);
  const prevSection = sectionIdx > 0 ? sections[sectionIdx - 1] : undefined;

  return slides.map((s) => {
    if (s.sectionId !== sectionId) return s;
    if (prevSection) {
      return {
        ...s,
        sectionId: prevSection.id,
        sectionName: prevSection.name,
      };
    }
    return { ...s, sectionId: undefined, sectionName: undefined };
  });
}

// ---------------------------------------------------------------------------
// Move section updaters
// ---------------------------------------------------------------------------

function moveSectionUpUpdater(
  sections: PptxSection[],
  sectionId: string,
): PptxSection[] {
  const idx = sections.findIndex((sec) => sec.id === sectionId);
  if (idx <= 0) return sections;
  const next = [...sections];
  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
  return next;
}

function moveSectionDownUpdater(
  sections: PptxSection[],
  sectionId: string,
): PptxSection[] {
  const idx = sections.findIndex((sec) => sec.id === sectionId);
  if (idx === -1 || idx >= sections.length - 1) return sections;
  const next = [...sections];
  [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
  return next;
}

// ---------------------------------------------------------------------------
// Move slides to section updaters
// ---------------------------------------------------------------------------

function moveSlidesToSectionSlidesUpdater(
  slides: PptxSlide[],
  slideIndexes: number[],
  targetSectionId: string,
  targetSectionName: string,
): PptxSlide[] {
  return slides.map((s, i) =>
    slideIndexes.includes(i)
      ? {
          ...s,
          sectionId: targetSectionId,
          sectionName: targetSectionName,
        }
      : s,
  );
}

function moveSlidesToSectionSectionsUpdater(
  sections: PptxSection[],
  movedSlideIds: string[],
  targetSectionId: string,
): PptxSection[] {
  return sections.map((sec) => {
    if (sec.id === targetSectionId) {
      return {
        ...sec,
        slideIds: [
          ...sec.slideIds,
          ...movedSlideIds.filter((sid) => !sec.slideIds.includes(sid)),
        ],
      };
    }
    return {
      ...sec,
      slideIds: sec.slideIds.filter((sid) => !movedSlideIds.includes(sid)),
    };
  });
}

// ---------------------------------------------------------------------------
// Tests: Rename Section
// ---------------------------------------------------------------------------

describe("renameSectionUpdater", () => {
  const sections = [
    makeSection({ id: "sec1", name: "Introduction" }),
    makeSection({ id: "sec2", name: "Body" }),
  ];

  it("should rename the matching section", () => {
    const result = renameSectionUpdater(sections, "sec1", "New Intro");
    expect(result[0].name).toBe("New Intro");
    expect(result[1].name).toBe("Body");
  });

  it("should not modify other sections", () => {
    const result = renameSectionUpdater(sections, "sec1", "New Intro");
    expect(result[1]).toBe(sections[1]);
  });

  it("should return unchanged if section not found", () => {
    const result = renameSectionUpdater(sections, "unknown", "New Name");
    expect(result.map((s) => s.name)).toEqual(["Introduction", "Body"]);
  });
});

describe("renameSectionSlidesUpdater", () => {
  it("should update sectionName on matching slides", () => {
    const slides = [
      makeSlide({ id: "s1", sectionId: "sec1", sectionName: "Old" }),
      makeSlide({ id: "s2", sectionId: "sec2", sectionName: "Other" }),
    ];
    const result = renameSectionSlidesUpdater(slides, "sec1", "New Name");
    expect(result[0].sectionName).toBe("New Name");
    expect(result[1].sectionName).toBe("Other");
  });
});

// ---------------------------------------------------------------------------
// Tests: Delete Section
// ---------------------------------------------------------------------------

describe("deleteSectionUpdater", () => {
  it("should merge deleted section's slideIds into previous section", () => {
    const sections = [
      makeSection({ id: "sec1", name: "Intro", slideIds: ["1", "2"] }),
      makeSection({ id: "sec2", name: "Body", slideIds: ["3", "4"] }),
    ];
    const result = deleteSectionUpdater(sections, "sec2");
    expect(result).toHaveLength(1);
    expect(result[0].slideIds).toEqual(["1", "2", "3", "4"]);
  });

  it("should remove first section without merging when no previous section", () => {
    const sections = [
      makeSection({ id: "sec1", name: "Intro", slideIds: ["1"] }),
      makeSection({ id: "sec2", name: "Body", slideIds: ["2"] }),
    ];
    const result = deleteSectionUpdater(sections, "sec1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("sec2");
    expect(result[0].slideIds).toEqual(["2"]);
  });

  it("should return unchanged if section not found", () => {
    const sections = [makeSection({ id: "sec1", name: "Intro" })];
    const result = deleteSectionUpdater(sections, "unknown");
    expect(result).toBe(sections);
  });

  it("should handle deleting middle section", () => {
    const sections = [
      makeSection({ id: "sec1", name: "A", slideIds: ["1"] }),
      makeSection({ id: "sec2", name: "B", slideIds: ["2", "3"] }),
      makeSection({ id: "sec3", name: "C", slideIds: ["4"] }),
    ];
    const result = deleteSectionUpdater(sections, "sec2");
    expect(result).toHaveLength(2);
    expect(result[0].slideIds).toEqual(["1", "2", "3"]);
    expect(result[1].slideIds).toEqual(["4"]);
  });
});

describe("deleteSectionSlidesUpdater", () => {
  const sections = [
    makeSection({ id: "sec1", name: "Intro" }),
    makeSection({ id: "sec2", name: "Body" }),
  ];

  it("should move slides to previous section", () => {
    const slides = [
      makeSlide({ id: "s1", sectionId: "sec2", sectionName: "Body" }),
    ];
    const result = deleteSectionSlidesUpdater(slides, "sec2", sections);
    expect(result[0].sectionId).toBe("sec1");
    expect(result[0].sectionName).toBe("Intro");
  });

  it("should clear sectionId when no previous section exists", () => {
    const slides = [
      makeSlide({ id: "s1", sectionId: "sec1", sectionName: "Intro" }),
    ];
    const result = deleteSectionSlidesUpdater(slides, "sec1", sections);
    expect(result[0].sectionId).toBeUndefined();
    expect(result[0].sectionName).toBeUndefined();
  });

  it("should not modify slides from other sections", () => {
    const slides = [
      makeSlide({ id: "s1", sectionId: "sec1" }),
      makeSlide({ id: "s2", sectionId: "sec2" }),
    ];
    const result = deleteSectionSlidesUpdater(slides, "sec2", sections);
    expect(result[0].sectionId).toBe("sec1"); // unchanged
  });
});

// ---------------------------------------------------------------------------
// Tests: Move Section
// ---------------------------------------------------------------------------

describe("moveSectionUpUpdater", () => {
  const sections = [
    makeSection({ id: "sec1", name: "A" }),
    makeSection({ id: "sec2", name: "B" }),
    makeSection({ id: "sec3", name: "C" }),
  ];

  it("should swap section with the one above it", () => {
    const result = moveSectionUpUpdater(sections, "sec2");
    expect(result.map((s) => s.id)).toEqual(["sec2", "sec1", "sec3"]);
  });

  it("should not change order if already first", () => {
    const result = moveSectionUpUpdater(sections, "sec1");
    expect(result).toBe(sections);
  });

  it("should not change order if section not found", () => {
    const result = moveSectionUpUpdater(sections, "unknown");
    expect(result).toBe(sections);
  });

  it("should move last section up", () => {
    const result = moveSectionUpUpdater(sections, "sec3");
    expect(result.map((s) => s.id)).toEqual(["sec1", "sec3", "sec2"]);
  });
});

describe("moveSectionDownUpdater", () => {
  const sections = [
    makeSection({ id: "sec1", name: "A" }),
    makeSection({ id: "sec2", name: "B" }),
    makeSection({ id: "sec3", name: "C" }),
  ];

  it("should swap section with the one below it", () => {
    const result = moveSectionDownUpdater(sections, "sec2");
    expect(result.map((s) => s.id)).toEqual(["sec1", "sec3", "sec2"]);
  });

  it("should not change order if already last", () => {
    const result = moveSectionDownUpdater(sections, "sec3");
    expect(result).toBe(sections);
  });

  it("should not change order if section not found", () => {
    const result = moveSectionDownUpdater(sections, "unknown");
    expect(result).toBe(sections);
  });

  it("should move first section down", () => {
    const result = moveSectionDownUpdater(sections, "sec1");
    expect(result.map((s) => s.id)).toEqual(["sec2", "sec1", "sec3"]);
  });
});

// ---------------------------------------------------------------------------
// Tests: Move Slides to Section
// ---------------------------------------------------------------------------

describe("moveSlidesToSectionSlidesUpdater", () => {
  it("should update sectionId and sectionName for target slides", () => {
    const slides = [
      makeSlide({ id: "s1", sectionId: "sec1", sectionName: "Old" }),
      makeSlide({ id: "s2", sectionId: "sec1", sectionName: "Old" }),
      makeSlide({ id: "s3", sectionId: "sec2", sectionName: "Other" }),
    ];
    const result = moveSlidesToSectionSlidesUpdater(
      slides,
      [0, 1],
      "sec3",
      "New Section",
    );
    expect(result[0].sectionId).toBe("sec3");
    expect(result[0].sectionName).toBe("New Section");
    expect(result[1].sectionId).toBe("sec3");
    expect(result[2].sectionId).toBe("sec2"); // unchanged
  });
});

describe("moveSlidesToSectionSectionsUpdater", () => {
  it("should add slide IDs to target section and remove from others", () => {
    const sections = [
      makeSection({ id: "sec1", name: "A", slideIds: ["1", "2"] }),
      makeSection({ id: "sec2", name: "B", slideIds: ["3"] }),
    ];
    const result = moveSlidesToSectionSectionsUpdater(
      sections,
      ["2"],
      "sec2",
    );
    expect(result[0].slideIds).toEqual(["1"]); // removed "2"
    expect(result[1].slideIds).toEqual(["3", "2"]); // added "2"
  });

  it("should not duplicate slide IDs already in target section", () => {
    const sections = [
      makeSection({ id: "sec1", name: "A", slideIds: ["1"] }),
      makeSection({ id: "sec2", name: "B", slideIds: ["2"] }),
    ];
    const result = moveSlidesToSectionSectionsUpdater(
      sections,
      ["2"],
      "sec2",
    );
    // "2" is already in sec2, should not be duplicated
    expect(result[1].slideIds).toEqual(["2"]);
  });

  it("should handle moving multiple slides to another section", () => {
    const sections = [
      makeSection({ id: "sec1", name: "A", slideIds: ["1", "2", "3"] }),
      makeSection({ id: "sec2", name: "B", slideIds: [] }),
    ];
    const result = moveSlidesToSectionSectionsUpdater(
      sections,
      ["1", "3"],
      "sec2",
    );
    expect(result[0].slideIds).toEqual(["2"]);
    expect(result[1].slideIds).toEqual(["1", "3"]);
  });
});
