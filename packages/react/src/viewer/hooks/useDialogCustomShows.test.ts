import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Pure logic extracted from useDialogCustomShows for testing.
// ---------------------------------------------------------------------------

interface CustomShow {
  id: string;
  name: string;
  slideRIds: string[];
}

/**
 * Determine if the current slide is in the active custom show.
 * Mirrors the useMemo logic in useDialogCustomShows.
 */
function isSlideInActiveShow(
  activeCustomShowId: string | null,
  slideRId: string | undefined,
  customShows: CustomShow[],
): boolean {
  if (!activeCustomShowId || !slideRId) return false;
  const show = customShows.find((s) => s.id === activeCustomShowId);
  return show ? show.slideRIds.includes(slideRId) : false;
}

/**
 * Toggle a slide in or out of a custom show.
 * Mirrors the updater in handleToggleCurrentSlideInActiveShow.
 */
function toggleSlideInShowUpdater(
  shows: CustomShow[],
  showId: string,
  slideRId: string,
): CustomShow[] {
  return shows.map((s) => {
    if (s.id !== showId) return s;
    const hasSlide = s.slideRIds.includes(slideRId);
    return {
      ...s,
      slideRIds: hasSlide
        ? s.slideRIds.filter((rid) => rid !== slideRId)
        : [...s.slideRIds, slideRId],
    };
  });
}

/**
 * Rename a custom show.
 */
function renameShowUpdater(
  shows: CustomShow[],
  showId: string,
  newName: string,
): CustomShow[] {
  return shows.map((s) =>
    s.id === showId ? { ...s, name: newName } : s,
  );
}

/**
 * Delete a custom show.
 */
function deleteShowUpdater(
  shows: CustomShow[],
  showId: string,
): CustomShow[] {
  return shows.filter((s) => s.id !== showId);
}

/**
 * Create a custom show name from user input or fallback.
 */
function resolveShowName(
  input: string | null | undefined,
  existingShowCount: number,
): string {
  const trimmed = input?.trim();
  return trimmed || `Custom Show ${existingShowCount + 1}`;
}

// ---------------------------------------------------------------------------
// Tests: isSlideInActiveShow
// ---------------------------------------------------------------------------

describe("isSlideInActiveShow", () => {
  const shows: CustomShow[] = [
    { id: "show1", name: "Show 1", slideRIds: ["rId1", "rId3"] },
    { id: "show2", name: "Show 2", slideRIds: ["rId2"] },
  ];

  it("should return true when slide is in the active show", () => {
    expect(isSlideInActiveShow("show1", "rId1", shows)).toBe(true);
  });

  it("should return false when slide is not in the active show", () => {
    expect(isSlideInActiveShow("show1", "rId2", shows)).toBe(false);
  });

  it("should return false when no active show", () => {
    expect(isSlideInActiveShow(null, "rId1", shows)).toBe(false);
  });

  it("should return false when no slide rId", () => {
    expect(isSlideInActiveShow("show1", undefined, shows)).toBe(false);
  });

  it("should return false when active show not found", () => {
    expect(isSlideInActiveShow("unknown", "rId1", shows)).toBe(false);
  });

  it("should return true for last element in slideRIds", () => {
    expect(isSlideInActiveShow("show1", "rId3", shows)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: toggleSlideInShowUpdater
// ---------------------------------------------------------------------------

describe("toggleSlideInShowUpdater", () => {
  it("should add slide to show when not present", () => {
    const shows: CustomShow[] = [
      { id: "show1", name: "Show 1", slideRIds: ["rId1"] },
    ];
    const result = toggleSlideInShowUpdater(shows, "show1", "rId2");
    expect(result[0].slideRIds).toEqual(["rId1", "rId2"]);
  });

  it("should remove slide from show when already present", () => {
    const shows: CustomShow[] = [
      { id: "show1", name: "Show 1", slideRIds: ["rId1", "rId2"] },
    ];
    const result = toggleSlideInShowUpdater(shows, "show1", "rId1");
    expect(result[0].slideRIds).toEqual(["rId2"]);
  });

  it("should not modify other shows", () => {
    const shows: CustomShow[] = [
      { id: "show1", name: "Show 1", slideRIds: ["rId1"] },
      { id: "show2", name: "Show 2", slideRIds: ["rId2"] },
    ];
    const result = toggleSlideInShowUpdater(shows, "show1", "rId3");
    expect(result[1]).toBe(shows[1]); // exact same reference
  });

  it("should handle toggling on empty show", () => {
    const shows: CustomShow[] = [
      { id: "show1", name: "Show 1", slideRIds: [] },
    ];
    const result = toggleSlideInShowUpdater(shows, "show1", "rId1");
    expect(result[0].slideRIds).toEqual(["rId1"]);
  });
});

// ---------------------------------------------------------------------------
// Tests: renameShowUpdater
// ---------------------------------------------------------------------------

describe("renameShowUpdater", () => {
  const shows: CustomShow[] = [
    { id: "show1", name: "Show 1", slideRIds: [] },
    { id: "show2", name: "Show 2", slideRIds: [] },
  ];

  it("should rename the matching show", () => {
    const result = renameShowUpdater(shows, "show1", "My Presentation");
    expect(result[0].name).toBe("My Presentation");
    expect(result[1].name).toBe("Show 2");
  });

  it("should not modify if show not found", () => {
    const result = renameShowUpdater(shows, "unknown", "New Name");
    expect(result.map((s) => s.name)).toEqual(["Show 1", "Show 2"]);
  });
});

// ---------------------------------------------------------------------------
// Tests: deleteShowUpdater
// ---------------------------------------------------------------------------

describe("deleteShowUpdater", () => {
  const shows: CustomShow[] = [
    { id: "show1", name: "Show 1", slideRIds: ["rId1"] },
    { id: "show2", name: "Show 2", slideRIds: ["rId2"] },
  ];

  it("should remove the matching show", () => {
    const result = deleteShowUpdater(shows, "show1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("show2");
  });

  it("should return unchanged if show not found", () => {
    const result = deleteShowUpdater(shows, "unknown");
    expect(result).toHaveLength(2);
  });

  it("should handle deleting last show", () => {
    const single: CustomShow[] = [
      { id: "show1", name: "Show 1", slideRIds: [] },
    ];
    const result = deleteShowUpdater(single, "show1");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: resolveShowName
// ---------------------------------------------------------------------------

describe("resolveShowName", () => {
  it("should use trimmed user input when provided", () => {
    expect(resolveShowName("My Show", 2)).toBe("My Show");
  });

  it("should trim whitespace from user input", () => {
    expect(resolveShowName("  Trimmed  ", 2)).toBe("Trimmed");
  });

  it("should fallback to numbered name when input is null", () => {
    expect(resolveShowName(null, 2)).toBe("Custom Show 3");
  });

  it("should fallback to numbered name when input is undefined", () => {
    expect(resolveShowName(undefined, 0)).toBe("Custom Show 1");
  });

  it("should fallback to numbered name when input is empty string", () => {
    expect(resolveShowName("", 5)).toBe("Custom Show 6");
  });

  it("should fallback when input is only whitespace", () => {
    expect(resolveShowName("   ", 3)).toBe("Custom Show 4");
  });
});
