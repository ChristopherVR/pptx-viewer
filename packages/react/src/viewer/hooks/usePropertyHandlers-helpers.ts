/**
 * Pure helper functions extracted from usePropertyHandlers for testability.
 */
import type {
  PptxSlide,
  PptxElement,
} from "pptx-viewer-core";
import { hasTextProperties } from "pptx-viewer-core";
import type { SlideDiff, CompareResult } from "../utils/compare";

// ---------------------------------------------------------------------------
// Font collection
// ---------------------------------------------------------------------------

/**
 * Collect all unique font families used across all slides, sorted alphabetically.
 */
export function collectUsedFonts(slides: PptxSlide[]): string[] {
  const fonts = new Set<string>();
  for (const slide of slides) {
    for (const el of slide.elements ?? []) {
      collectFontsFromElement(el, fonts);
    }
  }
  return Array.from(fonts).sort();
}

/**
 * Recursively collect font families from a single element.
 */
export function collectFontsFromElement(
  el: PptxElement,
  fonts: Set<string>,
): void {
  if (hasTextProperties(el)) {
    if (el.textStyle?.fontFamily) fonts.add(el.textStyle.fontFamily);
    if (el.textSegments) {
      for (const seg of el.textSegments) {
        if (seg.style?.fontFamily) fonts.add(seg.style.fontFamily);
      }
    }
  }
  if (el.type === "group" && el.children) {
    for (const child of el.children) {
      collectFontsFromElement(child, fonts);
    }
  }
}

// ---------------------------------------------------------------------------
// Slide accept/reject for compare
// ---------------------------------------------------------------------------

/**
 * Apply a single "accept" operation for a slide diff to the current slides array.
 * Returns a new array (immutable).
 */
export function applyAcceptSlide(
  slides: PptxSlide[],
  diff: SlideDiff,
): PptxSlide[] {
  const n = [...slides];
  if (diff.status === "added" && diff.compareSlide) {
    n.splice(Math.min(diff.compareIndex, n.length), 0, {
      ...diff.compareSlide,
    });
  } else if (
    diff.status === "changed" &&
    diff.compareSlide &&
    diff.baseIndex >= 0
  ) {
    n[diff.baseIndex] = { ...diff.compareSlide };
  } else if (diff.status === "removed" && diff.baseIndex >= 0) {
    n.splice(diff.baseIndex, 1);
  }
  return n;
}

/**
 * Apply all "accept" operations from a CompareResult to the current slides array.
 * Processes removals in reverse order, then changes, then additions.
 * Returns a new array (immutable).
 */
export function applyAcceptAllSlides(
  slides: PptxSlide[],
  compareResult: CompareResult,
): PptxSlide[] {
  const n = [...slides];
  const dd = [...compareResult.diffs];

  // Removals in reverse order
  for (let i = dd.length - 1; i >= 0; i--) {
    const x = dd[i];
    if (x.status === "removed" && x.baseIndex >= 0 && x.baseIndex < n.length) {
      n.splice(x.baseIndex, 1);
    }
  }

  // Changes
  for (const x of dd) {
    if (
      x.status === "changed" &&
      x.compareSlide &&
      x.baseIndex >= 0 &&
      x.baseIndex < n.length
    ) {
      n[x.baseIndex] = { ...x.compareSlide };
    }
  }

  // Additions
  for (const x of dd) {
    if (x.status === "added" && x.compareSlide) {
      n.splice(Math.min(x.compareIndex, n.length), 0, {
        ...x.compareSlide,
      });
    }
  }

  return n;
}
