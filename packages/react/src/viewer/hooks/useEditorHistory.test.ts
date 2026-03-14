import { describe, it, expect } from "vitest";
import type { PptxSlide, PptxElement } from "pptx-viewer-core";
import type { EditorHistorySnapshot } from "../types";

// ---------------------------------------------------------------------------
// Pure logic extracted from useEditorHistory for testing.
// ---------------------------------------------------------------------------

const MAX_HISTORY_ENTRIES = 120;

/**
 * Build a history snapshot (mirrors buildHistorySnapshot callback).
 */
function buildHistorySnapshot(
  canvasWidth: number,
  canvasHeight: number,
  activeSlideIndex: number,
  slides: PptxSlide[],
  templateElementsBySlideId: Record<string, PptxElement[]>,
  actionLabel?: string,
): EditorHistorySnapshot {
  return {
    width: canvasWidth,
    height: canvasHeight,
    activeSlideIndex,
    slides: slides.map((s) => ({ ...s })),
    templateElementsBySlideId: { ...templateElementsBySlideId },
    ...(actionLabel ? { actionLabel } : {}),
  };
}

/**
 * Simulate pushing to history stack with max cap.
 */
function pushToHistoryStack(
  stack: EditorHistorySnapshot[],
  snapshot: EditorHistorySnapshot,
  maxEntries: number = MAX_HISTORY_ENTRIES,
): EditorHistorySnapshot[] {
  const next = [...stack, snapshot];
  if (next.length > maxEntries) {
    next.shift();
  }
  return next;
}

/**
 * Compute the clamped active slide index when applying a snapshot.
 */
function clampActiveSlideIndex(
  snapshotSlideCount: number,
  snapshotActiveIndex: number,
): number {
  const maxSlideIndex = Math.max(snapshotSlideCount - 1, 0);
  return Math.min(snapshotActiveIndex, maxSlideIndex);
}

/**
 * Determine whether history tracking should skip based on conditions.
 */
function shouldSkipHistoryTracking(
  loading: boolean,
  error: string | null,
  isApplyingHistory: boolean,
  hasActivePointerInteraction: boolean,
): boolean {
  return loading || !!error || isApplyingHistory || hasActivePointerInteraction;
}

/**
 * Determine if a snapshot has changed by comparing serialized forms.
 */
function hasSnapshotChanged(
  currentSerialized: string,
  previousSerialized: string,
): boolean {
  return currentSerialized !== previousSerialized;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeSlide(id: string): PptxSlide {
  return {
    id,
    rId: "",
    slideNumber: 1,
    elements: [],
  } as PptxSlide;
}

// ---------------------------------------------------------------------------
// Tests: buildHistorySnapshot
// ---------------------------------------------------------------------------

describe("buildHistorySnapshot", () => {
  it("should create a snapshot with correct dimensions", () => {
    const snap = buildHistorySnapshot(960, 540, 0, [], {});
    expect(snap.width).toBe(960);
    expect(snap.height).toBe(540);
  });

  it("should include the active slide index", () => {
    const snap = buildHistorySnapshot(960, 540, 3, [], {});
    expect(snap.activeSlideIndex).toBe(3);
  });

  it("should include slides as copies", () => {
    const slides = [makeSlide("s1"), makeSlide("s2")];
    const snap = buildHistorySnapshot(960, 540, 0, slides, {});
    expect(snap.slides).toHaveLength(2);
    expect(snap.slides[0]).not.toBe(slides[0]); // copy, not reference
  });

  it("should include actionLabel when provided", () => {
    const snap = buildHistorySnapshot(960, 540, 0, [], {}, "Add shape");
    expect(snap.actionLabel).toBe("Add shape");
  });

  it("should not include actionLabel when not provided", () => {
    const snap = buildHistorySnapshot(960, 540, 0, [], {});
    expect(snap.actionLabel).toBeUndefined();
  });

  it("should include templateElementsBySlideId", () => {
    const templates = {
      "slide-1": [{ id: "el1", type: "shape" } as PptxElement],
    };
    const snap = buildHistorySnapshot(960, 540, 0, [], templates);
    expect(snap.templateElementsBySlideId["slide-1"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: pushToHistoryStack
// ---------------------------------------------------------------------------

describe("pushToHistoryStack", () => {
  const baseSnapshot: EditorHistorySnapshot = {
    width: 960,
    height: 540,
    activeSlideIndex: 0,
    slides: [],
    templateElementsBySlideId: {},
  };

  it("should add snapshot to the stack", () => {
    const result = pushToHistoryStack([], baseSnapshot);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(baseSnapshot);
  });

  it("should preserve existing entries", () => {
    const existing = [{ ...baseSnapshot, activeSlideIndex: 1 }];
    const result = pushToHistoryStack(existing, baseSnapshot);
    expect(result).toHaveLength(2);
    expect(result[0].activeSlideIndex).toBe(1);
  });

  it("should remove oldest entry when exceeding max", () => {
    const stack = Array.from({ length: 120 }, (_, i) => ({
      ...baseSnapshot,
      activeSlideIndex: i,
    }));
    const newEntry = { ...baseSnapshot, activeSlideIndex: 999 };
    const result = pushToHistoryStack(stack, newEntry);
    expect(result).toHaveLength(120);
    expect(result[0].activeSlideIndex).toBe(1); // first was removed
    expect(result[119].activeSlideIndex).toBe(999);
  });

  it("should respect custom max entries", () => {
    const stack = [baseSnapshot, baseSnapshot, baseSnapshot];
    const result = pushToHistoryStack(stack, baseSnapshot, 3);
    expect(result).toHaveLength(3);
  });

  it("should handle max entries of 1", () => {
    const stack = [{ ...baseSnapshot, activeSlideIndex: 0 }];
    const newEntry = { ...baseSnapshot, activeSlideIndex: 1 };
    const result = pushToHistoryStack(stack, newEntry, 1);
    expect(result).toHaveLength(1);
    expect(result[0].activeSlideIndex).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: clampActiveSlideIndex
// ---------------------------------------------------------------------------

describe("clampActiveSlideIndex", () => {
  it("should return the index when within range", () => {
    expect(clampActiveSlideIndex(5, 2)).toBe(2);
  });

  it("should clamp to last valid index when too large", () => {
    expect(clampActiveSlideIndex(3, 10)).toBe(2);
  });

  it("should return 0 when slide count is 0", () => {
    expect(clampActiveSlideIndex(0, 5)).toBe(0);
  });

  it("should return 0 for index 0 with 1 slide", () => {
    expect(clampActiveSlideIndex(1, 0)).toBe(0);
  });

  it("should clamp index 1 to 0 when only 1 slide", () => {
    expect(clampActiveSlideIndex(1, 1)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: shouldSkipHistoryTracking
// ---------------------------------------------------------------------------

describe("shouldSkipHistoryTracking", () => {
  it("should skip when loading", () => {
    expect(shouldSkipHistoryTracking(true, null, false, false)).toBe(true);
  });

  it("should skip when error exists", () => {
    expect(shouldSkipHistoryTracking(false, "error", false, false)).toBe(true);
  });

  it("should skip when applying history", () => {
    expect(shouldSkipHistoryTracking(false, null, true, false)).toBe(true);
  });

  it("should skip when pointer interaction is active", () => {
    expect(shouldSkipHistoryTracking(false, null, false, true)).toBe(true);
  });

  it("should not skip when all conditions are false", () => {
    expect(shouldSkipHistoryTracking(false, null, false, false)).toBe(false);
  });

  it("should skip when multiple conditions are true", () => {
    expect(shouldSkipHistoryTracking(true, "error", true, true)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: hasSnapshotChanged
// ---------------------------------------------------------------------------

describe("hasSnapshotChanged", () => {
  it("should return true when serialized strings differ", () => {
    expect(hasSnapshotChanged('{"a":1}', '{"a":2}')).toBe(true);
  });

  it("should return false when serialized strings are identical", () => {
    expect(hasSnapshotChanged('{"a":1}', '{"a":1}')).toBe(false);
  });

  it("should return true comparing against empty string", () => {
    expect(hasSnapshotChanged('{"a":1}', "")).toBe(true);
  });

  it("should return false for two empty strings", () => {
    expect(hasSnapshotChanged("", "")).toBe(false);
  });
});
